-- Notify admins when an existing join request is re-opened (status returns to 'pending')
CREATE OR REPLACE FUNCTION public.notify_group_join_request_reopened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
  _requester_name text;
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_group_join_request_reopened ON public.group_join_requests;
CREATE TRIGGER trg_notify_group_join_request_reopened
AFTER UPDATE ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_group_join_request_reopened();