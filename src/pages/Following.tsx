import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { UserPlus, UserMinus, Search } from 'lucide-react';

interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  is_following?: boolean;
  followers_count?: number;
  following_count?: number;
}

export default function Following() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id);

    if (!profilesData) {
      setLoading(false);
      return;
    }

    // Fetch following status
    const { data: followsData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user?.id);

    const followingIds = new Set(followsData?.map(f => f.following_id) || []);

    // Fetch followers/following counts
    const profilesWithStats = await Promise.all(
      profilesData.map(async (profile) => {
        const { count: followersCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profile.id);

        const { count: followingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profile.id);

        return {
          ...profile,
          is_following: followingIds.has(profile.id),
          followers_count: followersCount || 0,
          following_count: followingCount || 0,
        };
      })
    );

    setProfiles(profilesWithStats);
    setLoading(false);
  };

  const toggleFollow = async (profileId: string, isFollowing: boolean) => {
    if (!user) return;

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId);

      toast({ title: 'Unfollowed' });
    } else {
      await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: profileId,
        });

      toast({ title: 'Following!' });
    }

    fetchProfiles();
  };

  const filteredProfiles = profiles.filter((profile) =>
    profile.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Discover People</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback>
                        {profile.display_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{profile.display_name || 'Anonymous'}</h3>
                      {profile.bio && (
                        <p className="text-muted-foreground mt-1">{profile.bio}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <span>{profile.followers_count} followers</span>
                        <span>{profile.following_count} following</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={profile.is_following ? 'outline' : 'default'}
                    onClick={() => toggleFollow(profile.id, profile.is_following || false)}
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
              </Card>
            ))}

            {filteredProfiles.length === 0 && (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No users found</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
