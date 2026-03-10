
-- Fix posts storage bucket policies: scope DELETE and INSERT to user's own folder
DROP POLICY IF EXISTS "Users can delete their post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;

CREATE POLICY "Users can delete their post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
