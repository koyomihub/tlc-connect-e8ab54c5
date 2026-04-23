CREATE OR REPLACE FUNCTION public.notify_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Someone') INTO _actor_name
  FROM public.profiles WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', _actor_name || ' started following you');

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_new_follow ON public.follows;
CREATE TRIGGER trg_notify_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_follow();