import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ethers } from 'https://esm.sh/ethers@6.13.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const POLYGON_AMOY_RPC = 'https://rpc-amoy.polygon.technology';
const ZERO = '0x0000000000000000000000000000000000000000';

// Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Scan blocks in chunks to respect RPC limits
const CHUNK = 10000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const contractAddress = Deno.env.get('TLC_CONTRACT_ADDRESS')!;

    if (!contractAddress) {
      return json({ error: 'TLC_CONTRACT_ADDRESS not configured' }, 500);
    }

    // Auth: any signed-in user can trigger; this only fills missing tx hashes.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find claims missing tx_hash (across all users)
    const { data: pending, error: pendingErr } = await supabase
      .from('token_transactions')
      .select('id, user_id, amount, description, created_at, wallet_address')
      .eq('type', 'blockchain_claim')
      .is('tx_hash', null)
      .order('created_at', { ascending: true });

    if (pendingErr) return json({ error: pendingErr.message }, 500);
    if (!pending || pending.length === 0) {
      return json({ updated: 0, message: 'No claims need backfill' });
    }

    // Resolve wallet for each claim. Prefer wallet_address column; fall back to
    // parsing the prefix/suffix in `description` and matching against the user's
    // current profile wallet.
    const userIds = Array.from(new Set(pending.map((p) => p.user_id)));
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, wallet_address')
      .in('id', userIds);
    const walletByUser = new Map<string, string | null>(
      (profs || []).map((p: any) => [p.id, p.wallet_address?.toLowerCase() || null]),
    );

    const provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    const iface = new ethers.Interface(TRANSFER_ABI);
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const fromZeroTopic = ethers.zeroPadValue(ZERO, 32);

    const latest = await provider.getBlockNumber();

    // Group pending claims by recipient wallet
    type Pending = typeof pending[number] & { wallet: string };
    const byWallet = new Map<string, Pending[]>();
    for (const row of pending) {
      const w =
        row.wallet_address?.toLowerCase() || walletByUser.get(row.user_id) || null;
      if (!w || !ethers.isAddress(w)) continue;
      const arr = byWallet.get(w) || [];
      arr.push({ ...row, wallet: w });
      byWallet.set(w, arr);
    }

    let updated = 0;

    for (const [wallet, rows] of byWallet) {
      // Fetch all mint Transfers (from = 0x0) to this wallet
      const toTopic = ethers.zeroPadValue(wallet, 32);

      const events: Array<{
        blockNumber: number;
        txHash: string;
        amount: bigint;
        timestamp: number;
        used: boolean;
      }> = [];

      // Scan in chunks from genesis-ish (0) to latest. Amoy is young; this is fine.
      for (let from = 0; from <= latest; from += CHUNK + 1) {
        const to = Math.min(from + CHUNK, latest);
        try {
          const logs = await provider.getLogs({
            address: contractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferTopic, fromZeroTopic, toTopic],
          });
          for (const log of logs) {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (!parsed) continue;
            const value = parsed.args.value as bigint;
            const block = await provider.getBlock(log.blockNumber);
            events.push({
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              amount: value,
              timestamp: (block?.timestamp ?? 0) * 1000,
              used: false,
            });
          }
        } catch (e) {
          console.error(`getLogs failed for ${from}-${to}:`, e);
        }
      }

      // Sort events by block ascending
      events.sort((a, b) => a.blockNumber - b.blockNumber);

      // Sort claims oldest first; match each to nearest unused event with same amount
      const claimsAsc = [...rows].sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      );

      for (const claim of claimsAsc) {
        const claimAmt = ethers.parseUnits(Math.abs(claim.amount).toString(), 18);
        const claimTime = new Date(claim.created_at || 0).getTime();

        // Find unused event with matching amount, closest in time
        let bestIdx = -1;
        let bestDelta = Number.POSITIVE_INFINITY;
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.used) continue;
          if (e.amount !== claimAmt) continue;
          const delta = Math.abs(e.timestamp - claimTime);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) continue;
        const ev = events[bestIdx];
        ev.used = true;

        const { error: updErr } = await supabase
          .from('token_transactions')
          .update({ tx_hash: ev.txHash, wallet_address: wallet })
          .eq('id', claim.id);
        if (!updErr) updated += 1;
      }
    }

    return json({ updated, scanned: pending.length, latestBlock: latest });
  } catch (error) {
    console.error('backfill error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
