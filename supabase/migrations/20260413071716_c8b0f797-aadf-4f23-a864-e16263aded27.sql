
-- Drop all existing triggers
DROP TRIGGER IF EXISTS on_thread_like_change ON public.thread_likes;
DROP TRIGGER IF EXISTS update_thread_likes_count ON public.thread_likes;
DROP TRIGGER IF EXISTS on_thread_reply_change ON public.thread_replies;
DROP TRIGGER IF EXISTS update_thread_replies_count ON public.thread_replies;
DROP TRIGGER IF EXISTS on_reply_like_change ON public.reply_likes;
DROP TRIGGER IF EXISTS update_reply_likes_count ON public.reply_likes;
DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
DROP TRIGGER IF EXISTS update_post_likes_count ON public.post_likes;
DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;
DROP TRIGGER IF EXISTS update_post_comments_count ON public.post_comments;
DROP TRIGGER IF EXISTS update_comments_count ON public.post_comments;
DROP TRIGGER IF EXISTS on_group_member_change ON public.group_members;
DROP TRIGGER IF EXISTS update_group_members_count ON public.group_members;

-- Recreate functions with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_thread_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.threads SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.threads SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_thread_replies_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.threads SET replies_count = COALESCE(replies_count, 0) + 1 WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.threads SET replies_count = GREATEST(0, COALESCE(replies_count, 0) - 1) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_reply_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.thread_replies SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.reply_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.thread_replies SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.reply_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_group_members_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET members_count = COALESCE(members_count, 0) + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET members_count = GREATEST(0, COALESCE(members_count, 0) - 1) WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
END;
$$;

-- Recreate all triggers
CREATE TRIGGER on_thread_like_change
AFTER INSERT OR DELETE ON public.thread_likes
FOR EACH ROW EXECUTE FUNCTION public.update_thread_likes_count();

CREATE TRIGGER on_thread_reply_change
AFTER INSERT OR DELETE ON public.thread_replies
FOR EACH ROW EXECUTE FUNCTION public.update_thread_replies_count();

CREATE TRIGGER on_reply_like_change
AFTER INSERT OR DELETE ON public.reply_likes
FOR EACH ROW EXECUTE FUNCTION public.update_reply_likes_count();

CREATE TRIGGER on_post_like_change
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE TRIGGER on_post_comment_change
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

CREATE TRIGGER on_group_member_change
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.update_group_members_count();

-- Sync all existing counts
UPDATE public.threads t SET
  likes_count = (SELECT COUNT(*) FROM public.thread_likes tl WHERE tl.thread_id = t.id),
  replies_count = (SELECT COUNT(*) FROM public.thread_replies tr WHERE tr.thread_id = t.id),
  views_count = (SELECT COUNT(*) FROM public.thread_views tv WHERE tv.thread_id = t.id);

UPDATE public.thread_replies r SET
  likes_count = (SELECT COUNT(*) FROM public.reply_likes rl WHERE rl.reply_id = r.id);

UPDATE public.posts p SET
  likes_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id),
  comments_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
