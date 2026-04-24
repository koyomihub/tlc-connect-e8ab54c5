-- Create public nfts bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('nfts', 'nfts', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "NFT images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'nfts');

-- Admins can write/update/delete
CREATE POLICY "Admins can upload NFT images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nfts' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update NFT images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'nfts' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete NFT images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'nfts' AND public.is_admin(auth.uid()));