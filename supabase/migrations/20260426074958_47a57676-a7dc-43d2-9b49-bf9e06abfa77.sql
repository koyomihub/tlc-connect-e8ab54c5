
-- Add group_id to notifications for proper navigation
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- Update join request approval trigger to include group_id and group name
CREATE OR REPLACE FUNCTION public.handle_join_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _group_name text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.group_members (group_id, user_id, is_admin)
    VALUES (NEW.group_id, NEW.user_id, false)
    ON CONFLICT DO NOTHING;

    SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

    INSERT INTO public.notifications (user_id, actor_id, type, group_id, content)
    VALUES (
      NEW.user_id,
      auth.uid(),
      'group_invite',
      NEW.group_id,
      'Your request to join ' || COALESCE(_group_name, 'the group') || ' was approved'
    );
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

    INSERT INTO public.notifications (user_id, actor_id, type, group_id, content)
    VALUES (
      NEW.user_id,
      auth.uid(),
      'group_invite',
      NEW.group_id,
      'Your request to join ' || COALESCE(_group_name, 'the group') || ' was rejected'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Update group invitation trigger to include group_id
CREATE OR REPLACE FUNCTION public.notify_group_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _inviter_name text;
  _group_name text;
BEGIN
  SELECT COALESCE(display_name, 'Someone') INTO _inviter_name
  FROM public.profiles WHERE id = NEW.inviter_id;

  SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

  INSERT INTO public.notifications (user_id, actor_id, type, group_id, content)
  VALUES (
    NEW.invitee_id,
    NEW.inviter_id,
    'group_invite',
    NEW.group_id,
    _inviter_name || ' invited you to join ' || COALESCE(_group_name, 'a group')
  );
  RETURN NEW;
END;
$function$;

-- Update group join request trigger to include group_id
CREATE OR REPLACE FUNCTION public.notify_group_join_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _requester_name text;
  _group_name text;
BEGIN
  SELECT COALESCE(display_name, 'Someone') INTO _requester_name
  FROM public.profiles WHERE id = NEW.user_id;

  SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

  FOR _admin_id IN
    SELECT user_id FROM public.group_members
    WHERE group_id = NEW.group_id AND is_admin = true
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, group_id, content)
    VALUES (
      _admin_id,
      NEW.user_id,
      'group_invite',
      NEW.group_id,
      _requester_name || ' requested to join ' || COALESCE(_group_name, 'your group')
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Update reopened request trigger to include group_id
CREATE OR REPLACE FUNCTION public.notify_group_join_request_reopened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _requester_name text;
  _group_name text;
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    SELECT COALESCE(display_name, 'Someone') INTO _requester_name
    FROM public.profiles WHERE id = NEW.user_id;

    SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

    FOR _admin_id IN
      SELECT user_id FROM public.group_members
      WHERE group_id = NEW.group_id AND is_admin = true
    LOOP
      INSERT INTO public.notifications (user_id, actor_id, type, group_id, content)
      VALUES (
        _admin_id,
        NEW.user_id,
        'group_invite',
        NEW.group_id,
        _requester_name || ' requested to join ' || COALESCE(_group_name, 'your group')
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
