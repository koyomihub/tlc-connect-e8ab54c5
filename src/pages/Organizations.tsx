import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Organizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({ organization_id: '', title: '', content: '' });

  useEffect(() => {
    if (user) {
      checkPermissions();
      fetchOrganizations();
      fetchPosts();
    }
  }, [user]);

  const checkPermissions = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'teacher', 'officer'])
      .maybeSingle();

    setCanManage(!!data);
  };

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });

    setOrganizations(data || []);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('organization_posts')
      .select(`
        *,
        organizations(name, logo_url),
        profiles!organization_posts_user_id_fkey(id, display_name, avatar_url)
      `)
      .order('created_at', { ascending: false });

    setPosts(data || []);
  };

  const createPost = async () => {
    if (!newPost.organization_id || !newPost.title.trim() || !newPost.content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('organization_posts')
      .insert({
        organization_id: newPost.organization_id,
        user_id: user?.id,
        title: newPost.title,
        content: newPost.content,
      });

    if (error) {
      toast({
        title: "Error creating post",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewPost({ organization_id: '', title: '', content: '' });
      setIsDialogOpen(false);
      fetchPosts();
      toast({ title: "Post created successfully!" });
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;

    const { error } = await supabase
      .from('organization_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast({
        title: "Error deleting post",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchPosts();
      toast({ title: "Post deleted" });
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center bg-gradient-primary bg-clip-text text-transparent">
              <Building2 className="h-8 w-8 mr-2 text-primary" />
              Organizations
            </h1>
            <p className="text-muted-foreground mt-1">
              Official student organizations and clubs
            </p>
          </div>

          {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create Organization Post</DialogTitle>
                  <DialogDescription>
                    Share news and updates from your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Select
                      value={newPost.organization_id}
                      onValueChange={(value) => setNewPost({ ...newPost, organization_id: value })}
                    >
                      <SelectTrigger id="organization">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Post title"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      placeholder="Write your announcement..."
                      className="min-h-[150px]"
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createPost}>Create Post</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Organizations List */}
        <div className="grid md:grid-cols-2 gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-full" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    {org.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{org.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Posts Feed */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Latest Updates</h2>
          <div className="space-y-4">
            {posts.map((post) => {
              const canDelete = canManage || post.user_id === user?.id;

              return (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <Avatar>
                          <AvatarImage src={post.profiles?.avatar_url} />
                          <AvatarFallback>
                            {post.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold">{post.profiles?.display_name}</p>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {post.organizations?.name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePost(post.id)}
                          className="text-destructive"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                    <p className="whitespace-pre-wrap text-muted-foreground">{post.content}</p>
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="mt-4 w-full rounded-lg max-h-[400px] object-cover"
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {posts.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground">
                    No posts yet. {canManage && "Be the first to share an update!"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
