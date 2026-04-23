-- 1. Add separate avatar field for the small group thumbnail
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Function + trigger: notify invitee when a group invitation is created
CREATE OR REPLACE FUNCTION public.notify_group_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter_name text;
  _group_name text;
BEGIN
  SELECT COALESCE(display_name, 'Someone') INTO _inviter_name
  FROM public.profiles WHERE id = NEW.inviter_id;

  SELECT name INTO _group_name FROM public.groups WHERE id = NEW.group_id;

  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (
    NEW.invitee_id,
    NEW.inviter_id,
    'group_invite',
    _inviter_name || ' invited you to join ' || COALESCE(_group_name, 'a group')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_invitation ON public.group_invitations;
CREATE TRIGGER trg_notify_group_invitation
AFTER INSERT ON public.group_invitations
FOR EACH ROW EXECUTE FUNCTION public.notify_group_invitation();

-- 3. Trigger: notify admins of a new join request (function already exists)
DROP TRIGGER IF EXISTS trg_notify_group_join_request ON public.group_join_requests;
CREATE TRIGGER trg_notify_group_join_request
AFTER INSERT ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_group_join_request();

-- 4. Trigger: handle join request approval/rejection (function already exists)
DROP TRIGGER IF EXISTS trg_handle_join_request_approval ON public.group_join_requests;
CREATE TRIGGER trg_handle_join_request_approval
AFTER UPDATE ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_join_request_approval();

-- 5. Trigger: keep updated_at fresh on join requests
DROP TRIGGER IF EXISTS trg_touch_group_join_requests ON public.group_join_requests;
CREATE TRIGGER trg_touch_group_join_requests
BEFORE UPDATE ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_group_join_requests();

-- 6. Trigger: notify on new follow (function already exists)
DROP TRIGGER IF EXISTS trg_notify_new_follow ON public.follows;
CREATE TRIGGER trg_notify_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_new_follow();

-- 7. Members count auto-update (in case its trigger was missing)
DROP TRIGGER IF EXISTS trg_update_group_members_count ON public.group_members;
CREATE TRIGGER trg_update_group_members_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.update_group_members_count();