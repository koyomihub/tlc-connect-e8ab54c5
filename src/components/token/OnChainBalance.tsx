import { useState, useEffect } from 'react';
import { Coins, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { readTlcBalance } from '@/lib/onChainBalance';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function OnChainBalance() {
  const { account } = useWallet();
  const { user } = useAuth();
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOnChainBalance = async () => {
    if (!account) return;
    setLoading(true);
    const bal = await readTlcBalance(account);
    setOnChainBalance(bal);
    setLoading(false);
  };

  // Poll a few times after an on-chain change to allow the tx to be mined.
  const refetchWithRetries = async () => {
    if (!account) return;
    const previous = onChainBalance;
    for (let i = 0; i < 6; i++) {
      const bal = await readTlcBalance(account);
      if (bal !== null) setOnChainBalance(bal);
      if (bal !== null && bal !== previous) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
  };

  useEffect(() => {
    fetchOnChainBalance();
  }, [account]);

  // Auto-refresh on new claim transactions for this user
  useEffect(() => {
    if (!user || !account) return;
    const channel = supabase
      .channel(`onchain-balance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => refetchWithRetries(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, account]);

  if (!account) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10 border border-white/20">
      <Coins className="h-5 w-5 text-yellow-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/60">On-Chain $TLC Balance</p>
        <p className="text-lg font-bold text-white font-mono truncate">
          {loading ? '...' : onChainBalance !== null ? parseFloat(onChainBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={fetchOnChainBalance}
        disabled={loading}
        title="Refresh on-chain balance"
        aria-label="Refresh on-chain balance"
        className="text-white/60 hover:text-white hover:bg-white/10 shrink-0"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
