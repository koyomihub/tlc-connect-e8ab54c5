ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS wallet_address text;

CREATE INDEX IF NOT EXISTS idx_token_transactions_wallet_lower
  ON public.token_transactions (lower(wallet_address));