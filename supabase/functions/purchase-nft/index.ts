import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from "https://esm.sh/ethers@6.13.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AMOY_RPC = "https://rpc-amoy.polygon.technology";
const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
const NATIVE_POL_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const NEW_TOKEN_SENTINEL = (1n << 256n) - 1n;
const TLC_DECIMALS = 18;

const TLC_ABI = [
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const NFT_ABI = [
  "function mintTo(address to, uint256 tokenId, string uri, uint256 amount)",
  "function getClaimConditionById(uint256 tokenId, uint256 conditionId) view returns (tuple(uint256 startTimestamp,uint256 maxClaimableSupply,uint256 supplyClaimed,uint256 quantityLimitPerWallet,uint256 merkleRoot,uint256 pricePerToken,address currency,string metadata))",
  "function claim(address receiver,uint256 tokenId,uint256 quantity,address currency,uint256 pricePerToken,(bytes32[] proof,uint256 quantityLimitPerWallet,uint256 pricePerToken,address currency) allowlistProof,bytes data) payable",
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
    const defaultNftAddress = Deno.env.get('NFT_CONTRACT_ADDRESS')!;

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

    // On-chain checks: balance + allowance + NFT preflight
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);
    const minter = new ethers.Wallet(minterPk, provider);
    const tlc = new ethers.Contract(tlcAddress, TLC_ABI, minter);
    const nftContractAddress = nftItem.contract_address || defaultNftAddress;
    const nft = new ethers.Contract(nftContractAddress, NFT_ABI, minter);

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

    const claimTokenId = nftItem.token_id ? BigInt(nftItem.token_id) : 0n;
    const uri = nftItem.metadata_uri || nftItem.image_url || "";
    if (!uri) {
      return new Response(JSON.stringify({
        error: 'NFT metadata URI is missing. Set metadata_uri or image_url on the NFT item before minting.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let mintMode: 'drop-claim' | 'direct-mint' = 'direct-mint';
    let claimCondition:
      | {
          startTimestamp: bigint;
          maxClaimableSupply: bigint;
          supplyClaimed: bigint;
          quantityLimitPerWallet: bigint;
          merkleRoot: bigint;
          pricePerToken: bigint;
          currency: string;
          metadata: string;
        }
      | null = null;

    try {
      claimCondition = await nft.getClaimConditionById(claimTokenId, 0n);
      mintMode = 'drop-claim';
    } catch {
      mintMode = 'direct-mint';
    }

    try {
      if (mintMode === 'drop-claim' && claimCondition) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (claimCondition.startTimestamp > now) {
          return new Response(JSON.stringify({
            error: 'NFT claim is not active yet on-chain.',
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const remainingSupply = claimCondition.maxClaimableSupply - claimCondition.supplyClaimed;
        if (remainingSupply < 1n) {
          return new Response(JSON.stringify({
            error: 'NFT is sold out on-chain.',
          }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const claimUsesNativePol = claimCondition.currency.toLowerCase() === NATIVE_POL_ADDRESS.toLowerCase();

        if (claimCondition.pricePerToken > 0n) {
          if (!claimUsesNativePol) {
            return new Response(JSON.stringify({
              error: 'This NFT collection requires an unsupported on-chain payment token for claim().',
              details: {
                contractType: 'DropERC1155',
                nftContractAddress,
                tokenId: claimTokenId.toString(),
                claimPriceWei: claimCondition.pricePerToken.toString(),
                claimCurrency: claimCondition.currency,
                ownerWallet: minter.address,
                reason: 'Only native POL paid claims are supported by this mint flow.',
              },
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          const ownerPolBalance = await provider.getBalance(minter.address);
          if (ownerPolBalance < claimCondition.pricePerToken) {
            return new Response(JSON.stringify({
              error: 'The owner wallet does not have enough POL to pay the on-chain claim price.',
              details: {
                contractType: 'DropERC1155',
                nftContractAddress,
                tokenId: claimTokenId.toString(),
                claimPriceWei: claimCondition.pricePerToken.toString(),
                claimPricePol: ethers.formatEther(claimCondition.pricePerToken),
                claimCurrency: claimCondition.currency,
                ownerWallet: minter.address,
                ownerPolBalance: ethers.formatEther(ownerPolBalance),
                reason: 'The contract requires native POL for claim(), and the owner wallet balance is too low.',
              },
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        if (claimUsesNativePol && claimCondition.pricePerToken > 0n) {
          await nft.claim.estimateGas(
            userWallet,
            claimTokenId,
            1n,
            claimCondition.currency,
            claimCondition.pricePerToken,
            { proof: [], quantityLimitPerWallet: 0n, pricePerToken: claimCondition.pricePerToken, currency: claimCondition.currency },
            '0x',
            { value: claimCondition.pricePerToken },
          );
        } else {
          await nft.claim.estimateGas(
            userWallet,
            claimTokenId,
            1n,
            claimCondition.currency,
            claimCondition.pricePerToken,
            { proof: [], quantityLimitPerWallet: 0n, pricePerToken: claimCondition.pricePerToken, currency: claimCondition.currency },
            '0x',
          );
        }
      } else {
        await nft.mintTo.estimateGas(userWallet, NEW_TOKEN_SENTINEL, uri, 1n);
      }
    } catch (preflightErr) {
      console.error('NFT preflight failed before burn:', preflightErr);
      return new Response(JSON.stringify({
        error: 'NFT contract mint is not ready. Minting was stopped before any $TLC was burned.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1) MINT FIRST — if this reverts, no TLC is touched.
    let mintHash: string | null = null;
    let mintTx;
    try {
      if (mintMode === 'drop-claim' && claimCondition) {
        mintTx = await nft.claim(
          userWallet,
          claimTokenId,
          1n,
          claimCondition.currency,
          claimCondition.pricePerToken,
          { proof: [], quantityLimitPerWallet: 0n, pricePerToken: claimCondition.pricePerToken, currency: claimCondition.currency },
          '0x',
        );
      } else {
        mintTx = await nft.mintTo(userWallet, NEW_TOKEN_SENTINEL, uri, 1n);
      }
      const mintReceipt = await mintTx.wait();
      if (mintReceipt?.status !== 1) throw new Error('Mint reverted on-chain');
      mintHash = mintTx.hash;
    } catch (mintErr) {
      console.error('Mint failed BEFORE burn (no TLC lost):', mintErr);
      return new Response(JSON.stringify({
        error: 'NFT mint failed on-chain. No $TLC was charged. ' + ((mintErr as Error).message || ''),
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2) BURN $TLC AFTER successful mint. If burn fails here, the user got the NFT for free
    //    but our preflight already verified balance + allowance, so this should not fail.
    let burnHash: string | null = null;
    try {
      const burnTx = await tlc.transferFrom(userWallet, BURN_ADDRESS, priceWei);
      const burnReceipt = await burnTx.wait();
      if (burnReceipt?.status !== 1) throw new Error('Burn reverted');
      burnHash = burnTx.hash;
    } catch (burnErr) {
      console.error('Burn failed AFTER successful mint:', burnErr);
      // NFT already minted; record it but flag the burn issue
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
      burnTx: burnHash,
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
