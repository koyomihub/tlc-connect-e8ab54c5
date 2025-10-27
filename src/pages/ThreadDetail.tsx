import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Trash2, Edit, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ThreadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [newReply, setNewReply] = useState('');
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchThread();
    fetchReplies();
    incrementViews();
  }, [id]);

  const incrementViews = async () => {
    const { data } = await supabase
      .from('threads')
      .select('views_count')
      .eq('id', id)
      .single();
    
    if (data) {
      await supabase
        .from('threads')
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq('id', id);
    }
  };

  const fetchThread = async () => {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles!threads_user_id_fkey(display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (data) {
      setThread(data);
    } else {
      toast({
        title: "Thread not found",
        variant: "destructive",
      });
      navigate('/threads');
    }
  };

  const fetchReplies = async () => {
    const { data } = await supabase
      .from('thread_replies')
      .select(`
        *,
        profiles!thread_replies_user_id_fkey(display_name, avatar_url)
      `)
      .eq('thread_id', id)
      .order('created_at', { ascending: true });

    setReplies(data || []);
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
      toast({
        title: "Reply posted!",
      });
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
      toast({
        title: "Reply updated!",
      });
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
      toast({
        title: "Reply deleted",
      });
    }
  };

  const deleteThread = async () => {
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
      toast({
        title: "Thread deleted",
      });
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
                <Avatar>
                  <AvatarImage src={thread.profiles?.avatar_url} />
                  <AvatarFallback>
                    {thread.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{thread.title}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Posted by {thread.profiles?.display_name || 'Unknown User'} •{' '}
                    {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {isThreadOwner && (
                <Button variant="destructive" size="sm" onClick={deleteThread}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{thread.content}</p>
            <div className="flex items-center space-x-4 mt-4 text-sm text-muted-foreground">
              <span>{thread.views_count} views</span>
              <span>{thread.replies_count} replies</span>
            </div>
          </CardContent>
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

        {/* Replies */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">
            Replies ({replies.length})
          </h3>
          {replies.map((reply) => {
            const isOwner = reply.user_id === user?.id;
            const canDelete = isOwner || isThreadOwner;

            return (
              <Card key={reply.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <Avatar>
                        <AvatarImage src={reply.profiles?.avatar_url} />
                        <AvatarFallback>
                          {reply.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{reply.profiles?.display_name || 'Unknown User'}</p>
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
                    <p className="whitespace-pre-wrap">{reply.content}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
