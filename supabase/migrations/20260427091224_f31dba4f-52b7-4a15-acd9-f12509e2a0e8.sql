UPDATE auth.identities
SET identity_data = identity_data || jsonb_build_object('email', 'fedelynfullente@thelewiscollege.edu.ph'),
    updated_at = now()
WHERE provider = 'email'
  AND lower(identity_data->>'email') = 'frelaventef18@gmail.com';

UPDATE auth.users
SET email = 'fedelynfullente@thelewiscollege.edu.ph',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', 'fedelynfullente@thelewiscollege.edu.ph'),
    updated_at = now()
WHERE lower(email) = 'frelaventef18@gmail.com';