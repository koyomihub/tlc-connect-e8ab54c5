DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
DROP TRIGGER IF EXISTS on_post_comment_change ON public.post_comments;

CREATE TRIGGER on_post_like_change
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_likes_count();

CREATE TRIGGER on_post_comment_change
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comments_count();

UPDATE public.posts p
SET likes_count = counts.like_count
FROM (
  SELECT post_id, COUNT(*)::integer AS like_count
  FROM public.post_likes
  GROUP BY post_id
) counts
WHERE counts.post_id = p.id;

UPDATE public.posts
SET likes_count = 0
WHERE id NOT IN (
  SELECT DISTINCT post_id
  FROM public.post_likes
);

UPDATE public.posts p
SET comments_count = counts.comment_count
FROM (
  SELECT post_id, COUNT(*)::integer AS comment_count
  FROM public.post_comments
  GROUP BY post_id
) counts
WHERE counts.post_id = p.id;

UPDATE public.posts
SET comments_count = 0
WHERE id NOT IN (
  SELECT DISTINCT post_id
  FROM public.post_comments
);