import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, ArrowLeft, ImageIcon, X } from 'lucide-react';
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

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (id) {
      fetchOrganization();
      fetchPosts();
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      checkPermissions();
    }
  }, [user, id]);

  const fetchOrganization = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id!)
      .maybeSingle();
    setOrganization(data);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('organization_posts')
      .select(`
        *,
        organizations(name, logo_url),
        profiles!organization_posts_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq('organization_id', id!)
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const checkPermissions = async () => {
    if (!user || !id) return;
    const { data, error } = await supabase.rpc('can_post_in_organization', {
      _user_id: user.id,
      _org_id: id,
    });
    if (!error) setCanPost(!!data);

    const { data: adminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    setIsAdmin(!!adminData);
  };

  const createPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill in title and content', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile && user) {
        const ext = imageFile.name.split('.').pop();
        const fileName = `${user.id}/org-${Date.now()}-${Math.random()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { error } = await supabase.from('organization_posts').insert({
        organization_id: id!,
        user_id: user?.id!,
        title: newPost.title,
        content: newPost.content,
        image_url: imageUrl,
      });
      if (error) throw error;

      setNewPost({ title: '', content: '' });
      clearImage();
      setIsDialogOpen(false);
      fetchPosts();
      toast({ title: 'Post created successfully!' });
    } catch (error: any) {
      toast({ title: 'Error creating post', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    const { error } = await supabase.from('organization_posts').delete().eq('id', postId);
    if (error) {
      toast({ title: 'Error deleting post', description: error.message, variant: 'destructive' });
    } else {
      fetchPosts();
      toast({ title: 'Post deleted' });
    }
  };

  if (!organization) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/organizations')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Organizations
        </Button>

        {/* Org header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center space-x-4">
                {organization.logo_url ? (
                  <img src={organization.logo_url} alt={organization.name} className="h-16 w-16 rounded-full" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {organization.name}
                  </h1>
                  {organization.description && (
                    <p className="text-sm text-muted-foreground mt-1">{organization.description}</p>
                  )}
                </div>
              </div>

              {canPost && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Create Post for {organization.name}</DialogTitle>
                      <DialogDescription>Share news and updates from this organization</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
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
          </CardHeader>
        </Card>

        {/* Posts */}
        <div className="space-y-4">
          {posts.map((post) => {
            const canDelete = isAdmin || post.user_id === user?.id;
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
                        <p className="font-semibold">{post.profiles?.display_name}</p>
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
                  No posts yet for this organization.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
