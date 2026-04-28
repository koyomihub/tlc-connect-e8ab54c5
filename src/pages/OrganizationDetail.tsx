import { useState, useEffect, useRef } from 'react';
import { RoleBadge } from '@/components/RoleBadge';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus, ArrowLeft, Image as ImageIcon, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PostImageCarousel } from '@/components/feed/PostImageCarousel';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog state
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '' });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrganization();
      fetchPosts();
    }
  }, [id]);

  useEffect(() => {
    if (user && id) checkPermissions();
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

  // ---------- Image helpers ----------
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImageFiles((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!imageFiles.length || !user) return [];
    return Promise.all(
      imageFiles.map(async (file) => {
        const ext = file.name.split('.').pop();
        const fileName = `${user.id}/org-${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from('posts').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
        return publicUrl;
      })
    );
  };

  // ---------- Create ----------
  const createPost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill in title and content', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const urls = await uploadImages();
      const { error } = await supabase.from('organization_posts').insert({
        organization_id: id!,
        user_id: user?.id!,
        title: newPost.title,
        content: newPost.content,
        image_url: urls[0] || null,
        image_urls: urls,
      });
      if (error) throw error;
      setNewPost({ title: '', content: '' });
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsCreateOpen(false);
      fetchPosts();
      toast({ title: 'Post created successfully!' });
    } catch (error: any) {
      toast({ title: 'Error creating post', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ---------- Edit ----------
  const openEdit = (post: any) => {
    setEditingPost(post);
    setEditForm({ title: post.title, content: post.content });
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    if (!editForm.title.trim() || !editForm.content.trim()) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from('organization_posts')
      .update({ title: editForm.title, content: editForm.content })
      .eq('id', editingPost.id);
    setEditSaving(false);
    if (error) {
      toast({ title: 'Error updating post', description: error.message, variant: 'destructive' });
    } else {
      setEditingPost(null);
      fetchPosts();
      toast({ title: 'Post updated' });
    }
  };

  // ---------- Delete ----------
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
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                      <div className="space-y-2">
                        <Label>Images (optional)</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageSelect}
                        />
                        {imagePreviews.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {imagePreviews.map((preview, index) => (
                              <div key={index} className="relative">
                                <img
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  className="rounded-lg max-h-48 w-full object-cover"
                                />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-2 right-2 h-7 w-7"
                                  onClick={() => removeImage(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Add Images
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={uploading}>
                        Cancel
                      </Button>
                      <Button onClick={createPost} disabled={uploading}>
                        {uploading ? 'Posting...' : 'Create Post'}
                      </Button>
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
            const isOwner = post.user_id === user?.id;
            const canDelete = isAdmin || isOwner;
            const imgs: string[] = post.image_urls && post.image_urls.length > 0
              ? post.image_urls
              : post.image_url ? [post.image_url] : [];

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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold">{post.profiles?.display_name}</p>
                          <RoleBadge userId={post.user_id} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {(isOwner || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isOwner && (
                            <DropdownMenuItem onClick={() => openEdit(post)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => deletePost(post.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{post.content}</p>
                  {imgs.length > 0 && (
                    <div className="mt-4">
                      <PostImageCarousel images={imgs} alt={post.title} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {posts.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">No posts yet for this organization.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>Update your post's title and content</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                className="min-h-[150px]"
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              />
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
