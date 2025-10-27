import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Share2, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url?: string;
  likes_count: number;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url?: string;
  };
  post_likes: { user_id: string }[];
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(display_name, avatar_url),
        post_likes(user_id)
      `)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching posts",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setPosts(data as any || []);
  };

  const createPost = async () => {
    if (!newPost.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from('posts')
      .insert({
        content: newPost,
        user_id: user?.id,
      });

    if (error) {
      toast({
        title: "Error creating post",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewPost('');
      fetchPosts();
      toast({
        title: "Post created!",
        description: "Your post has been shared with the community.",
      });
    }
    setLoading(false);
  };

  const toggleLike = async (postId: string, isLiked: boolean) => {
    if (isLiked) {
      await supabase
        .from('post_likes')
        .delete()
        .match({ post_id: postId, user_id: user?.id });
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user?.id });
    }
    fetchPosts();
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Create Post Card */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={`https://avatar.vercel.sh/${user?.email}`} />
                <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="What's on your mind?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>
          </CardHeader>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              Photo
            </Button>
            <Button onClick={createPost} disabled={loading || !newPost.trim()} className="shadow-sm">
              Post
            </Button>
          </CardFooter>
        </Card>

        {/* Posts Feed */}
        {posts.map((post) => {
          const isLiked = post.post_likes.some(like => like.user_id === user?.id);
          const isOwner = post.profiles && user?.id;

          return (
            <Card key={post.id} className="shadow-md hover:shadow-lg transition-shadow animate-fade-in">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={post.profiles?.avatar_url} />
                      <AvatarFallback>
                        {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{post.profiles?.display_name || 'Unknown User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap">{post.content}</p>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full rounded-lg object-cover max-h-96"
                  />
                )}
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleLike(post.id, isLiked)}
                  className={isLiked ? "text-destructive" : ""}
                >
                  <Heart className={`h-5 w-5 mr-2 ${isLiked ? "fill-current" : ""}`} />
                  {post.likes_count}
                </Button>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Comment
                </Button>
                <Button variant="ghost" size="sm">
                  <Share2 className="h-5 w-5 mr-2" />
                  Share
                </Button>
              </CardFooter>
            </Card>
          );
        })}

        {posts.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
