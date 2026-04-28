import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  token_balance: number;
  total_earned: number;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // Get top profiles by token_balance
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, token_balance')
        .order('token_balance', { ascending: false })
        .limit(10);

      if (!profiles) { setLoading(false); return; }

      // For each profile, get total earned
      const enriched = await Promise.all(
        profiles.map(async (p) => {
          const { data: txns } = await supabase
            .from('token_transactions')
            .select('amount')
            .eq('user_id', p.id)
            .gt('amount', 0);
          const total = txns?.reduce((s, t) => s + t.amount, 0) || 0;
          return { ...p, token_balance: p.token_balance || 0, total_earned: total };
        })
      );

      // Sort by total_earned descending
      enriched.sort((a, b) => b.total_earned - a.total_earned);
      setEntries(enriched);
      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Token Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className={`text-lg font-bold w-8 text-center ${i < 3 ? medalColors[i] : 'text-muted-foreground'}`}>
                  #{i + 1}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback>{(entry.display_name || '?')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.display_name || 'Anonymous'}</p>
                    <RoleBadge userId={entry.id} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{entry.total_earned.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">earned</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
