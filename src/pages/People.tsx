import { useState, useEffect } from 'react';
import { RoleBadge } from '@/components/RoleBadge';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { Search, UserPlus, UserMinus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  follower_count: number;
  following_count: number;
  is_following: boolean;
}

export default function People() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, bio')
        .neq('id', user?.id);

      if (profileError) throw profileError;

      const usersWithFollowData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: followerData } = await supabase
            .from('follows')
            .select('id', { count: 'exact' })
            .eq('following_id', profile.id);

          const { data: followingData } = await supabase
            .from('follows')
            .select('id', { count: 'exact' })
            .eq('follower_id', profile.id);

          const { data: isFollowingData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', user?.id)
            .eq('following_id', profile.id)
            .single();

          return {
            ...profile,
            follower_count: followerData?.length || 0,
            following_count: followingData?.length || 0,
            is_following: !!isFollowingData,
          };
        })
      );

      setUsers(usersWithFollowData);
    } catch (error: any) {
      toast({
        title: 'Error fetching users',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (userId: string, currentlyFollowing: boolean) => {
    if (!user) return;

    try {
      if (currentlyFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        toast({ title: 'Unfollowed user' });
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        toast({ title: 'Following user' });
      }

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center bg-gradient-primary bg-clip-text text-transparent">
              <Users className="h-8 w-8 mr-2 text-primary" />
              People
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover and connect with others
            </p>
          </div>
        </div>

        <div className="relative">
          <Input
            type="search"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((profile) => (
              <Card key={profile.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex items-center space-x-3 flex-1 cursor-pointer"
                      onClick={() => navigate(`/profile/${profile.id}`)}
                    >
                      <span className="relative inline-block shrink-0">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile.avatar_url} />
                          <AvatarFallback>
                            {profile.display_name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceIndicator userId={profile.id} size="md" asDot />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold hover:text-primary transition-colors">
                            {profile.display_name}
                          </h3>
                          <RoleBadge userId={profile.id} />
                        </div>
                        {profile.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {profile.bio}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {profile.follower_count} followers · {profile.following_count} following
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={profile.is_following ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => toggleFollow(profile.id, profile.is_following)}
                    >
                      {profile.is_following ? (
                        <>
                          <UserMinus className="mr-2 h-4 w-4" />
                          Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Follow
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No users found matching your search.' : 'No users to display.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
