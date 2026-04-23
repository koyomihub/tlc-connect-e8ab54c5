import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Building, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [newOrg, setNewOrg] = useState({ name: '', description: '' });
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    // Server-side admin verification using SECURITY DEFINER function
    const { data: isAdminResult, error } = await supabase
      .rpc('is_admin', { _user_id: user.id });

    if (error || !isAdminResult) {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setIsAdmin(true);
    setLoading(false);
    fetchUsers();
    fetchOrganizations();
    fetchPosts();
    fetchThreads();
    fetchGroups();
  };

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(`
        id,
        display_name,
        user_roles(role)
      `)
      .order('created_at', { ascending: false });

    setUsers(profiles || []);
  };

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    setOrganizations(data || []);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false });

    setPosts(data || []);
  };

  const fetchThreads = async () => {
    const { data } = await supabase
      .from('threads')
      .select(`
        *,
        profiles!threads_user_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false });

    setThreads(data || []);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    setGroups(data || []);
  };

  const assignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Missing information",
        description: "Please select both user and role",
        variant: "destructive",
      });
      return;
    }

    // Delete existing role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser);

    // Insert new role
    const { error } = await supabase
      .from('user_roles')
      .insert([{
        user_id: selectedUser,
        role: selectedRole as any,
        assigned_by: user?.id,
      }]);

    if (error) {
      toast({
        title: "Error assigning role",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Role assigned!",
        description: "User role has been updated",
      });
      fetchUsers();
      setSelectedUser('');
      setSelectedRole('');
    }
  };

  const createOrganization = async () => {
    if (!newOrg.name.trim()) {
      toast({
        title: "Missing name",
        description: "Please provide organization name",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('organizations')
      .insert(newOrg);

    if (error) {
      toast({
        title: "Error creating organization",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Organization created!",
        description: "New organization has been added",
      });
      setNewOrg({ name: '', description: '' });
      fetchOrganizations();
    }
  };

  const deleteOrganization = async (id: string) => {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting organization",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Organization deleted",
        description: "Organization has been removed",
      });
      fetchOrganizations();
    }
  };

  const deletePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      toast({
        title: 'Error deleting post',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Post deleted' });
      fetchPosts();
    }
  };

  const deleteThread = async (threadId: string) => {
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId);

    if (error) {
      toast({
        title: 'Error deleting thread',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Thread deleted' });
      fetchThreads();
    }
  };

  const deleteGroup = async (groupId: string) => {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      toast({
        title: 'Error deleting group',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Group deleted' });
      fetchGroups();
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="organizations">
              <Building className="h-4 w-4 mr-2" />
              Orgs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assign Roles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.display_name || 'Unknown User'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose role" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher (generic)</SelectItem>
                        <SelectItem value="officer">Officer (generic)</SelectItem>
                        <SelectItem value="teacher_cs">Teacher — Computer Society</SelectItem>
                        <SelectItem value="officer_cs">Officer — Computer Society</SelectItem>
                        <SelectItem value="teacher_fec">Teacher — Future Educators Club</SelectItem>
                        <SelectItem value="officer_fec">Officer — Future Educators Club</SelectItem>
                        <SelectItem value="teacher_ybc">Teacher — Young Businessman Club</SelectItem>
                        <SelectItem value="officer_ybc">Officer — Young Businessman Club</SelectItem>
                        <SelectItem value="teacher_sc">Teacher — Student Council</SelectItem>
                        <SelectItem value="officer_sc">Officer — Student Council</SelectItem>
                        <SelectItem value="teacher_tl">Teacher — The Lewisian</SelectItem>
                        <SelectItem value="officer_tl">Officer — The Lewisian</SelectItem>
                        <SelectItem value="teacher_tlc">Teacher — The Lewis College</SelectItem>
                        <SelectItem value="officer_tlc">Officer — The Lewis College</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={assignRole}>Assign Role</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Roles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell>{u.display_name || 'Unknown User'}</TableCell>
                        <TableCell>
                          {u.user_roles?.map((r: any) => r.role).join(', ') || 'No roles'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Posts ({posts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Likes</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="max-w-md truncate">{post.content}</TableCell>
                        <TableCell>{post.profiles?.display_name}</TableCell>
                        <TableCell>{post.likes_count}</TableCell>
                        <TableCell>{post.comments_count}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePost(post.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Groups ({groups.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Privacy</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>{group.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            group.privacy === 'private' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {group.privacy}
                          </span>
                        </TableCell>
                        <TableCell>{group.members_count}</TableCell>
                        <TableCell>
                          {new Date(group.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteGroup(group.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organizations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                    placeholder="e.g., Computer Science Club"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newOrg.description}
                    onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                    placeholder="Brief description"
                  />
                </div>
                <Button onClick={createOrganization}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Organization
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Organizations</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map(org => (
                      <TableRow key={org.id}>
                        <TableCell>{org.name}</TableCell>
                        <TableCell>{org.description}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteOrganization(org.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
