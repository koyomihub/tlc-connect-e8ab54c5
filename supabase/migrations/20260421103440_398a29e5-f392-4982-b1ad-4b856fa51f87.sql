
-- Add 'repost' to notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'repost';
