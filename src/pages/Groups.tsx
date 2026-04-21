import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Groups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    privacy: 'public',
  });

  useEffect(() => {
    fetchGroups();
    fetchMyGroups();
  }, []);

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('privacy', 'public')
      .order('created_at', { ascending: false });
    
    setGroups(data || []);
  };

  const fetchMyGroups = async () => {
    if (!user) return;
    
    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberData) return;

    const groupIds = memberData.map(m => m.group_id);
    
    if (groupIds.length === 0) {
      setMyGroups([]);
      return;
    }

    const { data } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });
    
    setMyGroups(data || []);
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) {
      toast({
        title: "Missing name",
        description: "Please provide a group name",
        variant: "destructive",
      });
      return;
    }

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: newGroup.name,
        description: newGroup.description,
        creator_id: user?.id,
        privacy: newGroup.privacy,
      })
      .select()
      .single();

    if (groupError) {
      toast({
        title: "Error creating group",
        description: groupError.message,
        variant: "destructive",
      });
      return;
    }

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('group_members')
      .insert({
        group_id: groupData.id,
        user_id: user?.id,
        is_admin: true,
      } as any);

    if (memberError) {
      toast({
        title: "Joined partially",
        description: memberError.message,
        variant: "destructive",
      });
    }

    toast({
      title: "Group created!",
      description: "Redirecting to your new group...",
    });

    setNewGroup({ name: '', description: '', privacy: 'public' });
    setDialogOpen(false);
    navigate(`/groups/${groupData.id}`);
  };

  const sortGroups = (groupsList: any[]) => {
    const sorted = [...groupsList];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'members':
        return sorted.sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
      case 'date':
      default:
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  };

  const filteredGroups = sortGroups(
    groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredMyGroups = sortGroups(
    myGroups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center bg-gradient-primary bg-clip-text text-transparent">
              <Users className="h-8 w-8 mr-2 text-primary" />
              Groups
            </h1>
            <p className="text-muted-foreground mt-1">
              Join groups and connect with your community
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md">
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
                <DialogDescription>
                  Start a new community group
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    placeholder="e.g., Study Group, Gaming Friends"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    placeholder="What is this group about?"
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy">Privacy</Label>
                  <Select
                    value={newGroup.privacy}
                    onValueChange={(value) => setNewGroup({ ...newGroup, privacy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public - Anyone can join</SelectItem>
                      <SelectItem value="private">Private - Invite only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createGroup}>Create Group</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Input
              type="search"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date Created</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="members">Members</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="public" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="public">Public Groups</TabsTrigger>
            <TabsTrigger value="my-groups">My Groups</TabsTrigger>
          </TabsList>
          
          <TabsContent value="public" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group) => (
                <Link key={group.id} to={`/groups/${group.id}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="line-clamp-1">{group.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {group.members_count || 0} {group.members_count === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    {group.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>

            {filteredGroups.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No groups found matching your search.' : 'No public groups yet. Create the first one!'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my-groups" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyGroups.map((group) => (
                <Link key={group.id} to={`/groups/${group.id}`}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="line-clamp-1">{group.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {group.members_count || 0} {group.members_count === 1 ? 'member' : 'members'}
                            {group.privacy === 'private' && ' • Private'}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    {group.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {group.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              ))}
            </div>

            {filteredMyGroups.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No groups found matching your search.' : 'You haven\'t joined any groups yet.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
