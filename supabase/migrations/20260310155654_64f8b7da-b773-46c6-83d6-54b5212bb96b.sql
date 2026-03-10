
-- Drop the restrictive SELECT policies on posts
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;

-- Recreate as PERMISSIVE so either condition grants access
CREATE POLICY "Public posts are viewable by everyone"
ON public.posts FOR SELECT
USING ((privacy = 'public'::post_privacy) AND (is_hidden = false));

CREATE POLICY "Users can view their own posts"
ON public.posts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
