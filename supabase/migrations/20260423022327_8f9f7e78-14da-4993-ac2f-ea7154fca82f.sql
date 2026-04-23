-- 1) Create join requests table
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests; group admins can view requests for their group
CREATE POLICY "Users view own join requests"
ON public.group_join_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_join_requests.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_admin = true
  )
);

-- Users can create their own requests
CREATE POLICY "Users create own join requests"
ON public.group_join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Group admins can update (approve/reject); requester can cancel
CREATE POLICY "Admins update join requests"
ON public.group_join_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_join_requests.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_admin = true
  )
);

CREATE POLICY "Users delete own join requests"
ON public.group_join_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 2) Update groups SELECT policy so private groups are also visible (for discovery)
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.groups;
CREATE POLICY "Groups are viewable by everyone"
ON public.groups
FOR SELECT
TO public
USING (true);

-- 3) Allow members (not just admins) to invite to public groups; admins still required for private
DROP POLICY IF EXISTS "Group admins can send invitations" ON public.group_invitations;
CREATE POLICY "Members can send invitations"
ON public.group_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = inviter_id
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_invitations.group_id
      AND gm.user_id = auth.uid()
      AND (
        gm.is_admin = true
        OR EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = group_invitations.group_id
            AND g.privacy = 'public'
        )
      )
  )
);

-- 4) Trigger to update updated_at on join requests
CREATE OR REPLACE FUNCTION public.touch_group_join_requests()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_group_join_requests ON public.group_join_requests;
CREATE TRIGGER trg_touch_group_join_requests
BEFORE UPDATE ON public.group_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.touch_group_join_requests();

-- 5) When a join request is approved, automatically add the user as a member
CREATE OR REPLACE FUNCTION public.handle_join_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.group_members (group_id, user_id, is_admin)
    VALUES (NEW.group_id, NEW.user_id, false)
    ON CONFLICT DO NOTHING;

    -- Notify the requester
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (
      NEW.user_id,
      auth.uid(),
      'group_invite',
      'Your request to join the group was approved'
    );
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (
      NEW.user_id,
      auth.uid(),
      'group_invite',
      'Your request to join the group was rejected'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_join_request_approval ON public.group_join_requests;
CREATE TRIGGER trg_handle_join_request_approval
AFTER UPDATE ON public.group_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_join_request_approval();

-- 6) Notify group admins when a new join request is created
CREATE OR REPLACE FUNCTION public.notify_group_join_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id uuid;
  _requester_name text;
BEGIN
  SELECT COALESCE(display_name, 'Someone') INTO _requester_name
  FROM public.profiles WHERE id = NEW.user_id;

  FOR _admin_id IN
    SELECT user_id FROM public.group_members
    WHERE group_id = NEW.group_id AND is_admin = true
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (
      _admin_id,
      NEW.user_id,
      'group_invite',
      _requester_name || ' requested to join your group'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_join_request ON public.group_join_requests;
CREATE TRIGGER trg_notify_group_join_request
AFTER INSERT ON public.group_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_group_join_request();

-- 7) Storage policies for group photos in the existing public 'posts' bucket
-- Allow authenticated users to upload (group admins enforce via UI; bucket is public read)
CREATE POLICY "Authenticated can upload group photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posts' AND (storage.foldername(name))[1] = 'group-photos');

CREATE POLICY "Authenticated can update group photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'posts' AND (storage.foldername(name))[1] = 'group-photos');