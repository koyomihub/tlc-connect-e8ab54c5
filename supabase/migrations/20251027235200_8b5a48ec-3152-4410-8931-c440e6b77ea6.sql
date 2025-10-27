-- Drop existing foreign keys that point to auth.users and recreate them to point to public.profiles

-- Posts table
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts
ADD CONSTRAINT posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Threads table
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_user_id_fkey;
ALTER TABLE public.threads
ADD CONSTRAINT threads_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Group members table
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE public.group_members
ADD CONSTRAINT group_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Group messages table
ALTER TABLE public.group_messages DROP CONSTRAINT IF EXISTS group_messages_user_id_fkey;
ALTER TABLE public.group_messages
ADD CONSTRAINT group_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Post likes table
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE public.post_likes
ADD CONSTRAINT post_likes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Thread replies table
ALTER TABLE public.thread_replies DROP CONSTRAINT IF EXISTS thread_replies_user_id_fkey;
ALTER TABLE public.thread_replies
ADD CONSTRAINT thread_replies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Organization posts table
ALTER TABLE public.organization_posts DROP CONSTRAINT IF EXISTS organization_posts_user_id_fkey;
ALTER TABLE public.organization_posts
ADD CONSTRAINT organization_posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Organization members table
ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
ALTER TABLE public.organization_members
ADD CONSTRAINT organization_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Follows table (follower)
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE public.follows
ADD CONSTRAINT follows_follower_id_fkey 
FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Follows table (following)
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE public.follows
ADD CONSTRAINT follows_following_id_fkey 
FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Notifications table (user) - keep the existing one
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Token transactions table
ALTER TABLE public.token_transactions DROP CONSTRAINT IF EXISTS token_transactions_user_id_fkey;
ALTER TABLE public.token_transactions
ADD CONSTRAINT token_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- User NFTs table
ALTER TABLE public.user_nfts DROP CONSTRAINT IF EXISTS user_nfts_user_id_fkey;
ALTER TABLE public.user_nfts
ADD CONSTRAINT user_nfts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- User roles table
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Groups table (creator)
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_creator_id_fkey;
ALTER TABLE public.groups
ADD CONSTRAINT groups_creator_id_fkey 
FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Post comments table (was missing from the list)
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;
ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;