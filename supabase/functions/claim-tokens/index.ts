import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@6.13.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ERC20_MINT_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
];

const POLYGON_AMOY_RPC = 'https://rpc-amoy.polygon.technology';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const contractAddress = Deno.env.get('TLC_CONTRACT_ADDRESS')!;
    const minterPrivateKey = Deno.env.get('MINTER_PRIVATE_KEY')!;

    if (!contractAddress || !minterPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'Blockchain configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { walletAddress, amount: requestedAmount } = await req.json();

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional explicit amount; if omitted, claim full balance
    let parsedAmount: number | null = null;
    if (requestedAmount !== undefined && requestedAmount !== null) {
      parsedAmount = Number(requestedAmount);
      if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid claim amount — must be a positive whole number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get user's current token balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('token_balance, wallet_address')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify wallet matches profile
    if (profile.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Wallet address does not match your profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const availableBalance = profile.token_balance || 0;
    if (availableBalance <= 0) {
      return new Response(
        JSON.stringify({ error: 'No tokens to claim' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claimAmount = parsedAmount ?? availableBalance;
    if (claimAmount > availableBalance) {
      return new Response(
        JSON.stringify({ error: `Requested ${claimAmount} but only ${availableBalance} available` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mint tokens on-chain (1 off-chain point = 1 TLC token with 18 decimals)
    const provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    const minterWallet = new ethers.Wallet(minterPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, ERC20_MINT_ABI, minterWallet);

    const mintAmount = ethers.parseUnits(claimAmount.toString(), 18);

    console.log(`Minting ${claimAmount} TLC to ${walletAddress}...`);
    const tx = await contract.mint(walletAddress, mintAmount);
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

    // Deduct claimed amount from profile (preserve any leftover)
    const newBalance = availableBalance - claimAmount;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ token_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error('Balance update error (tokens already minted!):', updateError);
    }

    // Record transaction
    await supabase.from('token_transactions').insert({
      user_id: userId,
      amount: -claimAmount,
      type: 'blockchain_claim',
      description: `Claimed ${claimAmount} TLC to wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        txHash: tx.hash,
        amount: claimAmount,
        walletAddress,
        blockNumber: receipt.blockNumber,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Claim tokens error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred processing your claim';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
