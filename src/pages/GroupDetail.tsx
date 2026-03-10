import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Users, Edit, Trash2, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { awardTokens } from '@/lib/awardTokens';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [groupEditData, setGroupEditData] = useState({ name: '', description: '' });
  const [members, setMembers] = useState<any[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [creatorProfile, setCreatorProfile] = useState<any>(null);

  useEffect(() => {
    fetchGroup();
    checkMembership();
    fetchMembers();
  }, [id, user]);

  useEffect(() => {
    if (isMember) {
      fetchMessages();
      const channel = subscribeToMessages();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isMember]);

  const fetchGroup = async () => {
    const { data } = await supabase
      .from('groups')
      .select(`
        *,
        profiles!groups_creator_id_fkey(id, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (data) {
      setGroup(data);
      setGroupEditData({ name: data.name, description: data.description || '' });
      setIsCreator(data.creator_id === user?.id);
      setCreatorProfile(data.profiles);
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select(`
        user_id,
        is_admin,
        profiles!group_members_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq('group_id', id);

    setMembers(data || []);
  };

  const checkMembership = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('group_members')
      .select('is_admin')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .single();

    setIsMember(!!data);
    setIsAdmin(data?.is_admin || false);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('group_messages')
      .select(`
        *,
        profiles!group_messages_user_id_fkey(display_name, avatar_url)
      `)
      .eq('group_id', id)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`group-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return channel;
  };

  const joinGroup = async () => {
    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: id,
        user_id: user?.id,
      });

    if (error) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setIsMember(true);
      toast({ title: "Joined group!" });
      fetchGroup();
      if (user) {
        awardTokens({ type: 'group_joined', description: 'Joined a group' });
      }
    }
  };

  const leaveGroup = async () => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', id)
      .eq('user_id', user?.id);

    if (error) {
      toast({
        title: "Error leaving group",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Left group" });
      navigate('/groups');
    }
  };

  const deleteGroup = async () => {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting group",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Group deleted successfully" });
      navigate('/groups');
    }
  };

  const transferOwnership = async () => {
    if (!selectedNewOwner) return;

    // Update group creator
    const { error: groupError } = await supabase
      .from('groups')
      .update({ creator_id: selectedNewOwner })
      .eq('id', id);

    if (groupError) {
      toast({
        title: "Error transferring ownership",
        description: groupError.message,
        variant: "destructive",
      });
      return;
    }

    // Make new owner admin
    const { error: memberError } = await supabase
      .from('group_members')
      .update({ is_admin: true })
      .eq('group_id', id)
      .eq('user_id', selectedNewOwner);

    if (memberError) {
      toast({
        title: "Error updating admin status",
        description: memberError.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Ownership transferred successfully" });
    setTransferDialogOpen(false);
    fetchGroup();
    checkMembership();
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase
      .from('group_messages')
      .insert({
        group_id: id,
        user_id: user?.id,
        content: newMessage,
      });

    if (error) {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setNewMessage('');
    }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('group_messages')
      .delete()
      .eq('id', messageId);

    if (!error) {
      toast({ title: "Message deleted" });
    }
  };

  const updateGroup = async () => {
    const { error } = await supabase
      .from('groups')
      .update(groupEditData)
      .eq('id', id);

    if (error) {
      toast({
        title: "Error updating group",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Group updated!" });
      setEditDialogOpen(false);
      fetchGroup();
    }
  };

  if (!group) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/groups')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          {isMember && !isCreator && (
            <Button variant="outline" onClick={leaveGroup}>
              Leave Group
            </Button>
          )}
          {isCreator && (
            <div className="flex space-x-2">
              <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Crown className="h-4 w-4 mr-2" />
                    Transfer Ownership
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transfer Group Ownership</DialogTitle>
                    <DialogDescription>
                      Select a member to transfer ownership to. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Label>Select New Owner</Label>
                    <Select value={selectedNewOwner} onValueChange={setSelectedNewOwner}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members
                          .filter(m => m.user_id !== user?.id)
                          .map(member => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.profiles?.display_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={transferOwnership} disabled={!selectedNewOwner}>
                      Transfer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the group and all its messages. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteGroup} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-bold">{group.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {group.members_count} members • {group.privacy === 'private' ? 'Private' : 'Public'}
                  </p>
                  {creatorProfile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Created by {creatorProfile.display_name}
                    </p>
                  )}
                </div>
              </div>
              {isAdmin && (
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Group Name</Label>
                        <Input
                          value={groupEditData.name}
                          onChange={(e) => setGroupEditData({ ...groupEditData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={groupEditData.description}
                          onChange={(e) => setGroupEditData({ ...groupEditData, description: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={updateGroup}>Save Changes</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {group.description && (
              <p className="text-muted-foreground mt-2">{group.description}</p>
            )}
          </CardHeader>
        </Card>

        {!isMember ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Join this group to participate in discussions
              </p>
              <Button onClick={joinGroup}>Join Group</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <h3 className="font-semibold">Group Chat</h3>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4 p-4">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.user_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start space-x-2 ${isOwn ? 'justify-end' : ''}`}
                      >
                        {!isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback>
                              {msg.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}
                        >
                          {!isOwn && (
                            <p className="text-xs font-semibold mb-1 text-muted-foreground">
                              {msg.profiles?.display_name || 'Unknown'}
                            </p>
                          )}
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              isOwn
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </p>
                            {isOwn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => deleteMessage(msg.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback>
                              {msg.profiles?.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button onClick={sendMessage} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
