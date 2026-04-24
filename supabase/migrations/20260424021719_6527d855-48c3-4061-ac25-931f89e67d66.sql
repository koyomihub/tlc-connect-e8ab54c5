INSERT INTO public.nft_items (name, description, image_url, price, total_supply, available_supply)
SELECT
  '$TLC NFT #' || LPAD(i::text, 3, '0'),
  'Exclusive test NFT minted on the TLC Network. Burn $TLC tokens to mint this collectible blockchain asset.',
  'https://nqeqggozwpagsatwgxdq.supabase.co/storage/v1/object/public/nfts/tlc-test-nft.png',
  50,
  1,
  1
FROM generate_series(1, 100) AS i;