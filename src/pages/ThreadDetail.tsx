import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2, Edit, MoreHorizontal, Heart, ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { awardTokens } from '@/lib/awardTokens';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function ThreadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReply, setNewReply] = useState('');
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('recent');
  const [editingThread, setEditingThread] = useState(false);
  const [threadEditData, setThreadEditData] = useState({ title: '', content: '' });

  useEffect(() => {
    if (id && user) {
      fetchThread();
      fetchReplies();
      checkLikeStatus();
      fetchLikedReplies();
      trackView();
    }
  }, [id, user, sortBy]);

  const trackView = async () => {
    if (!user || !id) return;
    
    // Insert view only if it doesn't exist
    await supabase
      .from('thread_views')
      .insert({ thread_id: id, user_id: user.id })
      .select()
      .maybeSingle();

    // Update views count
    const { data: viewsData } = await supabase
      .from('thread_views')
      .select('id', { count: 'exact' })
      .eq('thread_id', id);

    if (viewsData) {
      await supabase
        .from('threads')
        .update({ views_count: viewsData.length })
        .eq('id', id);
    }
  };

  const fetchThread = async () => {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles!threads_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (data) {
      setThread(data);
      setThreadEditData({ title: data.title, content: data.content });
    } else {
      toast({
        title: "Thread not found",
        variant: "destructive",
      });
      navigate('/threads');
    }
  };

  const checkLikeStatus = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('thread_likes')
      .select('id')
      .eq('thread_id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    setIsLiked(!!data);
  };

  const fetchLikedReplies = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('reply_likes')
      .select('reply_id')
      .eq('user_id', user.id);

    if (data) {
      setLikedReplies(new Set(data.map(like => like.reply_id)));
    }
  };

  const fetchReplies = async () => {
    let query = supabase
      .from('thread_replies')
      .select(`
        *,
        profiles!thread_replies_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq('thread_id', id);

    if (sortBy === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'popular') {
      query = query.order('likes_count', { ascending: false });
    }

    const { data } = await query;
    setReplies(data || []);
  };

  const toggleThreadLike = async () => {
    if (!user || !id) return;

    if (isLiked) {
      await supabase
        .from('thread_likes')
        .delete()
        .eq('thread_id', id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('thread_likes')
        .insert({ thread_id: id, user_id: user.id });
    }

    setIsLiked(!isLiked);
    fetchThread();
  };

  const toggleReplyLike = async (replyId: string) => {
    if (!user) return;

    const isLiked = likedReplies.has(replyId);

    if (isLiked) {
      await supabase
        .from('reply_likes')
        .delete()
        .eq('reply_id', replyId)
        .eq('user_id', user.id);

      setLikedReplies(prev => {
        const newSet = new Set(prev);
        newSet.delete(replyId);
        return newSet;
      });
    } else {
      await supabase
        .from('reply_likes')
        .insert({ reply_id: replyId, user_id: user.id });

      setLikedReplies(prev => new Set(prev).add(replyId));
    }

    fetchReplies();
  };

  const updateThread = async () => {
    const { error } = await supabase
      .from('threads')
      .update(threadEditData)
      .eq('id', id);

    if (error) {
      toast({
        title: "Error updating thread",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEditingThread(false);
      fetchThread();
      toast({ title: "Thread updated!" });
    }
  };

  const createReply = async () => {
    if (!newReply.trim()) return;

    const { error } = await supabase
      .from('thread_replies')
      .insert({
        thread_id: id,
        user_id: user?.id,
        content: newReply,
      });

    if (error) {
      toast({
        title: "Error posting reply",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewReply('');
      fetchReplies();
      fetchThread();
      toast({ title: "Reply posted!" });
    }
  };

  const updateReply = async (replyId: string) => {
    const { error } = await supabase
      .from('thread_replies')
      .update({ content: editContent })
      .eq('id', replyId);

    if (error) {
      toast({
        title: "Error updating reply",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEditingReply(null);
      setEditContent('');
      fetchReplies();
      toast({ title: "Reply updated!" });
    }
  };

  const deleteReply = async (replyId: string) => {
    const { error } = await supabase
      .from('thread_replies')
      .delete()
      .eq('id', replyId);

    if (error) {
      toast({
        title: "Error deleting reply",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchReplies();
      fetchThread();
      toast({ title: "Reply deleted" });
    }
  };

  const deleteThread = async () => {
    if (!confirm('Delete this thread?')) return;

    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting thread",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Thread deleted" });
      navigate('/threads');
    }
  };

  if (!thread) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  const isThreadOwner = thread.user_id === user?.id;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/threads')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Threads
        </Button>

        {/* Thread Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <Avatar 
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/profile/${thread.user_id}`)}
                >
                  <AvatarImage src={thread.profiles?.avatar_url} />
                  <AvatarFallback>
                    {thread.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  {editingThread ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={threadEditData.title}
                          onChange={(e) => setThreadEditData({ ...threadEditData, title: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Content</Label>
                        <Textarea
                          value={threadEditData.content}
                          onChange={(e) => setThreadEditData({ ...threadEditData, content: e.target.value })}
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={updateThread} size="sm">Save</Button>
                        <Button variant="outline" onClick={() => setEditingThread(false)} size="sm">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold">{thread.title}</h1>
                      <p 
                        className="text-sm text-muted-foreground mt-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/profile/${thread.user_id}`)}
                      >
                        Posted by {thread.profiles?.display_name || 'Unknown User'} •{' '}
                        {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                      </p>
                    </>
                  )}
                </div>
              </div>
              {isThreadOwner && !editingThread && (
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingThread(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={deleteThread}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          {!editingThread && (
            <CardContent>
              <p className="whitespace-pre-wrap">{thread.content}</p>
              <div className="flex items-center space-x-4 mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">{thread.views_count} views</span>
                <span className="text-sm text-muted-foreground">{thread.replies_count} replies</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleThreadLike}
                  className={isLiked ? 'text-red-500' : ''}
                >
                  <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                  {thread.likes_count || 0}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Reply Form */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Post a Reply</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your thoughts..."
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              className="min-h-[100px]"
            />
            <Button onClick={createReply} disabled={!newReply.trim()}>
              Post Reply
            </Button>
          </CardContent>
        </Card>

        {/* Replies Header with Sorting */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Replies ({replies.length})
          </h3>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="popular">Most Liked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Replies */}
        <div className="space-y-4">
          {replies.map((reply) => {
            const isOwner = reply.user_id === user?.id;
            const canDelete = isOwner || isThreadOwner;
            const isReplyLiked = likedReplies.has(reply.id);

            return (
              <Card key={reply.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <Avatar 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate(`/profile/${reply.user_id}`)}
                      >
                        <AvatarImage src={reply.profiles?.avatar_url} />
                        <AvatarFallback>
                          {reply.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p 
                          className="font-semibold cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/profile/${reply.user_id}`)}
                        >
                          {reply.profiles?.display_name || 'Unknown User'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {canDelete && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {isOwner && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingReply(reply.id);
                                setEditContent(reply.content);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteReply(reply.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingReply === reply.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <div className="flex space-x-2">
                        <Button onClick={() => updateReply(reply.id)} size="sm">
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingReply(null);
                            setEditContent('');
                          }}
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{reply.content}</p>
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReplyLike(reply.id)}
                          className={isReplyLiked ? 'text-blue-500' : ''}
                        >
                          <ThumbsUp className={`mr-2 h-4 w-4 ${isReplyLiked ? 'fill-current' : ''}`} />
                          {reply.likes_count || 0}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {replies.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">No replies yet. Be the first to reply!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
