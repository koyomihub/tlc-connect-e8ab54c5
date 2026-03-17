import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ArrowDownToLine, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const AMOY_EXPLORER = 'https://amoy.polygonscan.com/tx/';

interface ClaimTransaction {
  id: string;
  amount: number;
  description: string | null;
  created_at: string | null;
}

export function ClaimHistory() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchClaims = async () => {
      const { data } = await supabase
        .from('token_transactions')
        .select('id, amount, description, created_at')
        .eq('user_id', user.id)
        .eq('type', 'blockchain_claim')
        .order('created_at', { ascending: false })
        .limit(20);

      setClaims(data || []);
      setLoading(false);
    };

    fetchClaims();
  }, [user]);

  const extractTxHash = (description: string | null): string | null => {
    // The description contains wallet info but not tx hash directly.
    // We'll show what we have.
    return null;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            Claim History
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
        <CardTitle className="flex items-center">
          <Clock className="h-5 w-5 mr-2 text-primary" />
          Blockchain Claim History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No blockchain claims yet. Earn tokens and claim them to your wallet!
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
                    <p className="text-xs text-muted-foreground">{formatDate(claim.created_at)}</p>
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
