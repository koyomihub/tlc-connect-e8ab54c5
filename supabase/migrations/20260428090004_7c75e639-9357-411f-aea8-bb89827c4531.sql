
CREATE TABLE IF NOT EXISTS public.group_last_seen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  group_id uuid NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);
ALTER TABLE public.group_last_seen ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view their own group last seen" ON public.group_last_seen FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert their own group last seen" ON public.group_last_seen FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update their own group last seen" ON public.group_last_seen FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete their own group last seen" ON public.group_last_seen FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.org_last_seen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
ALTER TABLE public.org_last_seen ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view their own org last seen" ON public.org_last_seen FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users insert their own org last seen" ON public.org_last_seen FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update their own org last seen" ON public.org_last_seen FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete their own org last seen" ON public.org_last_seen FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS presence_preference text NOT NULL DEFAULT 'auto';

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
