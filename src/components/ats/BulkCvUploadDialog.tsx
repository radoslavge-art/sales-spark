import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { parseCvText } from '@/lib/cvParser';
import { useATS } from '@/context/ATSContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Candidate } from '@/types/ats';
import { Upload, Loader2, FileText, CheckCircle2, XCircle, X, User, AlertTriangle, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { r2Upload } from '@/lib/r2Storage';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { extractTextFromFile } from '@/lib/extractFileText';
import { cn } from '@/lib/utils';
import { CandidateDetailSheet } from './CandidateDetailSheet';

interface ParsedCandidate {
  file: File;
  fileName: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  data?: {
    name: string;
    email: string;
    phone: string;
    summary: string;
    tags: string[];
  };
  error?: string;
  candidate?: Candidate;
  duplicates?: DuplicateInfo[];
}

interface DuplicateInfo {
  candidateId: string;
  candidateName: string;
  positionTitle: string;
  companyName: string;
  reason: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId?: string | null;
  onOpenCandidate?: (candidate: Candidate) => void;
}


export function BulkCvUploadDialog({ open, onOpenChange, positionId: initialPositionId, onOpenCandidate }: Props) {
  const { addCandidate, deleteCandidate, positions, companies, candidates: allCandidates, getCompanyStages } = useATS();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([]);
  const [phase, setPhase] = useState<'select' | 'processing' | 'results'>('select');
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [activePositionId, setActivePositionId] = useState<string | null>(initialPositionId || null);
  const [uploading, setUploading] = useState(false);

  // Sync when prop changes (dialog reopened with different position)
  useEffect(() => {
    if (open) setActivePositionId(initialPositionId || null);
  }, [open, initialPositionId]);

  const positionId = activePositionId;
  const positionInfo = positionId ? positions.find(p => p.id === positionId) : null;
  const companyInfo = positionInfo ? companies.find(c => c.id === positionInfo.company_id) : null;

  const doneCount = candidates.filter(c => c.status === 'done').length;
  const errorCount = candidates.filter(c => c.status === 'error').length;
  const progress = candidates.length > 0 ? Math.round(((doneCount + errorCount) / candidates.length) * 100) : 0;

  const findDuplicates = useCallback((name: string, email: string): DuplicateInfo[] => {
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName || trimmedName.length < 2) return [];
    const targetPos = positionId ? positions.find(p => p.id === positionId) : null;
    const targetCompanyId = targetPos?.company_id;
    const matches: DuplicateInfo[] = [];
    const seen = new Set<string>();
    for (const c of allCandidates) {
      if (seen.has(c.id)) continue;
      const cName = c.name.trim().toLowerCase();
      if (cName !== trimmedName) continue;
      const pos = positions.find(p => p.id === c.position_id);
      const comp = pos ? companies.find(co => co.id === pos.company_id) : undefined;
      if (targetCompanyId && pos?.company_id === targetCompanyId) {
        seen.add(c.id);
        matches.push({ candidateId: c.id, candidateName: c.name, positionTitle: pos?.title || '', companyName: comp?.name || '', reason: `Same name in ${comp?.name || 'same company'}` });
        continue;
      }
      const trimmedEmail = email?.trim().toLowerCase();
      if (trimmedEmail && c.email?.trim().toLowerCase() === trimmedEmail) {
        seen.add(c.id);
        matches.push({ candidateId: c.id, candidateName: c.name, positionTitle: pos?.title || '', companyName: comp?.name || '', reason: 'Same name and email' });
      }
    }
    return matches;
  }, [allCandidates, positions, companies, positionId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      const isPdf = f.type === 'application/pdf' || f.name.endsWith('.pdf');
      const isDocx = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.endsWith('.docx');
      return (isPdf || isDocx) && f.size <= 2 * 1024 * 1024;
    });
    if (valid.length === 0) { toast.error(t('bulkUpload.noValidFiles')); return; }
    if (valid.length < files.length) { toast.warning(t('bulkUpload.filesSkipped', { count: files.length - valid.length })); }
    const parsed: ParsedCandidate[] = valid.map(f => ({ file: f, fileName: f.name, status: 'pending' as const }));
    setCandidates(parsed);
    setPhase('processing');
    processFiles(parsed);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const processFiles = async (items: ParsedCandidate[]) => {
    setProcessing(true);
    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'parsing' };
      setCandidates([...updated]);
      try {
        const text = await extractTextFromFile(updated[i].file);
        if (!text.trim()) throw new Error(t('bulkUpload.noTextExtracted'));
        const data = await parseCvText(text);
        const dupes = findDuplicates(data.name || '', data.email || '');
        updated[i] = { ...updated[i], status: 'done', data, duplicates: dupes };
      } catch (err: any) {
        updated[i] = { ...updated[i], status: 'error', error: err.message || t('bulkUpload.failedToParse') };
      }
      setCandidates([...updated]);
    }
    setProcessing(false);
    setPhase('results');
  };



  const handleAddCandidates = async () => {
    if (!positionId) { toast.error(t('bulkUpload.noPositionSelected')); return; }
    const toAdd = candidates.filter(c => c.status === 'done' && c.data?.name && !c.candidate);
    if (toAdd.length === 0) { toast.info(t('bulkUpload.noCandidatesToAdd')); return; }
    setUploading(true);
    const pos = positions.find(p => p.id === positionId);
    const firstStage = pos ? getCompanyStages(pos.company_id).sort((a, b) => a.sort_order - b.sort_order)[0] : null;
    let successCount = 0;
    let failCount = 0;
    const updated = [...candidates];
    for (let i = 0; i < updated.length; i++) {
      const c = updated[i];
      if (c.status !== 'done' || !c.data?.name || c.candidate) continue;
      try {
        const candidate = await addCandidate(c.data.name.trim().slice(0, 100), positionId, {
          email: c.data.email?.trim().slice(0, 150) || '',
          phone: c.data.phone?.trim().slice(0, 50) || '',
          ai_summary: c.data.summary?.trim() || '',
          tags: c.data.tags || [],
          notes: '', expected_salary: '', notice_period: '',
          owner_id: undefined,
          stage_id: firstStage?.id || undefined,
        });
        if (candidate) {
          updated[i] = { ...updated[i], candidate };
          successCount++;
          // Upload CV as attachment
          try {
            const file = c.file;
            const filePath = `${candidate.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
            await r2Upload(filePath, file, file.type || 'application/octet-stream');
            let cvText = '';
            try { cvText = await extractTextFromFile(file); } catch { /* non-critical */ }
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const { data: inserted } = await (supabase.from('candidate_attachments') as any).insert({
              candidate_id: candidate.id, user_id: authUser!.id,
              file_name: file.name, file_path: filePath, file_size: file.size, mime_type: file.type || 'application/pdf',
            }).select('id').single();
            if (inserted && cvText) {
              await (supabase.from('candidate_attachments') as any).update({ cv_text: cvText }).eq('id', inserted.id);
            }
          } catch (err) { console.error('CV attachment upload error:', err); }
        } else {
          failCount++;
          updated[i] = { ...updated[i], status: 'error', error: t('bulkUpload.failedToCreate') };
        }
      } catch (err: any) {
        failCount++;
        updated[i] = { ...updated[i], status: 'error', error: err.message || t('bulkUpload.failedToCreate') };
      }
      setCandidates([...updated]);
    }
    setUploading(false);
    if (successCount > 0) {
      toast.success(t('bulkUpload.candidatesAdded', { count: successCount }));
      handleClose();
    }
    if (failCount > 0) {
      toast.error(t('bulkUpload.candidatesFailed', { count: failCount }));
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    const createdCandidates = candidates.filter(c => c.candidate);
    for (const c of createdCandidates) {
      if (c.candidate) { try { await deleteCandidate(c.candidate.id); } catch (err) { console.error('Failed to delete candidate:', err); } }
    }
    setCancelling(false);
    toast.success(t('bulkUpload.removedCandidates', { count: createdCandidates.length }));
    handleClose();
  };

  const handleClose = () => {
    setCandidates([]);
    setPhase('select');
    setViewingCandidate(null);
    onOpenChange(false);
  };

  const handleOpenExistingDuplicate = (candidateId: string) => {
    const existing = allCandidates.find(c => c.id === candidateId);
    if (existing) setViewingCandidate(existing);
  };

  const handleRemoveCandidate = async (index: number) => {
    const c = candidates[index];
    if (c.candidate) {
      try { await deleteCandidate(c.candidate.id); } catch (err) { console.error('Failed to delete:', err); }
    }
    setCandidates(prev => prev.filter((_, i) => i !== index));
  };

  // If viewing a candidate detail, show it with a back button
  if (viewingCandidate) {
    return (
      <CandidateDetailSheet
        candidate={viewingCandidate}
        open={open}
        onOpenChange={(o) => {
          if (!o) setViewingCandidate(null);
        }}
        source="bulk-upload"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {t('bulkUpload.title')}
          </DialogTitle>
          {positionInfo && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('bulkUpload.addingTo')} <span className="font-medium text-foreground">{positionInfo.title}</span>
              {companyInfo && <span> ({companyInfo.name})</span>}
            </p>
          )}
        </DialogHeader>

        {phase === 'select' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-12">
            {/* Position selector */}
            <div className="w-full max-w-md">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('bulkUpload.targetPosition')}</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={activePositionId || ''}
                onChange={e => setActivePositionId(e.target.value || null)}
              >
                <option value="">{t('bulkUpload.selectPosition')}</option>
                {companies.map(company => {
                  const compPositions = positions.filter(p => p.company_id === company.id);
                  if (compPositions.length === 0) return null;
                  return (
                    <optgroup key={company.id} label={company.name}>
                      {compPositions.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" multiple className="hidden" onChange={handleFileSelect} />
            <div
              className={cn(
                "w-full border-2 border-dashed rounded-xl p-10 text-center transition-colors",
                activePositionId
                  ? "border-border cursor-pointer hover:border-primary/50 hover:bg-primary/5"
                  : "border-border/50 opacity-50 cursor-not-allowed"
              )}
              onClick={() => { if (activePositionId) fileInputRef.current?.click(); else toast.error(t('bulkUpload.selectPositionFirst')); }}
              onDragOver={e => { if (!activePositionId) return; e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                if (!activePositionId) { toast.error(t('bulkUpload.selectPositionFirst')); return; }
                const dt = e.dataTransfer;
                if (dt.files.length > 0) {
                  const input = fileInputRef.current;
                  if (input) {
                    Object.defineProperty(input, 'files', { value: dt.files, writable: true });
                    handleFileSelect({ target: input } as any);
                  }
                }
              }}
            >
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('bulkUpload.dropHere')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('bulkUpload.fileHint')}</p>
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="flex-1 px-6 py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('bulkUpload.processing', { count: candidates.length })}</span>
                <span className="font-medium">{doneCount + errorCount}/{candidates.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {candidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card">
                    {c.status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                    {c.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                    {c.status === 'error' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    {c.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />}
                    <span className="text-sm truncate flex-1">{c.fileName}</span>
                    {c.status === 'done' && c.data?.name && (
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{c.data.name}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {phase === 'results' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> {t('bulkUpload.parsed', { count: doneCount })}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> {t('bulkUpload.failed', { count: errorCount })}
                </Badge>
              )}
              {candidates.some(c => c.duplicates && c.duplicates.length > 0) && (
                <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> {t('bulkUpload.duplicatesFound')}
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0 max-h-[550px]">
              <div className="p-4 space-y-2">
                {candidates.map((c, i) => {
                  const hasDuplicates = c.duplicates && c.duplicates.length > 0;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'rounded-xl border transition-all',
                        c.status === 'done'
                          ? hasDuplicates
                            ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:shadow-md'
                            : 'border-border bg-card hover:shadow-md'
                          : 'border-destructive/30 bg-destructive/5',
                      )}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        onClick={() => {
                          if (c.candidate) setViewingCandidate(c.candidate);
                        }}
                        disabled={!c.candidate}
                      >
                        {c.status === 'done' ? (
                          hasDuplicates ? (
                            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
                              <AlertTriangle className="h-4.5 w-4.5" />
                            </div>
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                              {(c.data?.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.data?.name || c.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                             {c.status === 'done'
                              ? hasDuplicates
                                ? `⚠ ${t('bulkUpload.possibleDuplicate')} — ${c.fileName}`
                                : c.fileName
                              : c.error || t('bulkUpload.failedToParse')}
                          </p>
                        </div>
                        {hasDuplicates && (
                          <span
                            className="text-[10px] text-amber-600 underline shrink-0 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handleOpenExistingDuplicate(c.duplicates![0].candidateId); }}
                          >
                            {c.duplicates!.length === 1 ? t('bulkUpload.caseFound') : t('bulkUpload.casesFound', { count: c.duplicates!.length })}
                          </span>
                        )}
                        {c.status === 'done' && (
                          <button
                            className="ml-1 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleRemoveCandidate(i); }}
                            title={t('common.remove')}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="shrink-0 flex justify-between gap-3 px-6 py-4 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleCancel}
                disabled={cancelling || uploading || !candidates.some(c => c.candidate)}
              >
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t('bulkUpload.cancelRemoveAll')}
              </Button>
              <Button onClick={handleAddCandidates} className="gap-1.5" disabled={uploading || !candidates.some(c => c.status === 'done' && !c.candidate)}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? t('bulkUpload.adding') : t('bulkUpload.addCandidates')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}