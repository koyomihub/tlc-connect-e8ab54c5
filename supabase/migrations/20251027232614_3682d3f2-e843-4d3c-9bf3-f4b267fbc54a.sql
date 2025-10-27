-- Add image_urls column to posts table to support multiple images (keeping image_url for backward compatibility)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- Migrate existing single image_url to image_urls array
UPDATE public.posts 
SET image_urls = ARRAY[image_url] 
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);