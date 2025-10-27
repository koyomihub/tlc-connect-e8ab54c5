import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { MessageCircle, Eye, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Thread {
  id: string;
  title: string;
  content: string;
  views_count: number;
  replies_count: number;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url?: string;
  };
}

export default function Threads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newThread, setNewThread] = useState({ title: '', content: '' });

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    const { data, error } = await supabase
      .from('threads')
      .select(`
        *,
        profiles!threads_user_id_fkey(display_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      setThreads(data as any || []);
    }
  };

  const createThread = async () => {
    if (!newThread.title.trim() || !newThread.content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide both title and content",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('threads')
      .insert({
        title: newThread.title,
        content: newThread.content,
        user_id: user?.id,
      });

    if (error) {
      toast({
        title: "Error creating thread",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewThread({ title: '', content: '' });
      setIsDialogOpen(false);
      fetchThreads();
      toast({
        title: "Thread created!",
        description: "Your discussion has been started.",
      });
    }
  };

  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Discussion Threads
            </h1>
            <p className="text-muted-foreground mt-1">
              Join conversations and share your thoughts
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                New Thread
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Thread</DialogTitle>
                <DialogDescription>
                  Start a new discussion topic
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="What's your thread about?"
                    value={newThread.title}
                    onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Describe your topic in detail..."
                    className="min-h-[150px]"
                    value={newThread.content}
                    onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createThread}>Create Thread</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            type="search"
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <MessageCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Threads List */}
        <div className="space-y-4">
          {filteredThreads.map((thread) => (
            <Link key={thread.id} to={`/threads/${thread.id}`}>
              <Card className="hover:shadow-lg transition-all cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <Avatar>
                        <AvatarImage src={thread.profiles?.avatar_url} />
                        <AvatarFallback>
                          {thread.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1">
                          {thread.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {thread.content}
                        </p>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            {thread.views_count} views
                          </span>
                          <span className="flex items-center">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            {thread.replies_count} replies
                          </span>
                          <span>
                            by {thread.profiles?.display_name || 'Unknown User'}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}

          {filteredThreads.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">
                  {searchQuery ? 'No threads found matching your search.' : 'No threads yet. Start the first discussion!'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
