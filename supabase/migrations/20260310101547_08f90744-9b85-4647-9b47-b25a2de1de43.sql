-- Add INSERT policy for user_nfts so the purchase-nft edge function (service_role) can insert,
-- and also allow authenticated users to see the policy exists for their own records
CREATE POLICY "Users can purchase NFTs"
ON public.user_nfts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);