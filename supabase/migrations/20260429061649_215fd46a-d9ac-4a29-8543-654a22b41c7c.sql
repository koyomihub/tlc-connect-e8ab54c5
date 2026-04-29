
-- Allow users to delete their own files in the 'profiles' bucket
CREATE POLICY "Users can delete their own profile files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
