-- Fix notifications table to reference profiles instead of auth.users for actor_id
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_actor_id_fkey 
FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;