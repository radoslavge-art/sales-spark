import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, UserPlus, Users, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

interface Member {
  id: string;
  board_id: string;
  user_id: string;
  role: string;
  profiles?: { name: string; email?: string } | null;
}

interface UserProfile {
  id: string;
  name: string;
}

interface Props {
  boardId: string;
  boardName?: string;
  boardOwnerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBoardMember: (boardId: string, userId: string, role?: string) => Promise<void>;
  updateBoardMemberRole?: (boardId: string, userId: string, role: string) => Promise<void>;
  removeBoardMember: (boardId: string, userId: string) => Promise<void>;
  getBoardMembers: (boardId: string) => Promise<any[]>;
}

const roleBadgeClass: Record<string, string> = {
  owner: 'bg-primary/10 text-primary border-primary/20',
  editor: 'bg-accent/60 text-accent-foreground border-accent/30',
  viewer: 'bg-muted text-muted-foreground border-border',
};

export function ShareBoardDialog({
  boardId, boardName, boardOwnerId, open, onOpenChange,
  addBoardMember, updateBoardMemberRole, removeBoardMember, getBoardMembers,
}: Props) {
  const { t } = useLanguage();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const fetchMembers = useCallback(async () => {
    const data = await getBoardMembers(boardId);
    setMembers(data || []);
  }, [boardId, getBoardMembers]);

  const fetchAllUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, name').order('name');
    setAllUsers((data || []).filter((u: any) => u.name?.trim()));
  }, []);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAllUsers();
      setSelectedUserId('');
      setSelectedRole('viewer');
    }
  }, [open, fetchMembers, fetchAllUsers]);

  const ownerMember = members.find(m => m.role === 'owner');
  const otherMembers = members.filter(m => m.role !== 'owner');

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    if (boardOwnerId) memberIds.add(boardOwnerId);
    return allUsers.filter(u => !memberIds.has(u.id));
  }, [allUsers, members, boardOwnerId]);

  const handleAdd = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    try {
      const user = allUsers.find(u => u.id === selectedUserId);
      await addBoardMember(boardId, selectedUserId, selectedRole);
      setSelectedUserId('');
      await fetchMembers();
      toast.success(t('shareBoard.addedAs', { name: user?.name || 'User', role: selectedRole }));
    } catch {
      toast.error(t('shareBoard.failedToAdd'));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (updateBoardMemberRole) {
      await updateBoardMemberRole(boardId, userId, newRole);
      await fetchMembers();
      toast.success(t('shareBoard.roleUpdated'));
    }
  };

  const handleRemove = async (userId: string) => {
    await removeBoardMember(boardId, userId);
    await fetchMembers();
    toast.success(t('shareBoard.memberRemoved'));
  };

  const getInitials = (name?: string) => (name || '?')[0].toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{t('shareBoard.title')}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {boardName ? t('shareBoard.desc', { name: boardName }) : ''}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 pb-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">{t('shareBoard.inviteUser')}</p>
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1 h-9 text-sm">
                <SelectValue placeholder={t('shareBoard.selectUser')} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{t('shareBoard.noUsersAvailable')}</p>
                ) : (
                  availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[90px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t('shareBoard.editor')}</SelectItem>
                <SelectItem value="viewer">{t('shareBoard.viewer')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedUserId || loading} size="sm" className="h-9 px-3 gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserPlus className="h-3.5 w-3.5" /> {t('common.invite')}</>}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="px-5 py-3">
          <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {t('shareBoard.members', { count: members.length })}
          </p>

          <ScrollArea className="max-h-[280px]">
            <div className="space-y-0.5">
              {ownerMember && (
                <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg bg-primary/5">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                      <Crown className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ownerMember.profiles?.name || t('shareBoard.boardOwner')}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${roleBadgeClass.owner}`}>{t('shareBoard.owner')}</Badge>
                </div>
              )}

              {otherMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/40 transition-colors group">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                      {getInitials(m.profiles?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.profiles?.name || t('shareBoard.unknownUser')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Select value={m.role} onValueChange={(v) => handleRoleChange(m.user_id, v)}>
                      <SelectTrigger className="h-7 w-[80px] text-[10px] border-transparent hover:border-border transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">{t('shareBoard.editor')}</SelectItem>
                        <SelectItem value="viewer">{t('shareBoard.viewer')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => handleRemove(m.user_id)}
                      className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-all"
                      title={t('shareBoard.removeMember')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {otherMembers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {t('shareBoard.noMembers')}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
