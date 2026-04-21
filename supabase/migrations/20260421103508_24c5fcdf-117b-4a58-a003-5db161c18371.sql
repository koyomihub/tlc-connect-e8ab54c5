
-- Add reposts_count column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposts_count integer DEFAULT 0;

-- Backfill reposts_count
UPDATE public.posts p
SET reposts_count = sub.cnt
FROM (SELECT post_id, COUNT(*)::int AS cnt FROM public.reposts GROUP BY post_id) sub
WHERE p.id = sub.post_id;

-- Trigger function to maintain reposts_count
CREATE OR REPLACE FUNCTION public.update_post_reposts_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET reposts_count = COALESCE(reposts_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET reposts_count = GREATEST(0, COALESCE(reposts_count, 0) - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_post_reposts_count ON public.reposts;
CREATE TRIGGER trg_update_post_reposts_count
AFTER INSERT OR DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.update_post_reposts_count();

-- Notification trigger for post likes
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_owner uuid;
  _actor_name text;
BEGIN
  SELECT user_id INTO _post_owner FROM public.posts WHERE id = NEW.post_id;
  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, 'Someone') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
  VALUES (_post_owner, NEW.user_id, 'like', NEW.post_id, _actor_name || ' liked your post');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_like ON public.post_likes;
CREATE TRIGGER trg_notify_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- Notification trigger for post comments
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_owner uuid;
  _actor_name text;
BEGIN
  SELECT user_id INTO _post_owner FROM public.posts WHERE id = NEW.post_id;
  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, 'Someone') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
  VALUES (_post_owner, NEW.user_id, 'comment', NEW.post_id, _actor_name || ' commented on your post');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_comment ON public.post_comments;
CREATE TRIGGER trg_notify_post_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- Notification trigger for reposts
CREATE OR REPLACE FUNCTION public.notify_post_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _post_owner uuid;
  _actor_name text;
BEGIN
  SELECT user_id INTO _post_owner FROM public.posts WHERE id = NEW.post_id;
  IF _post_owner IS NULL OR _post_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(display_name, 'Someone') INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
  VALUES (_post_owner, NEW.user_id, 'repost', NEW.post_id, _actor_name || ' reposted your post');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_repost ON public.reposts;
CREATE TRIGGER trg_notify_post_repost
AFTER INSERT ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.notify_post_repost();
