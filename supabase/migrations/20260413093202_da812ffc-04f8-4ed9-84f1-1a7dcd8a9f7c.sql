
-- Drop all possible triggers on thread_likes
DROP TRIGGER IF EXISTS on_thread_like_change ON public.thread_likes;
DROP TRIGGER IF EXISTS update_thread_likes_count ON public.thread_likes;
DROP TRIGGER IF EXISTS on_thread_likes_change ON public.thread_likes;

-- Recreate single trigger
CREATE TRIGGER on_thread_like_change
AFTER INSERT OR DELETE ON public.thread_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_thread_likes_count();

-- Resync all thread likes_count
UPDATE public.threads t
SET likes_count = (SELECT COUNT(*) FROM public.thread_likes tl WHERE tl.thread_id = t.id);
