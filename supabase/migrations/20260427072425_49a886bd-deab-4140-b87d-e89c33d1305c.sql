
DO $$
DECLARE
  _admin_id uuid;
  _keep_ids uuid[];
  _delete_ids uuid[];
BEGIN
  SELECT id INTO _admin_id FROM auth.users
   WHERE email = 'allanchristianbanaag@thelewiscollege.edu.ph'
   LIMIT 1;

  SELECT ARRAY(
    SELECT DISTINCT user_id FROM public.user_nfts
    UNION
    SELECT _admin_id WHERE _admin_id IS NOT NULL
  ) INTO _keep_ids;

  SELECT ARRAY(
    SELECT id FROM auth.users WHERE NOT (id = ANY(_keep_ids))
  ) INTO _delete_ids;

  -- Wipe content of KEEP users (excluding admin)
  DELETE FROM public.posts          WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.post_comments  WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.post_likes     WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.reposts        WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.threads        WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.thread_replies WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.thread_likes   WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.reply_likes    WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.follows        WHERE (follower_id = ANY(_keep_ids) OR following_id = ANY(_keep_ids))
                                      AND follower_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid)
                                      AND following_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.notifications  WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.group_messages WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.group_members  WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.group_join_requests WHERE user_id = ANY(_keep_ids) AND user_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.group_invitations   WHERE (inviter_id = ANY(_keep_ids) OR invitee_id = ANY(_keep_ids))
                                          AND inviter_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid)
                                          AND invitee_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);
  DELETE FROM public.groups WHERE creator_id = ANY(_keep_ids) AND creator_id <> COALESCE(_admin_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Delete content for deleted users
  DELETE FROM public.posts          WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.post_comments  WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.post_likes     WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.reposts        WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.threads        WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.thread_replies WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.thread_likes   WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.reply_likes    WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.follows        WHERE follower_id = ANY(_delete_ids) OR following_id = ANY(_delete_ids);
  DELETE FROM public.notifications  WHERE user_id = ANY(_delete_ids) OR actor_id = ANY(_delete_ids);
  DELETE FROM public.group_messages WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.group_members  WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.group_join_requests WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.group_invitations   WHERE inviter_id = ANY(_delete_ids) OR invitee_id = ANY(_delete_ids);
  DELETE FROM public.groups WHERE creator_id = ANY(_delete_ids);
  DELETE FROM public.organization_posts  WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.organization_members WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.token_transactions  WHERE user_id = ANY(_delete_ids);

  -- Clear assigned_by FK that may reference users about to be deleted
  UPDATE public.user_roles SET assigned_by = NULL
   WHERE assigned_by = ANY(_delete_ids);

  DELETE FROM public.user_roles WHERE user_id = ANY(_delete_ids);
  DELETE FROM public.profiles   WHERE id = ANY(_delete_ids);

  DELETE FROM auth.users WHERE id = ANY(_delete_ids);
END $$;
