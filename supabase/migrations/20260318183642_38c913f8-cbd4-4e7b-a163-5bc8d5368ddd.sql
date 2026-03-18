
-- Drop and recreate triggers to ensure they're correct
DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;
DROP TRIGGER IF EXISTS on_thread_like_change ON public.thread_likes;
DROP TRIGGER IF EXISTS on_thread_reply_change ON public.thread_replies;
DROP TRIGGER IF EXISTS on_reply_like_change ON public.reply_likes;
DROP TRIGGER IF EXISTS on_group_member_change ON public.group_members;

CREATE TRIGGER on_post_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

CREATE TRIGGER on_thread_like_change
  AFTER INSERT OR DELETE ON public.thread_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_likes_count();

CREATE TRIGGER on_thread_reply_change
  AFTER INSERT OR DELETE ON public.thread_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_replies_count();

CREATE TRIGGER on_reply_like_change
  AFTER INSERT OR DELETE ON public.reply_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_reply_likes_count();

CREATE TRIGGER on_group_member_change
  AFTER INSERT OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_group_members_count();

-- Sync existing counts
UPDATE public.posts p SET likes_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id);
UPDATE public.posts p SET comments_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);
UPDATE public.threads t SET likes_count = (SELECT COUNT(*) FROM public.thread_likes tl WHERE tl.thread_id = t.id);
UPDATE public.threads t SET replies_count = (SELECT COUNT(*) FROM public.thread_replies tr WHERE tr.thread_id = t.id);
UPDATE public.thread_replies r SET likes_count = (SELECT COUNT(*) FROM public.reply_likes rl WHERE rl.reply_id = r.id);
