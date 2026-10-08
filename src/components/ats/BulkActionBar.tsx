import { useState } from 'react';
import { Trash2, ArrowRight, X, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stage } from '@/types/ats';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useLanguage } from '@/context/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  count: number;
  stages: Stage[];
  onMoveToStage: (stageId: string) => void;
  onReject: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({ count, stages, onMoveToStage, onReject, onDelete, onClearSelection }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { t } = useLanguage();

  if (count === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border shadow-lg rounded-lg px-4 py-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {t('bulk.selected', { count })}
        </span>

        <div className="h-5 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowRight className="h-4 w-4 mr-1" />
              {t('bulk.moveToStage')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="max-h-60 overflow-y-auto">
            {stages.map(stage => (
              <DropdownMenuItem key={stage.id} onClick={() => onMoveToStage(stage.id)}>
                <div
                  className="h-2 w-2 rounded-full shrink-0 mr-2"
                  style={{ backgroundColor: `hsl(var(--stage-${stage.color}-accent))` }}
                />
                {stage.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          className="text-orange-600 border-orange-300/50 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:border-orange-700/50 dark:hover:bg-orange-950"
        >
          <Ban className="h-4 w-4 mr-1" />
          {t('bulk.reject')}
        </Button>

        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" />
          {t('bulk.delete')}
        </Button>

        <button
          onClick={onClearSelection}
          className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('bulk.deleteCandidates')}
        description={t('candidate.deleteCandidatesConfirm', { count, plural: count > 1 ? 's' : '' })}
        onConfirm={onDelete}
      />
    </>
  );
}
