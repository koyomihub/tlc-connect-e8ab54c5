import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera,
  Wallet,
  Coins,
  Repeat2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
  Users as UsersIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from '@/hooks/use-toast';
import { ethers } from 'ethers';
import { formatDistanceToNow } from 'date-fns';
import { PostImageCarousel } from '@/components/feed/PostImageCarousel';
import { PostPrivacyBadge } from '@/components/feed/PostPrivacyBadge';
import { awardTokens } from '@/lib/awardTokens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PostPrivacy = 'public' | 'friends' | 'private';

interface ActivityItem {
  kind: 'post' | 'repost';
  sortDate: string; // created_at of the post or the repost
  post: any; // joined post with profiles
  repostId?: string;
  repostedAt?: string;
  reposterName?: string;
}

export default function Profile() {
  const { user } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { account } = useWallet();
  const [onChainTLC, setOnChainTLC] = useState<string | null>(null);
  const [tlcLoading, setTlcLoading] = useState(false);

  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
  });

  // Cover photo repositioning
  const [repositioning, setRepositioning] = useState(false);
  const [coverPosition, setCoverPosition] = useState<string>('center');
  const [draftPosition, setDraftPosition] = useState<string>('center');
  const coverRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  // Edit/delete state for own posts
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<PostPrivacy>('public');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchActivity();
      fetchFollowCounts();
      fetchUserGroups();
      if (user) {
        fetchLiked();
        fetchReposted();
      }
      if (!isOwnProfile && user) {
        checkFollowStatus();
      }
    }
  }, [profileId, user]);

  // Fetch live on-chain $TLC balance whenever the wallet account changes (own profile only)
  useEffect(() => {
    const fetchOnChain = async () => {
      if (!isOwnProfile || !account || !window.ethereum) {
        setOnChainTLC(null);
        return;
      }
      setTlcLoading(true);
      try {
        const TLC_CONTRACT = '0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0';
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          TLC_CONTRACT,
          ['function balanceOf(address) view returns (uint256)'],
          provider,
        );
        const bal = await contract.balanceOf(account);
        setOnChainTLC(ethers.formatUnits(bal, 18));
      } catch (e) {
        console.error('Error fetching on-chain TLC:', e);
        setOnChainTLC(null);
      } finally {
        setTlcLoading(false);
      }
    };
    fetchOnChain();
  }, [account, isOwnProfile]);

  const fetchProfile = async () => {
    if (!profileId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (data) {
      setProfile(data);
      const pos = (data as any).cover_position || 'center';
      setCoverPosition(pos);
      setDraftPosition(pos);
      if (isOwnProfile) {
        setFormData({
          display_name: data.display_name || '',
          bio: data.bio || '',
        });
      }
    }
  };

  // Cover photo reposition (drag vertically to set object-position)
  const handleCoverPointerDown = (e: React.PointerEvent) => {
    if (!repositioning) return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateDraftFromPointer(e);
  };
  const handleCoverPointerMove = (e: React.PointerEvent) => {
    if (!repositioning || !draggingRef.current) return;
    updateDraftFromPointer(e);
  };
  const handleCoverPointerUp = () => { draggingRef.current = false; };

  const updateDraftFromPointer = (e: React.PointerEvent) => {
    const el = coverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const pct = Math.round((y / rect.height) * 100);
    setDraftPosition(`center ${pct}%`);
  };

  const saveCoverPosition = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ cover_position: draftPosition } as any)
      .eq('id', user?.id);
    if (error) {
      toast({ title: 'Could not save position', description: error.message, variant: 'destructive' });
    } else {
      setCoverPosition(draftPosition);
      setRepositioning(false);
      toast({ title: 'Cover position saved' });
    }
  };

  const cancelReposition = () => {
    setDraftPosition(coverPosition);
    setRepositioning(false);
  };

  const fetchFollowCounts = async () => {
    if (!profileId) return;
    const { data: followers } = await supabase
      .from('follows')
      .select('id')
      .eq('following_id', profileId);
    setFollowerCount(followers?.length || 0);

    const { data: following } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', profileId);
    setFollowingCount(following?.length || 0);
  };

  const fetchUserGroups = async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', profileId);
    setUserGroups(data || []);
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
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false);
      setFollowerCount((p) => Math.max(0, p - 1));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
      setFollowerCount((p) => p + 1);
    }
  };

  const fetchActivity = async () => {
    if (!profileId) return;

    const [postsRes, repostsRes] = await Promise.all([
      supabase
        .from('posts')
        .select(`*, profiles!posts_user_id_fkey(display_name, avatar_url)`)
        .eq('user_id', profileId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('reposts')
        .select(`id, created_at, posts(*, profiles!posts_user_id_fkey(display_name, avatar_url))`)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false }),
    ]);

    const posts = postsRes.data || [];
    const reposts = repostsRes.data || [];
    setPostsCount(posts.length);

    const reposterName = profile?.display_name;

    const items: ActivityItem[] = [
      ...posts.map((p: any) => ({
        kind: 'post' as const,
        sortDate: p.created_at,
        post: p,
      })),
      ...reposts
        .filter((r: any) => r.posts && !r.posts.is_hidden)
        .map((r: any) => ({
          kind: 'repost' as const,
          sortDate: r.created_at,
          post: r.posts,
          repostId: r.id,
          repostedAt: r.created_at,
          reposterName,
        })),
    ];

    items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    setActivity(items);
  };

  const fetchLiked = async () => {
    if (!user) return;
    const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
    if (data) setLikedPosts(new Set(data.map((l) => l.post_id)));
  };

  const fetchReposted = async () => {
    if (!user) return;
    const { data } = await supabase.from('reposts').select('post_id').eq('user_id', user.id);
    if (data) setRepostedPosts(new Set(data.map((r) => r.post_id)));
  };

  const toggleLike = async (postId: string, postOwnerId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        setLikedPosts((prev) => {
          const s = new Set(prev);
          s.delete(postId);
          return s;
        });
        setActivity((prev) =>
          prev.map((it) =>
            it.post.id === postId
              ? { ...it, post: { ...it.post, likes_count: Math.max(0, (it.post.likes_count || 0) - 1) } }
              : it
          )
        );
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        setLikedPosts((prev) => new Set(prev).add(postId));
        setActivity((prev) =>
          prev.map((it) =>
            it.post.id === postId
              ? { ...it, post: { ...it.post, likes_count: (it.post.likes_count || 0) + 1 } }
              : it
          )
        );
        if (postOwnerId !== user.id) {
          awardTokens({ type: 'post_like_received', description: 'Your post received a like', postId });
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleRepost = async (postId: string) => {
    if (!user) return;
    const isReposted = repostedPosts.has(postId);
    try {
      if (isReposted) {
        await supabase.from('reposts').delete().eq('post_id', postId).eq('user_id', user.id);
        setRepostedPosts((prev) => {
          const s = new Set(prev);
          s.delete(postId);
          return s;
        });
        toast({ title: 'Repost removed' });
      } else {
        await supabase.from('reposts').insert({ post_id: postId, user_id: user.id });
        setRepostedPosts((prev) => new Set(prev).add(postId));
        toast({ title: 'Post reposted!' });
      }
      fetchActivity();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openEdit = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditPrivacy((post.privacy as PostPrivacy) || 'public');
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    if (!editContent.trim()) {
      toast({ title: 'Content required', variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from('posts')
      .update({ content: editContent, privacy: editPrivacy })
      .eq('id', editingPost.id);
    setEditSaving(false);
    if (error) {
      toast({ title: 'Error updating post', description: error.message, variant: 'destructive' });
    } else {
      setActivity((prev) =>
        prev.map((it) =>
          it.post.id === editingPost.id
            ? { ...it, post: { ...it.post, content: editContent, privacy: editPrivacy } }
            : it
        )
      );
      setEditingPost(null);
      toast({ title: 'Post updated' });
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      toast({ title: 'Error deleting post', description: error.message, variant: 'destructive' });
    } else {
      setActivity((prev) => prev.filter((it) => !(it.kind === 'post' && it.post.id === postId)));
      setPostsCount((c) => Math.max(0, c - 1));
      toast({ title: 'Post deleted' });
    }
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
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath);
      const updateField = type === 'avatar' ? 'avatar_url' : 'cover_photo_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', user?.id);
      if (updateError) throw updateError;
      setProfile((prev: any) => ({ ...prev, [updateField]: publicUrl }));
      toast({ title: 'Upload successful!', description: `Your ${type} has been updated` });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update(formData).eq('id', user?.id);
      if (error) throw error;
      toast({ title: 'Profile updated!', description: 'Your changes have been saved' });
      setEditing(false);
      fetchProfile();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header card */}
        <Card className="overflow-hidden">
          <div className={`relative h-56 w-full overflow-hidden ${profile?.cover_photo_url ? 'bg-muted' : 'bg-gradient-primary'}`}>
            {/* Drag layer (image only) — buttons are siblings so they don't trigger drag */}
            <div
              ref={coverRef}
              onPointerDown={handleCoverPointerDown}
              onPointerMove={handleCoverPointerMove}
              onPointerUp={handleCoverPointerUp}
              onPointerCancel={handleCoverPointerUp}
              className={`absolute inset-0 ${repositioning ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
            >
              {profile?.cover_photo_url ? (
                <img
                  src={profile.cover_photo_url}
                  alt="Cover"
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: repositioning ? draftPosition : coverPosition }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-background" />
              )}
            </div>

            {isOwnProfile && editing && !repositioning && (
              <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={loading}
                  className="bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow hover:bg-accent transition flex items-center gap-1.5"
                  aria-label="Change cover photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {loading ? 'Uploading…' : 'Change Cover'}
                </button>
                {profile?.cover_photo_url && (
                  <button
                    type="button"
                    onClick={() => setRepositioning(true)}
                    className="bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow hover:bg-accent transition"
                  >
                    Reposition
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'cover')}
                  className="hidden"
                />
              </div>
            )}

            {isOwnProfile && editing && repositioning && (
              <>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur rounded-full px-3 py-1 text-xs shadow z-10 pointer-events-none">
                  Drag the image to reposition
                </div>
                <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                  <Button size="sm" variant="outline" onClick={cancelReposition}>Cancel</Button>
                  <Button size="sm" onClick={saveCoverPosition}>Save Position</Button>
                </div>
              </>
            )}
          </div>

          <CardContent className="relative -mt-20 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="relative w-fit">
                <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-3xl">
                    {profile?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && editing && (
                  <>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={loading}
                      aria-label="Change profile photo"
                      className="absolute bottom-1 right-1 bg-background border border-border shadow rounded-full p-2 hover:bg-accent transition"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'avatar')}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              <div className="flex gap-2 sm:self-end">
                {isOwnProfile ? (
                  !editing ? (
                    <Button onClick={() => setEditing(true)}>Edit Profile</Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                      <Button onClick={updateProfile} disabled={loading}>Save Changes</Button>
                    </>
                  )
                ) : (
                  <Button variant={isFollowing ? 'outline' : 'default'} onClick={toggleFollow}>
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!editing ? (
                <>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {profile?.display_name || 'Unknown User'}
                  </h1>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {profile?.bio || (isOwnProfile ? 'Add a bio to tell people about yourself.' : 'No bio yet')}
                  </p>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span><span className="font-semibold">{followerCount}</span> <span className="text-muted-foreground">followers</span></span>
                    <span className="text-muted-foreground">•</span>
                    <span><span className="font-semibold">{followingCount}</span> <span className="text-muted-foreground">following</span></span>
                    <span className="text-muted-foreground">•</span>
                    <span><span className="font-semibold">{postsCount}</span> <span className="text-muted-foreground">posts</span></span>
                    <span className="text-muted-foreground">•</span>
                    <span><span className="font-semibold">{userGroups.length}</span> <span className="text-muted-foreground">groups</span></span>
                  </div>

                  {/* Private to owner: tokens & wallet */}
                  {isOwnProfile && (
                    <div className="flex items-center flex-wrap gap-3 pt-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                          {account
                            ? tlcLoading
                              ? 'Syncing…'
                              : onChainTLC !== null
                                ? `${parseFloat(onChainTLC).toLocaleString(undefined, { maximumFractionDigits: 2 })} $TLC`
                                : '— $TLC'
                            : `${profile?.token_balance || 0} TLC (off-chain)`}
                        </span>
                      </div>
                      {profile?.wallet_address && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border">
                          <Wallet className="h-4 w-4 text-primary" />
                          <span className="text-xs font-mono">
                            {profile.wallet_address.slice(0, 6)}…{profile.wallet_address.slice(-4)}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">Only you can see this</span>
                    </div>
                  )}
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity */}
        <div>
          <h2 className="text-xl font-semibold mb-3">Recent Activity</h2>

          {activity.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No posts or reposts yet.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {activity.map((item) => {
                const post = item.post;
                const isOwnPost = post.user_id === user?.id;
                const isLiked = likedPosts.has(post.id);
                const isReposted = repostedPosts.has(post.id);
                const imgs =
                  post.image_urls && post.image_urls.length > 0
                    ? post.image_urls
                    : post.image_url
                    ? [post.image_url]
                    : [];

                return (
                  <Card key={`${item.kind}-${item.kind === 'repost' ? item.repostId : post.id}`} className="p-6">
                    {item.kind === 'repost' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Repeat2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span>
                          {isOwnProfile ? 'You' : item.reposterName || 'User'} reposted
                          {' • '}
                          {formatDistanceToNow(new Date(item.repostedAt!), { addSuffix: true })}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Avatar
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/profile/${post.user_id}`)}
                        >
                          <AvatarImage src={post.profiles?.avatar_url} />
                          <AvatarFallback>
                            {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p
                            className="font-semibold cursor-pointer hover:text-primary transition-colors"
                            onClick={() => navigate(`/profile/${post.user_id}`)}
                          >
                            {post.profiles?.display_name || 'Unknown'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                            {post.privacy && <PostPrivacyBadge privacy={post.privacy} />}
                          </div>
                        </div>
                      </div>

                      {isOwnPost && item.kind === 'post' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(post)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deletePost(post.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <p
                      className="mb-4 whitespace-pre-wrap cursor-pointer"
                      onClick={() => navigate(`/posts/${post.id}`)}
                    >
                      {post.content}
                    </p>

                    {imgs.length > 0 && (
                      <div className="mb-4">
                        <PostImageCarousel
                          images={imgs}
                          alt="Post image"
                          onImageClick={() => navigate(`/posts/${post.id}`)}
                        />
                      </div>
                    )}

                    <div className="flex items-center space-x-4 pt-4 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLike(post.id, post.user_id)}
                        className={isLiked ? 'text-red-500' : ''}
                      >
                        <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                        {post.likes_count || 0}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/posts/${post.id}`)}>
                        <MessageCircle className="mr-2 h-4 w-4" />
                        {post.comments_count || 0}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRepost(post.id)}
                        className={isReposted ? 'text-green-500' : ''}
                      >
                        <Repeat2 className={`mr-2 h-4 w-4 ${isReposted ? 'fill-current' : ''}`} />
                        {post.reposts_count || 0}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update your post content and privacy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-profile-content">Content</Label>
              <Textarea
                id="edit-profile-content"
                className="min-h-[150px]"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Privacy</Label>
              <Select value={editPrivacy} onValueChange={(v) => setEditPrivacy(v as PostPrivacy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="flex items-center"><Globe className="mr-2 h-4 w-4" />Public</span>
                  </SelectItem>
                  <SelectItem value="friends">
                    <span className="flex items-center"><UsersIcon className="mr-2 h-4 w-4" />Followers</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
