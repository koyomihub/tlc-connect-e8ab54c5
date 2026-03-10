-- Fix thread_views INSERT policy: require authentication and proper user_id scoping
DROP POLICY IF EXISTS "Anyone can record a view" ON public.thread_views;

CREATE POLICY "Authenticated users can record a view"
ON public.thread_views FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);