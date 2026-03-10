
-- Recalculate all post likes counts
UPDATE public.posts p
SET likes_count = (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id);

-- Recalculate all post comments counts
UPDATE public.posts p
SET comments_count = (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = p.id);

-- Recalculate all thread likes counts
UPDATE public.threads t
SET likes_count = (SELECT COUNT(*) FROM public.thread_likes tl WHERE tl.thread_id = t.id);

-- Recalculate all thread replies counts
UPDATE public.threads t
SET replies_count = (SELECT COUNT(*) FROM public.thread_replies tr WHERE tr.thread_id = t.id);
