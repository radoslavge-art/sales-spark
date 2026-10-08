import { useState, useRef, useEffect } from 'react';
import {
  Plus, Users, Copy, Pencil, Share2, Trash2, MoreHorizontal, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import type { Board } from '@/hooks/useBoardManager';

interface BoardSwitcherProps {
  boards: Board[];
  activeBoard: Board | undefined;
  activeBoardId: string;
  isSharedBoard: boolean;
  userId: string | undefined;
  setActiveBoardId: (id: string) => void;
  createBoard: (name: string) => any;
  createSharedBoard: (name: string) => Promise<any>;
  renameBoard: (id: string, name: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  duplicateBoard: (id: string) => Promise<any>;
  onShareOpen: () => void;
}

export function BoardSwitcher({
  boards, activeBoard, activeBoardId, isSharedBoard, userId,
  setActiveBoardId, createBoard, createSharedBoard, renameBoard, deleteBoard,
  duplicateBoard, onShareOpen,
}: BoardSwitcherProps) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteConfirmBoard, setDeleteConfirmBoard] = useState<Board | null>(null);
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) setTimeout(() => newRef.current?.focus(), 0);
  }, [creating]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createSharedBoard(newName.trim()).then(() => toast.success(t('boardSwitcher.boardCreated')));
    setNewName('');
    setCreating(false);
  };

  const canDeleteBoard = (b: Board) => !b.isDefault && (b.isShared ? b.owner_id === userId : true);

  const myBoards = boards.filter(b => b.isDefault || b.isLocal || (b.isShared && b.owner_id === userId));
  const sharedWithMe = boards.filter(b => b.isShared && b.owner_id !== userId);
  const allBoards = [...myBoards, ...sharedWithMe];

  return (
    <>
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {allBoards.map((b, idx) => {
            const isActive = b.id === activeBoardId;
            const isShared = b.isShared;

            return (
              <div key={b.id} className="flex items-center shrink-0">
                {/* Divider between tabs */}
                {idx > 0 && (
                  <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
                )}
                <div className="relative group/tab flex items-center shrink-0">
                  <button
                    onClick={() => setActiveBoardId(b.id)}
                    className={`
                      flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                      ${isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }
                    `}
                  >
                    <span className="truncate max-w-[120px]">{b.name}</span>
                    {isShared && <Users className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/50'}`} />}
                  </button>

                  {/* ⋯ menu — always visible on active, hover on others */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={`
                          absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm flex items-center justify-center transition-opacity
                          ${isActive
                            ? 'opacity-80 text-primary-foreground hover:opacity-100 hover:bg-primary-foreground/15'
                            : 'opacity-0 group-hover/tab:opacity-100 text-muted-foreground/60 hover:text-foreground hover:bg-muted'
                          }
                        `}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => {
                        const val = window.prompt(t('boardSwitcher.rename'), b.name);
                        if (val && val.trim() && val.trim() !== b.name) {
                          renameBoard(b.id, val.trim());
                          toast.success(t('boardSwitcher.boardRenamed'));
                        }
                      }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> {t('boardSwitcher.rename')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        await duplicateBoard(b.id);
                        toast.success(t('boardSwitcher.boardDuplicated'));
                      }}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> {t('boardSwitcher.duplicate')}
                      </DropdownMenuItem>
                      {(isShared || !b.isLocal) && (
                        <DropdownMenuItem onClick={() => {
                          setActiveBoardId(b.id);
                          onShareOpen();
                        }}>
                          <Share2 className="h-3.5 w-3.5 mr-2" /> {t('boardSwitcher.share')}
                        </DropdownMenuItem>
                      )}
                      {canDeleteBoard(b) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmBoard(b)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {/* Divider before + */}
          {allBoards.length > 0 && (
            <div className="h-4 w-px bg-border mx-1 shrink-0" />
          )}

          {/* New board */}
          {creating ? (
            <form onSubmit={e => { e.preventDefault(); handleCreate(); }} className="flex items-center gap-1 shrink-0">
              <Input
                ref={newRef}
                placeholder={t('boardSwitcher.boardNamePlaceholder')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-8 text-sm w-[140px] px-2"
                onKeyDown={e => { if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              />
              <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={!newName.trim()}>
                {t('common.create')}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setCreating(false); setNewName(''); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </form>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCreating(true)}
                  className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t('boardSwitcher.newBoard')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmBoard} onOpenChange={(v) => { if (!v) setDeleteConfirmBoard(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('boardSwitcher.deleteConfirmTitle', { name: deleteConfirmBoard?.name || '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('boardSwitcher.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmBoard) {
                  deleteBoard(deleteConfirmBoard.id);
                  toast.success(t('boardSwitcher.boardDeleted'));
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
