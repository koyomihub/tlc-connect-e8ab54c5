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
import { Heart, MessageCircle, Send, Image as ImageIcon, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchLikedPosts();
    }
  }, [user]);

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
      toast({ title: 'Error fetching posts', variant: 'destructive' });
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async () => {
    if (!imageFile || !user) return null;

    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, imageFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('posts')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const createPost = async () => {
    if (!newPost.trim() || !user) return;

    setUploading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: newPost.trim(),
          image_url: imageUrl,
        });

      if (error) throw error;

      setNewPost('');
      removeImage();
      fetchPosts();
      toast({ title: 'Post created!', description: 'Your post has been shared' });
    } catch (error: any) {
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

      setLikedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id });

      setLikedPosts(prev => new Set(prev).add(postId));
    }

    fetchPosts();
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6 mb-6">
          <div className="flex items-start space-x-3">
            <Avatar>
              <AvatarFallback>
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                placeholder="What's on your mind?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[100px]"
              />
              
              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="rounded-lg max-h-64 w-full object-cover" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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
                  Add Image
                </Button>
                <Button onClick={createPost} disabled={!newPost.trim() || uploading}>
                  <Send className="mr-2 h-4 w-4" />
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {posts.map((post) => {
          const isLiked = likedPosts.has(post.id);

          return (
            <Card key={post.id} className="p-6">
              <div className="flex items-start space-x-3 mb-4">
                <Avatar>
                  <AvatarImage src={post.profiles?.avatar_url} />
                  <AvatarFallback>
                    {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{post.profiles?.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <p className="mb-4 whitespace-pre-wrap">{post.content}</p>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post"
                  className="w-full rounded-lg mb-4 max-h-[500px] object-cover cursor-pointer"
                  onClick={() => navigate(`/posts/${post.id}`)}
                />
              )}

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
