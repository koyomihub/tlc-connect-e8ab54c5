import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from "https://esm.sh/ethers@6.13.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AMOY_RPC = "https://rpc-amoy.polygon.technology";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
// thirdweb TokenERC1155: passing type(uint256).max signals "mint a NEW tokenId".
const NEW_TOKEN_SENTINEL = (1n << 256n) - 1n;
const TLC_DECIMALS = 18;

const TLC_ABI = [
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// thirdweb ERC1155 mintTo signature
const NFT_ABI = [
  "function mintTo(address to, uint256 tokenId, string uri, uint256 amount)",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const minterPk = Deno.env.get('MINTER_PRIVATE_KEY')!;
    const tlcAddress = Deno.env.get('TLC_CONTRACT_ADDRESS')!;
    const nftAddress = Deno.env.get('NFT_CONTRACT_ADDRESS')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { nftItemId, userWallet } = await req.json();
    if (!nftItemId || typeof nftItemId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid nftItemId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!userWallet || !ethers.isAddress(userWallet)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid userWallet' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enforce one-per-user limit
    const { count: ownedCount } = await supabase
      .from('user_nfts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('nft_item_id', nftItemId);
    if ((ownedCount ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'You have already minted this NFT. Limit 1 per user.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch NFT item
    const { data: nftItem, error: nftErr } = await supabase
      .from('nft_items')
      .select('*')
      .eq('id', nftItemId)
      .single();
    if (nftErr || !nftItem) {
      return new Response(JSON.stringify({ error: 'NFT item not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (nftItem.available_supply <= 0) {
      return new Response(JSON.stringify({ error: 'NFT is sold out' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // On-chain checks: balance + allowance
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);
    const minter = new ethers.Wallet(minterPk, provider);
    const tlc = new ethers.Contract(tlcAddress, TLC_ABI, minter);
    const nft = new ethers.Contract(nftAddress, NFT_ABI, minter);

    const priceWei = ethers.parseUnits(String(nftItem.price), TLC_DECIMALS);
    const userBal: bigint = await tlc.balanceOf(userWallet);
    if (userBal < priceWei) {
      return new Response(JSON.stringify({
        error: 'Insufficient $TLC balance in wallet',
        required: nftItem.price,
        currentWei: userBal.toString(),
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const allowance: bigint = await tlc.allowance(userWallet, minter.address);
    if (allowance < priceWei) {
      return new Response(JSON.stringify({
        needsApproval: true,
        spender: minter.address,
        amount: priceWei.toString(),
        message: 'Approval required',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1) Burn $TLC by transferFrom user -> dead address
    const burnTx = await tlc.transferFrom(userWallet, BURN_ADDRESS, priceWei);
    const burnReceipt = await burnTx.wait();
    if (burnReceipt?.status !== 1) {
      return new Response(JSON.stringify({ error: 'Burn transaction failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Mint NFT to user
    let mintHash: string | null = null;
    try {
      const uri = nftItem.metadata_uri || nftItem.image_url || "";
      const mintTx = await nft.mintTo(userWallet, TOKEN_ID, uri, 1n);
      const mintReceipt = await mintTx.wait();
      if (mintReceipt?.status !== 1) throw new Error('Mint receipt failed');
      mintHash = mintTx.hash;
    } catch (mintErr) {
      console.error('Mint failed AFTER burn — manual refund may be needed:', mintErr);
      return new Response(JSON.stringify({
        error: 'Mint failed after burn. Contact support.',
        burnTx: burnTx.hash,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3) Record ownership + decrement supply (best-effort DB writes)
    await supabase.from('user_nfts').insert({
      user_id: userId,
      nft_item_id: nftItemId,
      transaction_hash: mintHash,
    });
    await supabase
      .from('nft_items')
      .update({ available_supply: nftItem.available_supply - 1 })
      .eq('id', nftItemId);

    return new Response(JSON.stringify({
      success: true,
      burnTx: burnTx.hash,
      mintTx: mintHash,
      nftName: nftItem.name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error purchasing NFT:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Purchase failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
