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
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Repeat2 } from 'lucide-react';
import { awardTokens } from '@/lib/awardTokens';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  image_urls: string[] | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
}

export default function Feed() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchLikedPosts();
      fetchRepostedPosts();
      fetchUserProfile();
    }
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
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (display_name, avatar_url)
      `)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      toast({ title: 'Error fetching posts', description: error.message, variant: 'destructive' });
      return;
    }

    setPosts(data as any || []);
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

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: newPost.trim(),
          image_url: imageUrls[0] || null, // Keep backward compatibility
          image_urls: imageUrls,
        });

      if (error) throw error;

      setNewPost('');
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPosts();
      toast({ title: 'Post created!', description: 'Your post has been shared' });
      awardTokens({ type: 'post_created', description: 'Created a new post' });
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

    if (isLiked) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, likes_count: Math.max(0, (p.likes_count || 0) - 1) }
      : p
    ));

    setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (isLiked) newSet.delete(postId); else newSet.add(postId);
        return newSet;
      });
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id });

      // Optimistic update
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes_count: p.likes_count + 1 }
        : p
      ));

      setLikedPosts(prev => new Set(prev).add(postId));

      // Award tokens to the post owner
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== user.id) {
        awardTokens({ type: 'post_like_received', description: 'Your post received a like', postId });
      }
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
          .insert({ post_id: postId, user_id: user.id });

        setRepostedPosts(prev => new Set(prev).add(postId));
        toast({ title: 'Post reposted!' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
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

              <div className="flex items-center justify-between">
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
                <Button onClick={createPost} disabled={!newPost.trim() || uploading} className="ml-auto">
                  <Send className="mr-2 h-4 w-4" />
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {posts.map((post) => {
          const isLiked = likedPosts.has(post.id);
          const isReposted = repostedPosts.has(post.id);

          return (
            <Card key={post.id} className="p-6">
              <div className="flex items-start space-x-3 mb-4">
                <Avatar 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/profile/${post.user_id}`)}
                >
                  <AvatarImage src={post.profiles?.avatar_url} />
                  <AvatarFallback>
                    {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p 
                    className="font-semibold cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/profile/${post.user_id}`)}
                  >
                    {post.profiles?.display_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <p className="mb-4 whitespace-pre-wrap">{post.content}</p>

              {post.image_urls && post.image_urls.length > 0 ? (
                <div className={`grid gap-2 mb-4 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.image_urls.map((url: string, index: number) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Post image ${index + 1}`}
                      className="w-full rounded-lg max-h-[400px] object-cover cursor-pointer"
                      onClick={() => navigate(`/posts/${post.id}`)}
                    />
                  ))}
                </div>
              ) : post.image_url ? (
                <img
                  src={post.image_url}
                  alt="Post"
                  className="w-full rounded-lg mb-4 max-h-[500px] object-cover cursor-pointer"
                  onClick={() => navigate(`/posts/${post.id}`)}
                />
              ) : null}

              <div className="flex items-center space-x-4 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLike(post.id)}
                  className={isLiked ? 'text-red-500' : ''}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                  {post.likes_count}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/posts/${post.id}`)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {post.comments_count}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRepost(post.id)}
                  className={isReposted ? 'text-green-500' : ''}
                >
                  <Repeat2 className={`mr-2 h-4 w-4 ${isReposted ? 'fill-current' : ''}`} />
                  Repost
                </Button>
              </div>
            </Card>
          );
        })}

        {posts.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
