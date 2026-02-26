
-- Drop and recreate all triggers to ensure they exist
DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;
DROP TRIGGER IF EXISTS on_thread_like_change ON public.thread_likes;
DROP TRIGGER IF EXISTS on_thread_reply_change ON public.thread_replies;
DROP TRIGGER IF EXISTS on_reply_like_change ON public.reply_likes;
DROP TRIGGER IF EXISTS on_group_member_change ON public.group_members;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
