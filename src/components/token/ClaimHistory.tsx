import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ArrowDownToLine, Clock, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';

const AMOY_TX_EXPLORER = 'https://amoy.polygonscan.com/tx/';
const AMOY_ADDRESS_EXPLORER = 'https://amoy.polygonscan.com/address/';
// TLC token contract on Polygon Amoy. Used to link to token-transfer history
// when a row's specific tx hash isn't recorded yet.
const TLC_TOKEN_ADDRESS = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';

interface ClaimTransaction {
  id: string;
  amount: number;
  description: string | null;
  created_at: string | null;
  tx_hash: string | null;
  wallet_address: string | null;
}

export function ClaimHistory() {
  const { user } = useAuth();
  const { account } = useWallet();
  const [claims, setClaims] = useState<ClaimTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchClaims = async () => {
      setLoading(true);

      // Base query: this user's blockchain claims
      let query = supabase
        .from('token_transactions')
        .select('id, amount, description, created_at, tx_hash, wallet_address')
        .eq('user_id', user.id)
        .eq('type', 'blockchain_claim')
        .order('created_at', { ascending: false })
        .limit(50);

      // If a wallet is connected, scope to that wallet so the history follows
      // the connected account. Older claims (no wallet_address column value)
      // are matched by their description, which embeds the wallet address.
      if (account) {
        const short = `${account.slice(0, 6)}...${account.slice(-4)}`;
        query = query.or(
          `wallet_address.ilike.${account},description.ilike.%${short}%`,
        );
      }

      const { data } = await query;
      if (cancelled) return;
      setClaims((data as ClaimTransaction[]) || []);
      setLoading(false);
    };

    fetchClaims();

    // Refresh on new claims for this user
    const channel = supabase
      .channel(`claim-history-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchClaims(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, account]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            Blockchain Claim History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted/30 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            Blockchain Claim History
          </span>
          {account && (
            <a
              href={`${AMOY_ADDRESS_EXPLORER}${account}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-normal text-muted-foreground hover:text-primary inline-flex items-center gap-1"
              title="View this wallet on PolygonScan"
            >
              <Wallet className="h-3.5 w-3.5" />
              {account.slice(0, 6)}…{account.slice(-4)}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!account && (
          <p className="text-xs text-muted-foreground mb-3">
            Connect your wallet to see claims linked to it.
          </p>
        )}
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {account
              ? 'No blockchain claims for this wallet yet.'
              : 'No blockchain claims yet. Collect tokens and claim them to your wallet!'}
          </p>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                    <ArrowDownToLine className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Claimed {Math.abs(claim.amount)} $TLC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(claim.created_at)}
                    </p>
                    {claim.tx_hash ? (
                      <a
                        href={`${AMOY_TX_EXPLORER}${claim.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                        title="View transaction on PolygonScan"
                      >
                        Tx {shortHash(claim.tx_hash)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : claim.wallet_address || account ? (
                      <a
                        href={`${AMOY_ADDRESS_EXPLORER}${claim.wallet_address || account}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                        title="Transaction hash not stored — view wallet on PolygonScan"
                      >
                        View on PolygonScan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline" className="text-success border-success/30">
                  Minted
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
