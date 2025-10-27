-- Add privacy field to groups table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' AND column_name = 'privacy'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN privacy text DEFAULT 'public' CHECK (privacy IN ('public', 'private'));
  END IF;
END $$;

-- Create follows count functions
CREATE OR REPLACE FUNCTION get_follower_count(profile_id uuid)
RETURNS bigint AS $$
  SELECT COUNT(*) FROM follows WHERE following_id = profile_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_following_count(profile_id uuid)
RETURNS bigint AS $$
  SELECT COUNT(*) FROM follows WHERE follower_id = profile_id;
$$ LANGUAGE sql STABLE;

-- Make johndoe@thelewiscollege.edu.ph an admin
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'johndoe@thelewiscollege.edu.ph' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin');
  END IF;
END $$;