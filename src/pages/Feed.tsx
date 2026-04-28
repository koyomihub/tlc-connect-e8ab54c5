import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Repeat2, Newspaper, Globe, Users as UsersIcon, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { awardTokens } from '@/lib/awardTokens';
import { formatDistanceToNow } from 'date-fns';
import { PostPrivacyBadge } from '@/components/feed/PostPrivacyBadge';
import { PostImageCarousel } from '@/components/feed/PostImageCarousel';
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
import { Label } from '@/components/ui/label';
import { useIsAdmin } from '@/hooks/useIsAdmin';

type PostPrivacy = 'public' | 'friends';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  image_urls: string[] | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  privacy: PostPrivacy;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
}

interface RepostItem {
  id: string; // repost row id
  created_at: string;
  user_id: string; // reposter
  privacy: PostPrivacy;
  reposter: { display_name: string; avatar_url: string };
  post: Post;
}

type FeedItem =
  | { kind: 'post'; sortDate: string; post: Post }
  | { kind: 'repost'; sortDate: string; post: Post; repost: RepostItem };

export default function Feed() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<{ avatar_url?: string; display_name?: string } | null>(null);
  const [postPrivacy, setPostPrivacy] = useState<PostPrivacy>('public');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [reposts, setReposts] = useState<RepostItem[]>([]);
  const [repostPrivacy, setRepostPrivacy] = useState<PostPrivacy>('friends');

  // Edit/delete state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<PostPrivacy>('public');
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditPrivacy(post.privacy);
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
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, content: editContent, privacy: editPrivacy } : p))
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
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast({ title: 'Post deleted' });
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchPosts();
    fetchReposts();
    fetchLikedPosts();
    fetchRepostedPosts();
    fetchUserProfile();

    const channel = supabase
      .channel(`feed-posts-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const updatedPost = payload.new as Partial<Post> & { id: string };
          setPosts((prev) => prev.map((post) =>
            post.id === updatedPost.id
              ? {
                  ...post,
                  likes_count: updatedPost.likes_count ?? post.likes_count,
                  comments_count: updatedPost.comments_count ?? post.comments_count,
                  reposts_count: updatedPost.reposts_count ?? post.reposts_count,
                }
              : post
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url, display_name')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setUserProfile(data);
    }
  };

  const fetchPosts = async () => {
    if (!user) return;

    const { data: followsData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id);

    const followedIds = (followsData || []).map((f) => f.following_id);
    setFollowingIds(followedIds);

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (display_name, avatar_url)
      `)
      .eq('is_hidden', false)
      .or(`user_id.eq.${user.id},privacy.eq.public,and(privacy.eq.friends,user_id.in.(${followedIds.length ? followedIds.join(',') : '00000000-0000-0000-0000-000000000000'}))`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      toast({ title: 'Error fetching posts', description: error.message, variant: 'destructive' });
      return;
    }

    setPosts(data as any || []);
  };

  const fetchReposts = async () => {
    if (!user) return;

    // RLS handles privacy filtering: own + public + friends-from-followed
    const { data, error } = await supabase
      .from('reposts')
      .select(`
        id, created_at, user_id, privacy,
        reposter:profiles!reposts_user_id_fkey (display_name, avatar_url),
        post:posts!reposts_post_id_fkey (
          *,
          profiles!posts_user_id_fkey (display_name, avatar_url)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching reposts:', error);
      return;
    }

    const items: RepostItem[] = (data || [])
      .filter((r: any) => r.post && !r.post.is_hidden)
      .map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        user_id: r.user_id,
        privacy: r.privacy,
        reposter: r.reposter,
        post: r.post,
      }));

    setReposts(items);
  };

  const fetchLikedPosts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id);

    if (data) {
      setLikedPosts(new Set(data.map(like => like.post_id)));
    }
  };

  const fetchRepostedPosts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('reposts')
      .select('post_id')
      .eq('user_id', user.id);

    if (data) {
      setRepostedPosts(new Set(data.map(repost => repost.post_id)));
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0 || !user) return [];

    const uploadPromises = imageFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      return publicUrl;
    });

    return await Promise.all(uploadPromises);
  };

  const createPost = async () => {
    if (!newPost.trim() || !user) return;

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        imageUrls = await uploadImages();
      }

      const { data: newPostData, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: newPost.trim(),
          image_url: imageUrls[0] || null,
          image_urls: imageUrls,
          privacy: postPrivacy,
        })
        .select('id')
        .single();

      if (error) throw error;

      setNewPost('');
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPosts();
      toast({ title: 'Post created!', description: 'Your post has been shared' });
      if (newPostData?.id) {
        awardTokens({ type: 'post_created', description: 'Created a new post', postId: newPostData.id });
      }
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({ title: 'Error creating post', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;

    const isLiked = likedPosts.has(postId);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) - 1) }
          : p
        ));

        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        setPosts(prev => prev.map(p => p.id === postId
          ? { ...p, likes_count: (p.likes_count || 0) + 1 }
          : p
        ));

        setLikedPosts(prev => new Set(prev).add(postId));

        const post = posts.find(p => p.id === postId);
        if (post && post.user_id !== user.id) {
          awardTokens({ type: 'post_like_received', description: 'Your post received a like', postId });
        }
      }
    } catch (error: any) {
      toast({ title: 'Error updating reaction', description: error.message, variant: 'destructive' });
      fetchPosts();
      fetchLikedPosts();
    }
  };

  const toggleRepost = async (postId: string) => {
    if (!user) return;

    const isReposted = repostedPosts.has(postId);

    try {
      if (isReposted) {
        await supabase
          .from('reposts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        setRepostedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        toast({ title: 'Repost removed' });
      } else {
        await supabase
          .from('reposts')
          .insert({ post_id: postId, user_id: user.id, privacy: repostPrivacy });

        setRepostedPosts(prev => new Set(prev).add(postId));
        toast({
          title: 'Post reposted!',
          description: repostPrivacy === 'friends'
            ? 'Visible to your followers'
            : 'Visible to everyone',
        });
      }
      fetchReposts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center bg-gradient-primary bg-clip-text text-transparent">
            <Newspaper className="h-8 w-8 mr-2 text-primary" />
            Feed
          </h1>
          <p className="text-muted-foreground mt-1">
            See what's happening in your community
          </p>
        </div>
        <Card className="p-6 mb-6">
          <div className="flex items-start space-x-3">
            <Avatar>
              <AvatarImage src={userProfile?.avatar_url} />
              <AvatarFallback>
                {userProfile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[100px]"
              />
              
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img src={preview} alt={`Preview ${index + 1}`} className="rounded-lg max-h-48 w-full object-cover" />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Add Images
                </Button>
                <Select value={postPrivacy} onValueChange={(v) => setPostPrivacy(v as PostPrivacy)}>
                  <SelectTrigger className="w-[160px] h-9">
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
                <Button onClick={createPost} disabled={!newPost.trim() || uploading} className="ml-auto">
                  <Send className="mr-2 h-4 w-4" />
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Repost privacy preference */}
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>Reposts visible to:</span>
          <Select value={repostPrivacy} onValueChange={(v) => setRepostPrivacy(v as PostPrivacy)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friends">
                <span className="flex items-center"><UsersIcon className="mr-2 h-4 w-4" />Followers</span>
              </SelectItem>
              <SelectItem value="public">
                <span className="flex items-center"><Globe className="mr-2 h-4 w-4" />Public</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(() => {
          // Merge posts and reposts, sorted by date
          const feedItems: FeedItem[] = [
            ...posts.map((p) => ({ kind: 'post' as const, sortDate: p.created_at, post: p })),
            ...reposts.map((r) => ({ kind: 'repost' as const, sortDate: r.created_at, post: r.post, repost: r })),
          ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

          if (feedItems.length === 0) {
            return (
              <Card className="p-12 text-center space-y-2">
                <p className="text-muted-foreground">
                  {followingIds.length === 0
                    ? 'No posts yet. Create a post or follow people to see more activity here.'
                    : 'No visible posts yet.'}
                </p>
                {followingIds.length === 0 && (
                  <Button variant="outline" onClick={() => navigate('/people')}>
                    Discover People
                  </Button>
                )}
              </Card>
            );
          }

          return feedItems.map((item) => {
            const post = item.post;
            const isLiked = likedPosts.has(post.id);
            const isReposted = repostedPosts.has(post.id);
            const itemKey = item.kind === 'repost' ? `repost-${item.repost.id}` : `post-${post.id}`;

            return (
              <Card key={itemKey} className="p-6">
                {item.kind === 'repost' && (
                  <div
                    className="flex items-center gap-2 text-sm text-muted-foreground mb-3 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => navigate(`/profile/${item.repost.user_id}`)}
                  >
                    <Repeat2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span>
                      {item.repost.user_id === user?.id ? 'You' : item.repost.reposter?.display_name || 'Someone'} reposted
                      {' • '}
                      {formatDistanceToNow(new Date(item.repost.created_at), { addSuffix: true })}
                    </span>
                    <PostPrivacyBadge privacy={item.repost.privacy} />
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className="font-semibold cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/profile/${post.user_id}`)}
                        >
                          {post.profiles?.display_name}
                        </p>
                        <RoleBadge userId={post.user_id} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                        <PostPrivacyBadge privacy={post.privacy} />
                      </div>
                    </div>
                  </div>
                  {item.kind === 'post' && (post.user_id === user?.id || isAdmin) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {post.user_id === user?.id && (
                          <DropdownMenuItem onClick={() => openEdit(post)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => deletePost(post.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {post.user_id === user?.id ? 'Delete' : 'Delete (Admin)'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <p className="mb-4 whitespace-pre-wrap">{post.content}</p>

                {(() => {
                  const imgs = post.image_urls && post.image_urls.length > 0
                    ? post.image_urls
                    : post.image_url ? [post.image_url] : [];
                  if (imgs.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <PostImageCarousel
                        images={imgs}
                        alt="Post image"
                        onImageClick={() => navigate(`/posts/${post.id}`)}
                      />
                    </div>
                  );
                })()}

                <div className="flex items-center space-x-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLike(post.id)}
                    className={isLiked ? 'text-red-500' : ''}
                  >
                    <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                    {post.likes_count || 0}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
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
          });
        })()}
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
              <Label htmlFor="edit-feed-content">Content</Label>
              <Textarea
                id="edit-feed-content"
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
