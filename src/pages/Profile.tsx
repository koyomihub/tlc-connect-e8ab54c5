import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Wallet, Coins, Repeat2, Heart, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { PostImageCarousel } from '@/components/feed/PostImageCarousel';

export default function Profile() {
  const { user } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  
  // Determine which profile to show
  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userThreads, setUserThreads] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [userReposts, setUserReposts] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    wallet_address: '',
  });

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchUserStats();
      fetchFollowCounts();
      if (!isOwnProfile && user) {
        checkFollowStatus();
      }
    }
  }, [profileId, user]);

  const fetchProfile = async () => {
    if (!profileId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (data) {
      setProfile(data);
      if (isOwnProfile) {
        setFormData({
          display_name: data.display_name || '',
          bio: data.bio || '',
          wallet_address: data.wallet_address || '',
        });
      }
    }
  };

  const fetchFollowCounts = async () => {
    if (!profileId) return;
    const { data: followers } = await supabase
      .from('follows')
      .select('id', { count: 'exact' })
      .eq('following_id', profileId);
    setFollowerCount(followers?.length || 0);

    const { data: following } = await supabase
      .from('follows')
      .select('id', { count: 'exact' })
      .eq('follower_id', profileId);
    setFollowingCount(following?.length || 0);
  };

  const checkFollowStatus = async () => {
    if (!user || !profileId) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profileId)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!user || !profileId) return;
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId);
      setIsFollowing(false);
      setFollowerCount(prev => Math.max(0, prev - 1));
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: profileId,
      });
      setIsFollowing(true);
      setFollowerCount(prev => prev + 1);
    }
  };

  const fetchUserStats = async () => {
    if (!profileId) return;

    const { data: posts } = await supabase
      .from('posts')
      .select(`*, profiles!posts_user_id_fkey(display_name, avatar_url)`)
      .eq('user_id', profileId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(10);
    setUserPosts(posts || []);

    const { data: reposts } = await supabase
      .from('reposts')
      .select(`*, posts(*, profiles!posts_user_id_fkey(display_name, avatar_url))`)
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(5);
    setUserReposts(reposts || []);

    const { data: threads } = await supabase
      .from('threads')
      .select('*')
      .eq('user_id', profileId);
    setUserThreads(threads || []);

    const { data: memberGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', profileId);
    setUserGroups(memberGroups || []);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    if (!isOwnProfile) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${type}-${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const updateField = type === 'avatar' ? 'avatar_url' : 'cover_photo_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setProfile((prev: any) => ({ ...prev, [updateField]: publicUrl }));

      toast({ title: "Upload successful!", description: `Your ${type} has been updated` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', user?.id);

      if (error) throw error;

      toast({ title: "Profile updated!", description: "Your changes have been saved" });
      setEditing(false);
      fetchProfile();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cover Photo */}
        <Card className="overflow-hidden">
          <div className="relative h-48 bg-gradient-primary group">
            {profile?.cover_photo_url ? (
              <img src={profile.cover_photo_url} alt="Cover" className="w-full h-full object-cover object-center" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/10" />
            )}
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <div className="text-center text-white">
                  <Camera className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Click to upload cover photo</p>
                </div>
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} className="hidden" />
              </label>
            )}
          </div>

          <CardContent className="relative -mt-16 pb-6">
            <div className="flex items-end justify-between">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-3xl">
                    {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-6 w-6 text-white" />
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} className="hidden" />
                  </label>
                )}
              </div>

              {isOwnProfile ? (
                !editing ? (
                  <Button onClick={() => setEditing(true)}>Edit Profile</Button>
                ) : (
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button onClick={updateProfile} disabled={loading}>Save Changes</Button>
                  </div>
                )
              ) : (
                <Button
                  variant={isFollowing ? 'outline' : 'default'}
                  onClick={toggleFollow}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {!editing ? (
                <>
                  <h1 className="text-3xl font-bold">{profile?.display_name || 'Unknown User'}</h1>
                  <p className="text-muted-foreground">{profile?.bio || 'No bio yet'}</p>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
                    <span className="font-medium">{followerCount} followers</span>
                    <span>•</span>
                    <span className="font-medium">{followingCount} following</span>
                  </div>
                  
                  <div className="flex items-center space-x-6 pt-4">
                    <div className="flex items-center space-x-2">
                      <Coins className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{profile?.token_balance || 0} Tokens</span>
                    </div>
                    {profile?.wallet_address && (
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        <span className="text-sm font-mono">
                          {profile.wallet_address.slice(0, 6)}...{profile.wallet_address.slice(-4)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input id="display_name" value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="min-h-[100px]" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wallet_address">Wallet Address</Label>
                    <Input id="wallet_address" value={formData.wallet_address} onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })} placeholder="0x..." />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><h3 className="font-semibold">Posts</h3></CardHeader>
            <CardContent><p className="text-3xl font-bold">{userPosts.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="font-semibold">Groups</h3></CardHeader>
            <CardContent><p className="text-3xl font-bold">{userGroups.length}</p></CardContent>
          </Card>
        </div>

        {/* User Posts & Reposts */}
        {(userPosts.length > 0 || userReposts.length > 0) && (
          <Card>
            <CardHeader>
              <h3 className="text-xl font-semibold">Recent Activity</h3>
            </CardHeader>
            <CardContent className="space-y-6">
              {userPosts.map((post) => (
                <div
                  key={`post-${post.id}`}
                  className="border-b last:border-0 pb-6 last:pb-0 cursor-pointer hover:bg-accent/30 rounded-lg p-3 transition-colors"
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <p className="text-sm text-muted-foreground mb-2">
                    Posted {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                  <p className="mb-3">{post.content}</p>
                  
                  {(() => {
                    const imgs = post.image_urls && post.image_urls.length > 0
                      ? post.image_urls
                      : post.image_url ? [post.image_url] : [];
                    if (imgs.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <PostImageCarousel images={imgs} alt="Post image" maxHeightClass="max-h-[400px]" />
                      </div>
                    );
                  })()}

                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center"><Heart className="h-4 w-4 mr-1" />{post.likes_count || 0}</span>
                    <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1" />{post.comments_count || 0}</span>
                  </div>
                </div>
              ))}

              {userReposts.map((repost: any) => (
                <div
                  key={`repost-${repost.id}`}
                  className="border-b last:border-0 pb-6 last:pb-0 bg-accent/30 p-4 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/posts/${repost.posts?.id}`)}
                >
                  <p className="text-sm text-green-600 dark:text-green-400 mb-2 flex items-center">
                    <Repeat2 className="h-4 w-4 mr-1" />
                    Reposted {formatDistanceToNow(new Date(repost.created_at), { addSuffix: true })}
                  </p>
                  <div className="flex items-center space-x-2 mb-3">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={repost.posts?.profiles?.avatar_url} />
                      <AvatarFallback>{repost.posts?.profiles?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold">{repost.posts?.profiles?.display_name}</p>
                  </div>
                  <p className="mb-3">{repost.posts?.content}</p>

                  {(() => {
                    const imgs = repost.posts?.image_urls && repost.posts.image_urls.length > 0
                      ? repost.posts.image_urls
                      : repost.posts?.image_url ? [repost.posts.image_url] : [];
                    if (imgs.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <PostImageCarousel images={imgs} alt="Repost image" maxHeightClass="max-h-[400px]" />
                      </div>
                    );
                  })()}

                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center"><Heart className="h-4 w-4 mr-1" />{repost.posts?.likes_count || 0}</span>
                    <span className="flex items-center"><MessageCircle className="h-4 w-4 mr-1" />{repost.posts?.comments_count || 0}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
