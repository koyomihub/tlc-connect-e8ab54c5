import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Heart, MessageCircle, ArrowLeft, Trash2, Reply } from 'lucide-react';
import { awardTokens } from '@/lib/awardTokens';
import { formatDistanceToNow } from 'date-fns';
import { PostImageCarousel } from '@/components/feed/PostImageCarousel';
import { useIsAdmin } from '@/hooks/useIsAdmin';

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
    id: string;
    display_name: string;
    avatar_url: string;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  

  const handleReply = (target: Comment) => {
    const name = target.profiles?.display_name || 'user';
    const mention = `@[${name}](${target.user_id}) `;
    setNewComment((prev) => {
      // Avoid stacking duplicate mentions
      if (prev.startsWith(mention)) return prev;
      return mention + prev.replace(/^@\[[^\]]+\]\([^)]+\)\s*/, '');
    });
    // Scroll to and focus the textarea
    setTimeout(() => {
      const el = document.getElementById('new-comment-textarea') as HTMLTextAreaElement | null;
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Renders comment content with @[Name](userId) mentions as clickable highlighted links
  const renderCommentContent = (content: string) => {
    const regex = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;
    const parts: Array<JSX.Element | string> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const name = match[1];
      const userId = match[2];
      parts.push(
        <button
          key={`m-${key++}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${userId}`);
          }}
          className="font-semibold text-primary hover:underline"
        >
          @{name}
        </button>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    return parts;
  };

  useEffect(() => {
    if (!id) return;

    fetchPost();
    fetchComments();
    checkLikeStatus();

    const channel = supabase
      .channel(`post-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${id}` },
        (payload) => {
          setPost((prev) => prev ? { ...prev, ...(payload.new as Partial<Post>) } : prev);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const fetchPost = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Error loading post', variant: 'destructive' });
      navigate('/');
    } else {
      setPost(data as any);
    }
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select(`
        *,
        profiles!post_comments_user_id_fkey (display_name, avatar_url)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    if (data) setComments(data as any);
  };

  const checkLikeStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    setIsLiked(!!data);
  };

  const toggleLike = async () => {
    if (!user) return;

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: id, user_id: user.id });

        if (error) throw error;

        if (post && post.user_id !== user.id) {
          awardTokens({ type: 'post_like_received', description: 'Your post received a like', postId: id });
        }
      }

      setIsLiked(!isLiked);
      fetchPost();
    } catch (error: any) {
      toast({ title: 'Error updating reaction', description: error.message, variant: 'destructive' });
      fetchPost();
      checkLikeStatus();
    }
  };

  const createComment = async () => {
    if (!newComment.trim() || !user) return;

    const { data: commentData, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: id,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Error posting comment', description: error.message, variant: 'destructive' });
    } else {
      setNewComment('');
      fetchComments();
      fetchPost();
      toast({ title: 'Comment posted!' });

      // Award commenter for creating a comment — pass comment ID for dedup
      if (commentData?.id) {
        awardTokens({ type: 'comment_created', description: 'Created a comment', postId: commentData.id, parentPostId: id });
      }

      // Award post owner for receiving a comment
      if (post && post.user_id !== user.id) {
        awardTokens({ type: 'comment_received', description: 'Your post received a comment', postId: id });
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast({ title: 'Error deleting comment', description: error.message, variant: 'destructive' });
    } else {
      fetchComments();
      fetchPost();
      toast({ title: 'Comment deleted' });
    }
  };

  const deletePost = async () => {
    if (!confirm('Delete this post?')) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error deleting post', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Post deleted' });
      navigate('/');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!post) return null;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Feed
        </Button>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/profile/${post.user_id}`)}
            >
              <Avatar>
                <AvatarImage src={post.profiles?.avatar_url} />
                <AvatarFallback>
                  {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold">{post.profiles?.display_name}</p>
                  <RoleBadge userId={post.user_id} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {(user?.id === post.user_id || isAdmin) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deletePost}
                title={user?.id === post.user_id ? 'Delete post' : 'Delete (Admin)'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
                  maxHeightClass="max-h-[600px]"
                />
              </div>
            );
          })()}

          <div className="flex items-center space-x-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLike}
              className={isLiked ? 'text-red-500' : ''}
            >
              <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              {post.likes_count || 0}
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle className="mr-2 h-4 w-4" />
              {post.comments_count || 0}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Comments</h3>

          <div className="space-y-4 mb-6">
            <Textarea
              id="new-comment-textarea"
              placeholder="Write a comment... Use the Reply button to mention someone."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button onClick={createComment} disabled={!newComment.trim()}>
              Post Comment
            </Button>
          </div>

          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start space-x-3 p-4 bg-accent/50 rounded-lg">
                <Avatar 
                  className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/profile/${comment.user_id}`)}
                >
                  <AvatarImage src={comment.profiles?.avatar_url} />
                  <AvatarFallback>
                    {comment.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p 
                          className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/profile/${comment.user_id}`)}
                        >
                          {comment.profiles?.display_name}
                        </p>
                        <RoleBadge userId={comment.user_id} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {user && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReply(comment)}
                          title="Reply"
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      )}
                      {user?.id === comment.user_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteComment(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground/90 whitespace-pre-wrap break-words">
                    {renderCommentContent(comment.content)}
                  </p>
                </div>
              </div>
            ))}

            {comments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No comments yet. Be the first to comment!
              </p>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
