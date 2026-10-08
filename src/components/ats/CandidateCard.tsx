import { useState, useCallback, memo } from 'react';
import { Candidate } from '@/types/ats';
import { useATS } from '@/context/ATSContext';
import { DollarSign, StickyNote, Clock, X, Phone, Mail, UserCheck, Ban } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ActivityInfo {
  action: string;
  created_at: string;
  userName?: string;
}

interface Props {
  candidate: Candidate;
  onOpenDetail: (candidate: Candidate) => void;
  isSelected?: boolean;
  onSelect?: (candidateId: string, shiftKey: boolean) => void;
  lastActivity?: ActivityInfo | null;
}

export const CandidateCard = memo(function CandidateCard({ candidate, onOpenDetail, isSelected, onSelect, lastActivity }: Props) {
  const { deleteCandidate, rejectCandidate, positions, companies } = useATS();

  const position = positions.find(p => p.id === candidate.position_id);
  const company = position ? companies.find(c => c.id === position.company_id) : null;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteOpen(true);
  };

  const handleReject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectOpen(true);
  }, []);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(candidate.id, e.shiftKey);
  }, [candidate.id, onSelect]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey && onSelect) {
      e.preventDefault();
      onSelect(candidate.id, true);
      return;
    }
    onOpenDetail(candidate);
  }, [candidate, onOpenDetail, onSelect]);

  return (
    <>
    <div
      className={`bg-card rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow group relative ${
        isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Checkbox - visible on hover or when selected */}
      {onSelect && (
        <div
          className={`absolute top-2 left-2 z-10 transition-opacity ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={handleCheckboxClick}
        >
          <Checkbox checked={isSelected} className="bg-card" />
        </div>
      )}

      {/* Action buttons - fixed top-right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleReject}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <Ban className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Reject</TooltipContent>
        </Tooltip>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className={`pr-12 ${onSelect ? 'pl-5' : ''}`}>
        <span className="font-medium text-sm text-card-foreground">{candidate.name}</span>
      </div>
      {position && (
        <p className={`text-xs text-muted-foreground mt-1 truncate ${onSelect ? 'pl-5' : ''}`}>
          {position.title}{company ? ` · ${company.name}` : ''}
        </p>
      )}
      {candidate.phone && (
        <div className="flex items-center gap-1 mt-1.5">
          <Phone className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{candidate.phone}</span>
        </div>
      )}
      {candidate.email && (
        <div className="flex items-center gap-1 mt-1">
          <Mail className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">{candidate.email}</span>
        </div>
      )}
      {candidate.expected_salary && (
        <div className="flex items-center gap-1 mt-1.5">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{candidate.expected_salary}</span>
        </div>
      )}
      {candidate.notice_period && (
        <div className="flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{candidate.notice_period}</span>
        </div>
      )}
      {candidate.notes && (
        <div className="flex items-center gap-1 mt-1">
          <StickyNote className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">{candidate.notes.substring(0, 40)}</span>
        </div>
      )}
      {candidate.tags && candidate.tags.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 truncate">
          {candidate.tags.join(' · ')}
        </p>
      )}
      {lastActivity && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
          <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate">
            {lastActivity.userName ? `${lastActivity.userName}: ` : ''}{lastActivity.action} · {formatDistanceToNow(new Date(lastActivity.created_at), { addSuffix: true })}
          </span>
        </div>
      )}
    </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Candidate"
        description={`Delete "${candidate.name}"? This cannot be undone.`}
        onConfirm={() => deleteCandidate(candidate.id)}
      />
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject Candidate"
        description={`Reject "${candidate.name}"? They will be moved to the rejected list and removed from the pipeline.`}
        onConfirm={() => rejectCandidate(candidate.id)}
      />
    </>
  );
});
