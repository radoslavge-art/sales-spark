import { useState, useEffect, useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { Candidate } from '@/types/ats';
import {
  ArrowLeft, Phone, Mail, DollarSign, Clock, ChevronRight,
  Trash2, StickyNote, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ActivityFeed } from '@/components/ats/ActivityFeed';
import { CandidateAttachments } from '@/components/ats/CandidateAttachments';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  candidate: Candidate;
  onBack: () => void;
}

export function MobileCandidateDetail({ candidate: initialCandidate, onBack }: Props) {
  const { candidates, positions, companies, getCompanyStages, updateCandidate, deleteCandidate } = useATS();

  // Always use latest candidate data from context
  const candidate = candidates.find(c => c.id === initialCandidate.id) || initialCandidate;

  const position = positions.find(p => p.id === candidate.position_id);
  const company = position ? companies.find(c => c.id === position.company_id) : null;
  const stages = company ? getCompanyStages(company.id) : [];
  const currentStage = stages.find(s => s.id === candidate.stage_id);

  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);

  const currentStageIndex = stages.findIndex(s => s.id === candidate.stage_id);
  const nextStage = currentStageIndex >= 0 && currentStageIndex < stages.length - 1
    ? stages[currentStageIndex + 1]
    : null;

  const handleMoveToStage = async (stageId: string) => {
    await updateCandidate(candidate.id, { stage_id: stageId });
    const stage = stages.find(s => s.id === stageId);
    toast.success(`Moved to ${stage?.label}`);
    setStagePickerOpen(false);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    const existing = candidate.notes || '';
    const timestamp = new Date().toLocaleDateString();
    const updated = existing
      ? `${existing}\n\n[${timestamp}] ${noteText.trim()}`
      : `[${timestamp}] ${noteText.trim()}`;
    await updateCandidate(candidate.id, { notes: updated });
    setNoteText('');
    setShowNoteInput(false);
    toast.success('Note added');
  };

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    setDeleteOpen(true);
  };

  return (
    <>
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg active:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground truncate">{candidate.name}</h2>
          {position && (
            <p className="text-xs text-muted-foreground truncate">
              {position.title}{company ? ` · ${company.name}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Current stage + Move action */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Current Stage</p>
            <div className="flex items-center justify-between">
              {currentStage ? (
                <Badge className="text-sm px-3 py-1">{currentStage.label}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
              {nextStage && (
                <Button
                  size="sm"
                  onClick={() => handleMoveToStage(nextStage.id)}
                  className="gap-1.5"
                >
                  Move to {nextStage.label} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {/* All stages picker */}
            <button
              onClick={() => setStagePickerOpen(!stagePickerOpen)}
              className="text-xs text-primary mt-3 font-medium"
            >
              {stagePickerOpen ? 'Hide stages' : 'Choose stage...'}
            </button>
            {stagePickerOpen && (
              <div className="mt-2 space-y-1">
                {stages.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleMoveToStage(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      s.id === candidate.stage_id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-foreground active:bg-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            {candidate.phone && (
              <a href={`tel:${candidate.phone}`} className="flex items-center gap-3 text-sm text-foreground active:text-primary">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                {candidate.phone}
              </a>
            )}
            {candidate.email && (
              <a href={`mailto:${candidate.email}`} className="flex items-center gap-3 text-sm text-foreground active:text-primary">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                {candidate.email}
              </a>
            )}
            {candidate.expected_salary && (
              <div className="flex items-center gap-3 text-sm text-foreground">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                {candidate.expected_salary}
              </div>
            )}
            {candidate.notice_period && (
              <div className="flex items-center gap-3 text-sm text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                {candidate.notice_period}
              </div>
            )}
            {candidate.tags?.length > 0 && (
              <div className="flex items-start gap-3">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {candidate.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {!candidate.phone && !candidate.email && !candidate.expected_salary && !candidate.notice_period && (
              <p className="text-xs text-muted-foreground">No contact details</p>
            )}
          </div>

          {/* AI Summary */}
          {candidate.ai_summary && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">AI Summary</p>
              <p className="text-sm text-foreground whitespace-pre-line">{candidate.ai_summary}</p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="text-xs text-primary font-medium"
              >
                {showNoteInput ? 'Cancel' : '+ Add Note'}
              </button>
            </div>
            {showNoteInput && (
              <div className="space-y-2 mb-3">
                <Textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Write a note..."
                  rows={3}
                  autoFocus
                  className="text-sm"
                />
                <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="w-full">
                  Save Note
                </Button>
              </div>
            )}
            {candidate.notes ? (
              <p className="text-sm text-foreground whitespace-pre-line">{candidate.notes}</p>
            ) : (
              !showNoteInput && <p className="text-xs text-muted-foreground">No notes yet</p>
            )}
          </div>

          {/* Attachments */}
          <div className="bg-card border border-border rounded-xl p-4">
            <CandidateAttachments candidateId={candidate.id} />
          </div>

          {/* Activity */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Activity</p>
            <ActivityFeed entityId={candidate.id} />
          </div>

          {/* Delete */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete Candidate
          </Button>

          <div className="h-4" />
        </div>
      </div>
    </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Candidate"
        description={`Delete "${candidate.name}"? This cannot be undone.`}
        onConfirm={() => { deleteCandidate(candidate.id); onBack(); toast.success('Candidate deleted'); }}
      />
    </>
  );
}
