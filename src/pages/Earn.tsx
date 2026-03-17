import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Coins, TrendingUp, Award, Users, Heart, MessageCircle, Wallet, WalletCards, Unplug } from 'lucide-react';
import { ClaimHistory } from '@/components/earn/ClaimHistory';
import { OnChainBalance } from '@/components/earn/OnChainBalance';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from '@/hooks/use-toast';

const DAILY_LIMIT = 100;

interface TokenStats {
  balance: number;
  earnedToday: number;
  totalEarned: number;
  rank: number;
}

export default function Earn() {
  const { user } = useAuth();
  const { account, connectWallet, disconnectWallet, claimTokens, connecting } = useWallet();
  const [stats, setStats] = useState<TokenStats>({ balance: 0, earnedToday: 0, totalEarned: 0, rank: 0 });
  const [claiming, setClaiming] = useState(false);
  const [claimingLogin, setClaimingLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTokenStats = useCallback(async () => {
    if (!user) return;

    const [profileRes, todayRes, allRes, rankRes] = await Promise.all([
      supabase.from('profiles').select('token_balance').eq('id', user.id).single(),
      supabase.from('token_transactions').select('amount').eq('user_id', user.id)
        .gt('amount', 0)
        .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
      supabase.from('token_transactions').select('amount').eq('user_id', user.id).gt('amount', 0),
      supabase.from('profiles').select('id').order('token_balance', { ascending: false }),
    ]);

    const earnedToday = todayRes.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const totalEarned = allRes.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const rankIndex = rankRes.data?.findIndex(p => p.id === user.id) ?? -1;

    setStats({
      balance: profileRes.data?.token_balance || 0,
      earnedToday,
      totalEarned,
      rank: rankIndex >= 0 ? rankIndex + 1 : 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTokenStats();

    // Subscribe to real-time balance changes
    if (!user) return;
    const channel = supabase
      .channel('token-balance')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new && 'token_balance' in payload.new) {
            setStats(prev => ({ ...prev, balance: payload.new.token_balance as number }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTokenStats]);

  const awardTokens = async (amount: number, type: string, description: string, postId?: string) => {
    if (!user) return false;

    try {
      const body: any = { userId: user.id, amount, type, description };
      if (postId) body.postId = postId;

      const { data, error } = await supabase.functions.invoke('award-tokens', { body });

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return false;
      }

      if (data?.error) {
        toast({ title: 'Cannot earn tokens', description: data.error, variant: 'destructive' });
        return false;
      }

      await fetchTokenStats();
      return true;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const handleClaimDailyLogin = async () => {
    if (!user) return;
    setClaimingLogin(true);

    // Check if already claimed today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from('token_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'daily_login')
      .gte('created_at', today.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      toast({ title: 'Already claimed', description: 'You already claimed your daily login bonus today' });
      setClaimingLogin(false);
      return;
    }

    const success = await awardTokens(5, 'daily_login', 'Daily login bonus');
    if (success) {
      toast({ title: '+5 Tokens!', description: 'Daily login bonus claimed' });
    }
    setClaimingLogin(false);
  };

  const handleClaimToWallet = async () => {
    if (stats.balance === 0) {
      toast({ title: 'No tokens to claim', description: 'Earn tokens by interacting with posts', variant: 'destructive' });
      return;
    }
    setClaiming(true);
    const success = await claimTokens(stats.balance);
    if (success) await fetchTokenStats();
    setClaiming(false);
  };

  const dailyProgress = Math.min(100, (stats.earnedToday / DAILY_LIMIT) * 100);
  const remaining = Math.max(0, DAILY_LIMIT - stats.earnedToday);

  const activities = [
    { type: 'Post', points: 10, description: 'Share a post on your feed', icon: MessageCircle },
    { type: 'Get Likes', points: 5, description: 'Receive likes from others (not your own)', icon: Heart },
    { type: 'Comment', points: 3, description: "Engage with others' posts", icon: MessageCircle },
    { type: 'Join Group', points: 20, description: 'Become a member of a group', icon: Users },
    { type: 'Daily Login', points: 5, description: 'Log in every day to earn', icon: Award, action: handleClaimDailyLogin, loading: claimingLogin },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-accent bg-clip-text text-transparent">Earn Tokens</h1>
          <p className="text-muted-foreground mt-1">Participate in the community and earn TLC tokens</p>
        </div>

        {/* Balance Card */}
        <Card className="shadow-lg bg-gradient-accent">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Coins className="h-6 w-6 mr-2" />
              Your Token Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-6xl font-bold text-white animate-pulse-glow">{stats.balance.toLocaleString()}</div>
              <div className="text-white/80 mt-2">TLC Tokens</div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">+{stats.earnedToday}</div>
                <div className="text-sm text-white/70">Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.totalEarned.toLocaleString()}</div>
                <div className="text-sm text-white/70">Total Earned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">#{stats.rank || '—'}</div>
                <div className="text-sm text-white/70">Rank</div>
              </div>
            </div>

            {/* Wallet Section */}
            <div className="pt-4 border-t border-white/20 space-y-2">
              {!account ? (
                <Button onClick={connectWallet} disabled={connecting} variant="secondary" className="w-full">
                  <Wallet className="h-4 w-4 mr-2" />
                  {connecting ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/80 font-mono">{account.slice(0, 6)}...{account.slice(-4)}</p>
                    <Button onClick={disconnectWallet} variant="ghost" size="sm" className="text-white/70 hover:text-white">
                      <Unplug className="h-4 w-4 mr-1" /> Disconnect
                    </Button>
                  </div>
                  <Button onClick={handleClaimToWallet} disabled={claiming || stats.balance === 0} variant="secondary" className="w-full">
                    <WalletCards className="h-4 w-4 mr-2" />
                    {claiming ? 'Claiming...' : 'Claim to Wallet'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Daily Progress */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-success" />
              Daily Goal Progress
            </CardTitle>
            <CardDescription>
              {remaining > 0 ? `Earn ${remaining} more tokens to hit today's limit` : "You've reached today's 100-token limit!"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.earnedToday} / {DAILY_LIMIT} tokens</span>
                <span>{dailyProgress.toFixed(0)}%</span>
              </div>
              <Progress value={dailyProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Earning Methods */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Ways to Earn Tokens</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((activity) => {
              const Icon = activity.icon;
              return (
                <Card key={activity.type} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-success" />
                      </div>
                      <Badge variant="secondary" className="text-lg font-bold">+{activity.points}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold mb-1">{activity.type}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{activity.description}</p>
                    {activity.action && (
                      <Button size="sm" onClick={activity.action} disabled={activity.loading || stats.earnedToday >= DAILY_LIMIT} className="w-full">
                        {activity.loading ? 'Claiming...' : 'Claim'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">Important</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• Maximum {DAILY_LIMIT} tokens can be earned per day across all methods</p>
            <p>• You cannot earn tokens by liking your own posts</p>
            <p>• Each like from another user counts only once (no duplicates)</p>
            <p>• Unliking a post does not reduce your earned tokens</p>
            <p>• Connect your wallet to claim tokens on the blockchain</p>
            <p>• Tokens can be used in the Rewards store to purchase NFTs</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
