import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { PresenceUser } from '@/hooks/useBoardPresence';

interface Props {
  users: PresenceUser[];
  currentUserId?: string;
}

const COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
];

function getInitials(name: string, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : '??';
}

function hashIndex(str: string, max: number): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

export const BoardPresenceAvatars = memo(function BoardPresenceAvatars({ users, currentUserId }: Props) {
  if (users.length === 0) return null;

  // Show other users first, then current user
  const others = users.filter(u => u.userId !== currentUserId);
  const self = users.find(u => u.userId === currentUserId);
  const display = [...others, ...(self ? [self] : [])];
  const maxShow = 5;
  const visible = display.slice(0, maxShow);
  const overflow = display.length - maxShow;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-1.5">
        {visible.map((u) => {
          const isSelf = u.userId === currentUserId;
          const label = isSelf ? 'You' : (u.name || u.email || 'Unknown');
          const colorClass = COLORS[hashIndex(u.userId, COLORS.length)];

          return (
            <Tooltip key={u.userId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className={`h-7 w-7 border-2 border-background ${isSelf ? 'opacity-70' : ''}`}>
                    <AvatarFallback className={`${colorClass} text-white text-[10px] font-semibold`}>
                      {getInitials(u.name, u.email)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Green online dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{label}</p>
                <p className="text-muted-foreground">Viewing this board</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
                  +{overflow}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {display.slice(maxShow).map(u => (
                <p key={u.userId}>{u.name || u.email}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
});
