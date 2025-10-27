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
  const [newOrg, setNewOrg] = useState({ name: '', description: '' });
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!data) {
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

  const assignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Missing information",
        description: "Please select both user and role",
        variant: "destructive",
      });
      return;
    }

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
          <TabsList>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users & Roles
            </TabsTrigger>
            <TabsTrigger value="organizations">
              <Building className="h-4 w-4 mr-2" />
              Organizations
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
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="officer">Officer</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
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
