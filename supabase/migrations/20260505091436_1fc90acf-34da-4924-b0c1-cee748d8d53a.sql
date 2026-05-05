ALTER TABLE public.token_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.user_nfts REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.token_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_nfts;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;