import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles?: { name: string } | null;
}

interface Props {
  boardId: string;
  getBoardMembers: (boardId: string) => Promise<any[]>;
  max?: number;
  onClick?: () => void;
}

export function BoardMembersAvatars({ boardId, getBoardMembers, max = 3, onClick }: Props) {
  const [members, setMembers] = useState<Member[]>([]);

  const fetch = useCallback(async () => {
    const data = await getBoardMembers(boardId);
    setMembers(data || []);
  }, [boardId, getBoardMembers]);

  useEffect(() => { fetch(); }, [fetch]);

  if (members.length === 0) return null;

  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const getInitial = (m: Member) => (m.profiles?.name || '?')[0].toUpperCase();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="flex items-center -space-x-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Board members"
          onClick={onClick}
        >
          {visible.map((m) => (
            <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
              <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                {m.role === 'owner' ? <Crown className="h-3 w-3 text-primary" /> : getInitial(m)}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 && (
            <Avatar className="h-6 w-6 border-2 border-background">
              <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                +{overflow}
              </AvatarFallback>
            </Avatar>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>Manage board access</TooltipContent>
    </Tooltip>
  );
}