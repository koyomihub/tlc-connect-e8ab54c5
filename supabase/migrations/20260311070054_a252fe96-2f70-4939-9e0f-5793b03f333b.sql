
CREATE OR REPLACE FUNCTION public.purchase_nft_atomic(
  _user_id uuid,
  _nft_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nft_item nft_items%ROWTYPE;
  _current_balance integer;
  _new_balance integer;
BEGIN
  -- Lock and fetch NFT item
  SELECT * INTO _nft_item
  FROM nft_items
  WHERE id = _nft_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NFT item not found');
  END IF;

  IF _nft_item.available_supply <= 0 THEN
    RETURN jsonb_build_object('error', 'NFT is sold out');
  END IF;

  -- Lock and fetch user profile
  SELECT token_balance INTO _current_balance
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;

  _current_balance := COALESCE(_current_balance, 0);

  IF _current_balance < _nft_item.price THEN
    RETURN jsonb_build_object('error', 'Insufficient token balance', 'required', _nft_item.price, 'current', _current_balance);
  END IF;

  _new_balance := _current_balance - _nft_item.price;

  -- Deduct tokens
  UPDATE profiles SET token_balance = _new_balance WHERE id = _user_id;

  -- Record NFT ownership
  INSERT INTO user_nfts (user_id, nft_item_id) VALUES (_user_id, _nft_item_id);

  -- Decrement supply
  UPDATE nft_items SET available_supply = available_supply - 1 WHERE id = _nft_item_id;

  -- Record transaction
  INSERT INTO token_transactions (user_id, amount, type, description)
  VALUES (_user_id, -_nft_item.price, 'nft_purchase', 'Purchased ' || _nft_item.name);

  RETURN jsonb_build_object('success', true, 'newBalance', _new_balance, 'nftName', _nft_item.name);
END;
$$;
