
-- Fix: add SECURITY DEFINER so the trigger can update any user's post
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, COALESCE(comments_count, 0) - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop any duplicate triggers on post_comments to prevent double-counting
DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;
DROP TRIGGER IF EXISTS on_post_comment_created ON public.post_comments;
DROP TRIGGER IF EXISTS update_post_comments_count_trigger ON public.post_comments;

-- Re-create a single trigger
CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- Sync existing counts to actual values
UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id
);
