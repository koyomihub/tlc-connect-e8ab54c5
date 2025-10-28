-- Add thread likes table
CREATE TABLE IF NOT EXISTS public.thread_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE public.thread_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread likes are viewable by everyone"
ON public.thread_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like threads"
ON public.thread_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike threads"
ON public.thread_likes FOR DELETE
USING (auth.uid() = user_id);

-- Add reply likes table
CREATE TABLE IF NOT EXISTS public.reply_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id UUID NOT NULL REFERENCES public.thread_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

ALTER TABLE public.reply_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reply likes are viewable by everyone"
ON public.reply_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like replies"
ON public.reply_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike replies"
ON public.reply_likes FOR DELETE
USING (auth.uid() = user_id);

-- Add thread views tracking table
CREATE TABLE IF NOT EXISTS public.thread_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE public.thread_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread views are viewable by everyone"
ON public.thread_views FOR SELECT
USING (true);

CREATE POLICY "Anyone can record a view"
ON public.thread_views FOR INSERT
WITH CHECK (true);

-- Add reposts table
CREATE TABLE IF NOT EXISTS public.reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts are viewable by everyone"
ON public.reposts FOR SELECT
USING (true);

CREATE POLICY "Users can create reposts"
ON public.reposts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their reposts"
ON public.reposts FOR DELETE
USING (auth.uid() = user_id);

-- Add group invitations table
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, invitee_id)
);

ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invitations"
ON public.group_invitations FOR SELECT
USING (auth.uid() = invitee_id OR auth.uid() = inviter_id);

CREATE POLICY "Group admins can send invitations"
ON public.group_invitations FOR INSERT
WITH CHECK (
  auth.uid() = inviter_id AND
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = group_invitations.group_id
    AND user_id = auth.uid()
    AND is_admin = true
  )
);

CREATE POLICY "Users can update their own invitations"
ON public.group_invitations FOR UPDATE
USING (auth.uid() = invitee_id);

-- Add likes_count to threads
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Add likes_count to thread_replies
ALTER TABLE public.thread_replies ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Function to update thread likes count
CREATE OR REPLACE FUNCTION public.update_thread_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.threads
    SET likes_count = likes_count + 1
    WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.threads
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
END;
$$;

-- Trigger for thread likes
DROP TRIGGER IF EXISTS thread_likes_count_trigger ON public.thread_likes;
CREATE TRIGGER thread_likes_count_trigger
AFTER INSERT OR DELETE ON public.thread_likes
FOR EACH ROW EXECUTE FUNCTION public.update_thread_likes_count();

-- Function to update reply likes count
CREATE OR REPLACE FUNCTION public.update_reply_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.thread_replies
    SET likes_count = likes_count + 1
    WHERE id = NEW.reply_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.thread_replies
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.reply_id;
    RETURN OLD;
  END IF;
END;
$$;

-- Trigger for reply likes
DROP TRIGGER IF EXISTS reply_likes_count_trigger ON public.reply_likes;
CREATE TRIGGER reply_likes_count_trigger
AFTER INSERT OR DELETE ON public.reply_likes
FOR EACH ROW EXECUTE FUNCTION public.update_reply_likes_count();

-- Seed default organizations
INSERT INTO public.organizations (name, description) VALUES
  ('The Student Council', 'Official student government body representing all students'),
  ('Computer Society', 'For students interested in technology, programming, and innovation'),
  ('Young Businessman Club', 'Developing entrepreneurial skills and business acumen'),
  ('Future Educators Club', 'Supporting aspiring teachers and education advocates'),
  ('The Lewisian', 'Official student publication and journalism club')
ON CONFLICT DO NOTHING;