import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Coins, TrendingUp, Award, Users, Heart, MessageCircle, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from '@/hooks/use-toast';

interface TokenStats {
  balance: number;
  earnedToday: number;
  totalEarned: number;
  rank: number;
}

interface EarnActivity {
  type: string;
  points: number;
  description: string;
  icon: any;
}

export default function Earn() {
  const { user } = useAuth();
  const { account, connectWallet, claimTokens } = useWallet();
  const [stats, setStats] = useState<TokenStats>({
    balance: 0,
    earnedToday: 0,
    totalEarned: 0,
    rank: 0,
  });
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenStats();
  }, [user]);

  const fetchTokenStats = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayTransactions } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());

    const earnedToday = todayTransactions?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) || 0;

    const { data: allTransactions } = await supabase
      .from('token_transactions')
      .select('amount')
      .eq('user_id', user.id);

    const totalEarned = allTransactions?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) || 0;

    setStats({
      balance: profile?.token_balance || 0,
      earnedToday,
      totalEarned,
      rank: Math.floor(Math.random() * 100) + 1,
    });
    setLoading(false);
  };

  const handleClaimTokens = async () => {
    if (stats.balance === 0) {
      toast({
        title: "No tokens to claim",
        description: "Earn tokens by interacting with posts",
        variant: "destructive",
      });
      return;
    }

    setClaiming(true);
    const success = await claimTokens(stats.balance);
    
    if (success) {
      fetchTokenStats();
    }
    setClaiming(false);
  };

  const activities: EarnActivity[] = [
    {
      type: 'Post',
      points: 10,
      description: 'Share a post on your feed',
      icon: MessageCircle,
    },
    {
      type: 'Get Likes',
      points: 5,
      description: 'Receive likes from others (not your own)',
      icon: Heart,
    },
    {
      type: 'Comment',
      points: 3,
      description: 'Engage with others\' posts',
      icon: MessageCircle,
    },
    {
      type: 'Join Group',
      points: 20,
      description: 'Become a member of a group',
      icon: Users,
    },
    {
      type: 'Daily Login',
      points: 5,
      description: 'Log in every day to earn',
      icon: Award,
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            Earn Tokens
          </h1>
          <p className="text-muted-foreground mt-1">
            Participate in the community and earn TLC tokens
          </p>
        </div>

        <Card className="shadow-lg bg-gradient-accent">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Coins className="h-6 w-6 mr-2" />
              Your Token Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-6xl font-bold text-white animate-pulse-glow">
                {stats.balance.toLocaleString()}
              </div>
              <div className="text-white/80 mt-2">TLC Tokens</div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  +{stats.earnedToday}
                </div>
                <div className="text-sm text-white/70">Today</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {stats.totalEarned.toLocaleString()}
                </div>
                <div className="text-sm text-white/70">Total Earned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  #{stats.rank}
                </div>
                <div className="text-sm text-white/70">Rank</div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/20">
              {!account ? (
                <Button 
                  onClick={connectWallet} 
                  variant="secondary"
                  className="w-full"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Wallet to Claim
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white/80 font-mono text-center">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                  <Button 
                    onClick={handleClaimTokens}
                    disabled={claiming || stats.balance === 0}
                    variant="secondary"
                    className="w-full"
                  >
                    Claim to Wallet
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-success" />
              Daily Goal Progress
            </CardTitle>
            <CardDescription>
              Earn 100 tokens today to complete your daily goal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.earnedToday} / 100 tokens</span>
                <span>{Math.min(100, (stats.earnedToday / 100) * 100).toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(100, (stats.earnedToday / 100) * 100)} className="h-3" />
            </div>
          </CardContent>
        </Card>

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
                      <Badge variant="secondary" className="text-lg font-bold">
                        +{activity.points}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold mb-1">{activity.type}</h3>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">Important</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• You cannot earn tokens by liking your own posts</p>
            <p>• Each like from another user counts only once (no duplicates)</p>
            <p>• Unliking a post does not reduce your earned tokens</p>
            <p>• Connect your wallet to claim tokens on the Polygon blockchain</p>
            <p>• Tokens can be used in the Rewards store to purchase NFTs</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
