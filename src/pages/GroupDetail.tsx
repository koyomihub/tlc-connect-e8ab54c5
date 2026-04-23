import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Send, Users, Edit, Trash2, Crown, Camera, UserPlus, Lock, Globe, Check, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { awardTokens } from '@/lib/awardTokens';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [groupEditData, setGroupEditData] = useState({ name: '', description: '' });
  const [members, setMembers] = useState<any[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<false | 'cover' | 'avatar'>(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [repositioning, setRepositioning] = useState(false);
  const [coverPosition, setCoverPosition] = useState<string>('center');
  const [draftPosition, setDraftPosition] = useState<string>('center');
  const coverRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    fetchGroup();
    checkMembership();
    fetchMembers();
  }, [id, user]);

  useEffect(() => {
    if (isMember) {
      fetchMessages();
      const channel = subscribeToMessages();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isMember]);

  useEffect(() => {
    if (isAdmin && id) fetchJoinRequests();
  }, [isAdmin, id]);

  useEffect(() => {
    if (!user || !id) return;
    if (!isMember) checkPendingRequest();
    fetchPendingInvitations();
  }, [user, id, isMember]);

  const fetchGroup = async () => {
    const { data } = await supabase
      .from('groups')
      .select(`*, profiles!groups_creator_id_fkey(id, display_name, avatar_url)`)
      .eq('id', id)
      .single();

    if (data) {
      setGroup(data);
      setGroupEditData({ name: data.name, description: data.description || '' });
      setIsCreator(data.creator_id === user?.id);
      setCreatorProfile(data.profiles);
      const pos = (data as any).cover_position || 'center';
      setCoverPosition(pos);
      setDraftPosition(pos);
    }
  };

  const fetchFollowers = async () => {
    if (!user) return;
    // People the current user follows
    const { data } = await supabase
      .from('follows')
      .select('following_id, profiles:following_id (id, display_name, avatar_url)')
      .eq('follower_id', user.id);
    const memberIds = new Set(members.map((m) => m.user_id));
    const list = (data || [])
      .map((row: any) => row.profiles)
      .filter((p: any) => p && !memberIds.has(p.id));
    setFollowers(list);
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('group_members')
      .select(`user_id, is_admin, profiles!group_members_user_id_fkey(id, display_name, avatar_url)`)
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
      .maybeSingle();
    setIsMember(!!data);
    setIsAdmin(data?.is_admin || false);
  };

  const checkPendingRequest = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_join_requests')
      .select('id')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();
    setHasPendingRequest(!!data);
  };

  const fetchPendingInvitations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('group_invitations')
      .select(`*, inviter:profiles!group_invitations_inviter_id_fkey(id, display_name, avatar_url)`)
      .eq('group_id', id)
      .eq('invitee_id', user.id)
      .eq('status', 'pending');
    setPendingInvitations(data || []);
  };

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    if (accept) {
      // Add as member first, then mark accepted
      const { error: memberErr } = await supabase
        .from('group_members')
        .insert({ group_id: id, user_id: user?.id });
      if (memberErr && !memberErr.message.includes('duplicate')) {
        toast({ title: 'Could not join', description: memberErr.message, variant: 'destructive' });
        return;
      }
      await supabase.from('group_invitations').update({ status: 'accepted' }).eq('id', invitationId);
      toast({ title: 'Invitation accepted — welcome!' });
      setIsMember(true);
      fetchGroup();
      fetchMembers();
    } else {
      await supabase.from('group_invitations').update({ status: 'rejected' }).eq('id', invitationId);
      toast({ title: 'Invitation declined' });
    }
    fetchPendingInvitations();
  };

  const fetchJoinRequests = async () => {
    const { data } = await supabase
      .from('group_join_requests')
      .select(`*, profiles:user_id (id, display_name, avatar_url)`)
      .eq('group_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setJoinRequests(data || []);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('group_messages')
      .select(`*, profiles!group_messages_user_id_fkey(display_name, avatar_url)`)
      .eq('group_id', id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`group-${id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` },
        () => fetchMessages())
      .subscribe();
    return channel;
  };

  const isPrivate = group?.privacy === 'private';

  const joinGroup = async () => {
    if (isPrivate) {
      // Request to join
      const { error } = await supabase
        .from('group_join_requests')
        .insert({ group_id: id, user_id: user?.id });
      if (error) {
        toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
      } else {
        setHasPendingRequest(true);
        toast({ title: 'Request sent', description: 'The group admin will review your request.' });
      }
      return;
    }

    const { error } = await supabase
      .from('group_members')
      .insert({ group_id: id, user_id: user?.id });

    if (error) {
      toast({ title: 'Error joining group', description: error.message, variant: 'destructive' });
    } else {
      setIsMember(true);
      toast({ title: 'Joined group!' });
      fetchGroup();
      if (user) awardTokens({ type: 'group_joined', description: 'Joined a group' });
    }
  };

  const cancelJoinRequest = async () => {
    if (!user) return;
    await supabase
      .from('group_join_requests')
      .delete()
      .eq('group_id', id)
      .eq('user_id', user.id);
    setHasPendingRequest(false);
    toast({ title: 'Request cancelled' });
  };

  const respondToRequest = async (requestId: string, approve: boolean) => {
    const { error } = await supabase
      .from('group_join_requests')
      .update({ status: approve ? 'approved' : 'rejected' })
      .eq('id', requestId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: approve ? 'Member approved' : 'Request rejected' });
      fetchJoinRequests();
      fetchGroup();
      fetchMembers();
    }
  };

  const leaveGroup = async () => {
    const { error } = await supabase
      .from('group_members').delete()
      .eq('group_id', id).eq('user_id', user?.id);
    if (error) toast({ title: 'Error leaving group', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Left group' }); navigate('/groups'); }
  };

  const deleteGroup = async () => {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) toast({ title: 'Error deleting group', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Group deleted successfully' }); navigate('/groups'); }
  };

  const transferOwnership = async () => {
    if (!selectedNewOwner) return;
    const { error: groupError } = await supabase
      .from('groups').update({ creator_id: selectedNewOwner }).eq('id', id);
    if (groupError) {
      toast({ title: 'Error transferring ownership', description: groupError.message, variant: 'destructive' });
      return;
    }
    const { error: memberError } = await supabase
      .from('group_members').update({ is_admin: true })
      .eq('group_id', id).eq('user_id', selectedNewOwner);
    if (memberError) {
      toast({ title: 'Error updating admin status', description: memberError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Ownership transferred successfully' });
    setTransferDialogOpen(false);
    fetchGroup();
    checkMembership();
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const { error } = await supabase
      .from('group_messages')
      .insert({ group_id: id, user_id: user?.id, content: newMessage });
    if (error) toast({ title: 'Error sending message', description: error.message, variant: 'destructive' });
    else setNewMessage('');
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('group_messages').delete().eq('id', messageId);
    if (!error) toast({ title: 'Message deleted' });
  };

  const updateGroup = async () => {
    const { error } = await supabase.from('groups').update(groupEditData).eq('id', id);
    if (error) toast({ title: 'Error updating group', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Group updated!' }); setEditDialogOpen(false); fetchGroup(); }
  };

  const handlePhotoUpload = (kind: 'cover' | 'avatar') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(kind);
    try {
      const ext = file.name.split('.').pop();
      const path = `group-photos/${id}-${kind}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
      const update = kind === 'cover'
        ? { image_url: urlData.publicUrl }
        : { avatar_url: urlData.publicUrl };
      const { error: updateError } = await supabase
        .from('groups').update(update as any).eq('id', id);
      if (updateError) throw updateError;
      toast({ title: kind === 'cover' ? 'Cover photo updated!' : 'Group photo updated!' });
      fetchGroup();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      const ref = kind === 'cover' ? coverInputRef : avatarInputRef;
      if (ref.current) ref.current.value = '';
    }
  };

  // Load followers when invite dialog opens
  useEffect(() => {
    if (inviteDialogOpen) {
      setInviteSearch('');
      fetchFollowers();
    }
  }, [inviteDialogOpen, members, user?.id]);

  // Invite people: search profiles
  useEffect(() => {
    const run = async () => {
      if (!inviteSearch.trim()) { setInviteResults([]); return; }
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${inviteSearch}%`)
        .limit(10);
      const memberIds = new Set(members.map((m) => m.user_id));
      setInviteResults((data || []).filter((p) => !memberIds.has(p.id) && p.id !== user?.id));
    };
    run();
  }, [inviteSearch, members, user?.id]);

  const sendInvite = async (inviteeId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('group_invitations')
      .insert({ group_id: id, inviter_id: user.id, invitee_id: inviteeId });
    if (error) {
      toast({ title: 'Could not send invite', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Invite sent!' });
      setInviteResults((prev) => prev.filter((p) => p.id !== inviteeId));
      setFollowers((prev) => prev.filter((p) => p.id !== inviteeId));
    }
  };

  // Cover photo reposition (drag vertically to set object-position)
  const handleCoverPointerDown = (e: React.PointerEvent) => {
    if (!repositioning) return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateDraftFromPointer(e);
  };
  const handleCoverPointerMove = (e: React.PointerEvent) => {
    if (!repositioning || !draggingRef.current) return;
    updateDraftFromPointer(e);
  };
  const handleCoverPointerUp = () => { draggingRef.current = false; };

  const updateDraftFromPointer = (e: React.PointerEvent) => {
    const el = coverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const pct = Math.round((y / rect.height) * 100);
    setDraftPosition(`center ${pct}%`);
  };

  const saveCoverPosition = async () => {
    const { error } = await supabase
      .from('groups')
      .update({ cover_position: draftPosition } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Could not save position', description: error.message, variant: 'destructive' });
    } else {
      setCoverPosition(draftPosition);
      setRepositioning(false);
      toast({ title: 'Cover position saved' });
    }
  };

  const cancelReposition = () => {
    setDraftPosition(coverPosition);
    setRepositioning(false);
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

  // Members can invite to public groups; only admins can invite to private groups
  const canInvite = isMember && (!isPrivate || isAdmin);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" onClick={() => navigate('/groups')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          <div className="flex space-x-2 flex-wrap gap-2">
            {canInvite && (
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite People
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite People</DialogTitle>
                    <DialogDescription>
                      {inviteSearch.trim()
                        ? 'Search results'
                        : 'People you follow are shown below. You can also search for anyone.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    placeholder="Search by name..."
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {(inviteSearch.trim() ? inviteResults : followers).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback>{p.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{p.display_name}</span>
                        </div>
                        <Button size="sm" onClick={() => sendInvite(p.id)}>Invite</Button>
                      </div>
                    ))}
                    {inviteSearch.trim() && inviteResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No people found</p>
                    )}
                    {!inviteSearch.trim() && followers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        You're not following anyone yet. Use the search above to find people.
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {isMember && !isCreator && (
              <Button variant="outline" size="sm" onClick={leaveGroup}>Leave Group</Button>
            )}
            {isCreator && (
              <>
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
                        <SelectTrigger><SelectValue placeholder="Choose a member" /></SelectTrigger>
                        <SelectContent>
                          {members.filter((m) => m.user_id !== user?.id).map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.profiles?.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
                      <Button onClick={transferOwnership} disabled={!selectedNewOwner}>Transfer</Button>
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
              </>
            )}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className={`relative h-48 w-full overflow-hidden ${
            group.image_url ? 'bg-muted' : 'bg-gradient-primary'
          }`}>
            {/* Drag layer (image only) — buttons are siblings so they don't trigger drag */}
            <div
              ref={coverRef}
              onPointerDown={handleCoverPointerDown}
              onPointerMove={handleCoverPointerMove}
              onPointerUp={handleCoverPointerUp}
              onPointerCancel={handleCoverPointerUp}
              className={`absolute inset-0 ${repositioning ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
            >
              {group.image_url ? (
                <img
                  src={group.image_url}
                  alt={group.name}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: repositioning ? draftPosition : coverPosition }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users className="h-16 w-16 text-white/80" />
                </div>
              )}
            </div>

            {isAdmin && !repositioning && (
              <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={!!uploadingPhoto}
                  className="bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow hover:bg-accent transition flex items-center gap-1.5"
                  aria-label="Change cover photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {uploadingPhoto === 'cover' ? 'Uploading…' : 'Change Cover'}
                </button>
                {group.image_url && (
                  <button
                    type="button"
                    onClick={() => setRepositioning(true)}
                    className="bg-background/90 backdrop-blur border border-border rounded-full px-3 py-1.5 text-xs font-medium shadow hover:bg-accent transition"
                  >
                    Reposition
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload('cover')}
                  className="hidden"
                />
              </div>
            )}

            {isAdmin && repositioning && (
              <>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur rounded-full px-3 py-1 text-xs shadow z-10 pointer-events-none">
                  Drag the image to reposition
                </div>
                <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                  <Button size="sm" variant="outline" onClick={cancelReposition}>Cancel</Button>
                  <Button size="sm" onClick={saveCoverPosition}>Save Position</Button>
                </div>
              </>
            )}
          </div>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {group.avatar_url ? (
                      <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="h-8 w-8 text-white" />
                    )}
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={!!uploadingPhoto}
                        className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full p-1.5 shadow hover:bg-accent transition"
                        aria-label="Change group photo"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload('avatar')}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {group.name}
                    {isPrivate ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {group.members_count} members • {isPrivate ? 'Private' : 'Public'}
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

        {/* Pending invitation for the current user */}
        {pendingInvitations.length > 0 && !isMember && (
          <Card className="border-primary">
            <CardHeader>
              <h3 className="font-semibold">You have an invitation</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/40">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={inv.inviter?.avatar_url} />
                      <AvatarFallback>{inv.inviter?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm">
                      <span className="font-medium">{inv.inviter?.display_name || 'Someone'}</span> invited you to join this group
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => respondToInvitation(inv.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respondToInvitation(inv.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Admin: pending join requests */}
        {isAdmin && joinRequests.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Pending Join Requests ({joinRequests.length})</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {joinRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/40">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={req.profiles?.avatar_url} />
                      <AvatarFallback>{req.profiles?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{req.profiles?.display_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => respondToRequest(req.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respondToRequest(req.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!isMember ? (
          <Card className="text-center py-12">
            <CardContent>
              {isPrivate ? (
                <>
                  <Lock className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    This is a private group. Request to join and an admin will review your request.
                  </p>
                  {hasPendingRequest ? (
                    <Button variant="outline" onClick={cancelJoinRequest}>
                      Pending — Cancel Request
                    </Button>
                  ) : (
                    <Button onClick={joinGroup}>Request to Join</Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">
                    Join this group to participate in discussions
                  </p>
                  <Button onClick={joinGroup}>Join Group</Button>
                </>
              )}
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
                      <div key={msg.id} className={`flex items-start space-x-2 ${isOwn ? 'justify-end' : ''}`}>
                        {!isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback>{msg.profiles?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                          {!isOwn && (
                            <p className="text-xs font-semibold mb-1 text-muted-foreground">
                              {msg.profiles?.display_name || 'Unknown'}
                            </p>
                          )}
                          <div className={`rounded-lg px-4 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </p>
                            {isOwn && (
                              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => deleteMessage(msg.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {isOwn && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.profiles?.avatar_url} />
                            <AvatarFallback>{msg.profiles?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
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
