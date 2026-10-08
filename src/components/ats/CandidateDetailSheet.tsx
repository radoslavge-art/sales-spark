import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logAuditActivity } from '@/lib/logAuditActivity';
import { useATS } from '@/context/ATSContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Candidate } from '@/types/ats';
import { supabase } from '@/integrations/supabase/client';
import { r2Download } from '@/lib/r2Storage';
import { Trash2, X, Eye, ArrowLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OwnerSelect } from './OwnerSelect';
import { CandidateFilePreview } from './CandidateFilePreview';
import { CandidateAttachments } from './CandidateAttachments';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFieldNavigation } from '@/hooks/useFieldNavigation';
import { formatDistanceToNow } from 'date-fns';

const FIELD_IDS = ['name', 'phone', 'email', 'salary', 'noticePeriod', 'notes'];

interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  userName?: string;
}

interface Props {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateCandidate?: (direction: 'prev' | 'next') => void;
  source?: 'bulk-upload' | null;
}

export function CandidateDetailSheet({ candidate, open, onOpenChange, onNavigateCandidate, source }: Props) {
  const isMobile = useIsMobile();
  const { updateCandidate, deleteCandidate, positions, companies, getCompanyStages } = useATS();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [salary, setSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [stageId, setStageId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ file_name: string; mime_type: string } | null>(null);
  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Presence state
  const [viewers, setViewers] = useState<{ id: string; name: string }[]>([]);

  const candidateRef = useRef<Candidate | null>(null);
  const { containerRef, handleKeyDown } = useFieldNavigation(FIELD_IDS);

  useEffect(() => {
    if (candidate) {
      candidateRef.current = candidate;
      setName(candidate.name);
      setNotes(candidate.notes);
      setSalary(candidate.expected_salary);
      setNoticePeriod(candidate.notice_period || '');
      setPhone(candidate.phone || '');
      setEmail(candidate.email || '');
      setStageId(candidate.stage_id);
      setPositionId(candidate.position_id);
      setOwnerId(candidate.owner_id ?? null);
    }
  }, [candidate]);

  // Fetch activity logs
  useEffect(() => {
    if (!candidate?.id || !open) return;
    fetchActivityLogs(candidate.id);
  }, [candidate?.id, open]);

  const fetchActivityLogs = async (candidateId: string) => {
    setActivityLoading(true);
    try {
      // Fetch from both activities and activity_logs tables
      const [{ data: activitiesData }, { data: auditData }] = await Promise.all([
        supabase.from('activities' as any)
          .select('*')
          .eq('entity_type', 'candidate')
          .eq('entity_id', candidateId)
          .order('created_at', { ascending: false })
          .limit(50) as any,
        supabase.from('activity_logs' as any)
          .select('*')
          .eq('entity_type', 'candidate')
          .eq('entity_id', candidateId)
          .order('created_at', { ascending: false })
          .limit(50) as any,
      ]);

      // Merge and deduplicate by combining both sources
      const combined = [
        ...((activitiesData || []) as ActivityLogEntry[]),
        ...((auditData || []) as ActivityLogEntry[]),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 50);

      const data = combined;

      const items = (data as ActivityLogEntry[]) || [];
      const userIds = [...new Set(items.map(a => a.user_id).filter(Boolean))];

      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase
          .from('profiles' as any)
          .select('id, name')
          .in('id', userIds) as any);
        if (profiles) {
          for (const p of profiles as { id: string; name: string }[]) {
            nameMap[p.id] = p.name || '';
          }
        }
      }

      setActivityLogs(items.map(a => ({
        ...a,
        userName: nameMap[a.user_id] || t('common.user'),
      })));
    } catch {
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  };

  // Candidate-level presence
  useEffect(() => {
    if (!candidate?.id || !open || !user) return;
    const channel = supabase.channel(`candidate-presence-${candidate.id}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const present: { id: string; name: string }[] = [];
        for (const [uid, entries] of Object.entries(state)) {
          if (uid === user.id) continue;
          const entry = (entries as any[])[0];
          if (entry?.name) present.push({ id: uid, name: entry.name });
        }
        setViewers(present);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: profile?.name || user.email || 'Unknown' });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [candidate?.id, open, user, profile?.name]);

  const position = positions.find(p => p.id === (candidate?.position_id ?? ''));
  const company = position ? companies.find(c => c.id === position.company_id) : null;

  const stages = useMemo(() => {
    const pos = positions.find(p => p.id === positionId);
    return pos ? getCompanyStages(pos.company_id) : [];
  }, [positionId, positions, getCompanyStages]);

  const autoSave = useCallback(() => {
    if (!candidate || !name.trim()) return;
    const c = candidateRef.current;
    if (!c) return;
    const changed =
      name.trim() !== c.name || notes !== c.notes || salary !== c.expected_salary ||
      (noticePeriod || '') !== (c.notice_period || '') || (phone || '') !== (c.phone || '') ||
      (email || '') !== (c.email || '') || stageId !== c.stage_id ||
      positionId !== c.position_id || ownerId !== (c.owner_id ?? null);
    if (!changed) return;
    updateCandidate(candidate.id, {
      name: name.trim(), notes, expected_salary: salary, notice_period: noticePeriod,
      phone, email, stage_id: stageId, position_id: positionId, owner_id: ownerId,
    });
    candidateRef.current = {
      ...c, name: name.trim(), notes, expected_salary: salary, notice_period: noticePeriod,
      phone, email, stage_id: stageId, position_id: positionId, owner_id: ownerId,
    };
  }, [candidate, name, notes, salary, noticePeriod, phone, email, stageId, positionId, ownerId, updateCandidate]);

  const isPdfFile = (fileName: string, mimeType: string) =>
    mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  const isDocxFile = (fileName: string, mimeType: string) =>
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx');

  const loadPreview = useCallback(async () => {
    if (!candidate?.id) return;
    setPreviewLoading(true);
    setPreviewHtml(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    try {
      const { data: atts } = await supabase
        .from('candidate_attachments')
        .select('*')
        .eq('candidate_id', candidate.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const att = (atts as any)?.[0];
      if (!att) { setPreviewUrl(null); setPreviewAttachment(null); return; }
      setPreviewAttachment({ file_name: att.file_name, mime_type: att.mime_type });

      const data = await r2Download(att.file_path);
      if (!data) { setPreviewUrl(null); return; }

      if (isPdfFile(att.file_name, att.mime_type)) {
        const blobUrl = URL.createObjectURL(data);
        setPreviewUrl(blobUrl);
      } else if (isDocxFile(att.file_name, att.mime_type)) {
        // Convert DOCX to HTML for inline preview
        const mammoth = await import('mammoth');
        const arrayBuffer = await data.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewHtml(result.value);
        setPreviewUrl(null);
      } else {
        setPreviewUrl(URL.createObjectURL(data));
      }
    } catch {
      setPreviewUrl(null);
      setPreviewAttachment(null);
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [candidate?.id]);

  const handleStageChange = useCallback((v: string) => {
    setStageId(v);
    if (candidate) {
      updateCandidate(candidate.id, { stage_id: v });
      if (candidateRef.current) candidateRef.current = { ...candidateRef.current, stage_id: v };
    }
  }, [candidate, updateCandidate]);

  const handlePositionChange = useCallback((v: string) => {
    setPositionId(v);
    if (candidate) {
      updateCandidate(candidate.id, { position_id: v });
      if (candidateRef.current) candidateRef.current = { ...candidateRef.current, position_id: v };
    }
  }, [candidate, updateCandidate]);

  const handleOwnerChange = useCallback((v: string | null) => {
    setOwnerId(v);
    if (candidate) {
      updateCandidate(candidate.id, { owner_id: v });
      if (candidateRef.current) candidateRef.current = { ...candidateRef.current, owner_id: v };
    }
  }, [candidate, updateCandidate]);

  // Arrow key navigation
  useEffect(() => {
    if (!open || !onNavigateCandidate) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onNavigateCandidate('prev'); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onNavigateCandidate('next'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onNavigateCandidate]);

  if (!candidate) return null;

  if (!open) return (
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={t('candidate.deleteCandidate')}
      description={t('candidate.deleteCandidateConfirm', { name: candidate.name })}
      onConfirm={() => { deleteCandidate(candidate.id); onOpenChange(false); }}
    />
  );

  return (
    <>
    {/* Overlay */}
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => { autoSave(); onOpenChange(false); }} />
    {/* Centered modal */}
    <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[1000px] max-h-[90vh] bg-background rounded-xl border border-border shadow-2xl flex flex-col">
      {/* Fixed header */}
       <header className="shrink-0 border-b border-border bg-background px-6 py-3 flex flex-col gap-1 rounded-t-xl">
        {source === 'bulk-upload' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Bulk CV Upload</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Candidate Details</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">{t('candidateDetail.details')}</h2>
            <span className="text-sm font-medium text-foreground truncate hidden sm:inline">— {candidate.name}</span>
            {company && (
              <Badge variant="secondary" className="font-medium text-xs shrink-0">{company.name}</Badge>
            )}
            {viewers.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex -space-x-1.5">
                  {viewers.map(v => (
                    <div
                      key={v.id}
                      className="h-5 w-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[8px] font-semibold text-primary"
                      title={v.name}
                    >
                      {v.name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => { autoSave(); onOpenChange(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tabs + Content */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'preview') loadPreview(); }} className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-6 pt-2">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">{t('common.details')}</TabsTrigger>
            <TabsTrigger value="preview">{t('attachments.cvPreview')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="flex-1 overflow-y-auto mt-0">
          <div className="px-6 pb-6 pt-4 space-y-5 max-w-[800px] mx-auto"
            ref={containerRef}
            onKeyDown={handleKeyDown}
          >
            {/* ─── Form Fields ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground">{t('candidate.name')}</label>
                <Input data-field-id="name" value={name} onChange={e => setName(e.target.value)} onBlur={autoSave} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.position')}</label>
                <Select value={positionId} onValueChange={handlePositionChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {positions.map(p => {
                      const comp = companies.find(c => c.id === p.company_id);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}{comp ? ` (${comp.name})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.stage')}</label>
                <Select value={stageId ?? ''} onValueChange={handleStageChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.phone')}</label>
                <Input data-field-id="phone" value={phone} onChange={e => setPhone(e.target.value)} onBlur={autoSave} placeholder="e.g. +359 888 123 456" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.email')}</label>
                <Input data-field-id="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={autoSave} placeholder="e.g. name@example.com" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.expectedSalary')}</label>
                <Input data-field-id="salary" value={salary} onChange={e => setSalary(e.target.value)} onBlur={autoSave} placeholder="e.g. $80,000" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.noticePeriod')}</label>
                <Input data-field-id="noticePeriod" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} onBlur={autoSave} placeholder="e.g. 30 days" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('candidate.owner')}</label>
                <div className="mt-1">
                  <OwnerSelect value={ownerId} onValueChange={handleOwnerChange} />
                </div>
              </div>
            </div>

            {candidate.ai_summary && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('candidate.aiSummary')}</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1">Generated from CV</p>
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-line">
                  {candidate.ai_summary}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">{t('candidate.notes')}</label>
              <Textarea data-field-id="notes" value={notes} onChange={e => setNotes(e.target.value)} onBlur={autoSave} rows={4} placeholder={t('candidate.notes')} className="mt-1" />
            </div>

            {/* ─── Attachments ─── */}
            <Separator />
            <CandidateAttachments candidateId={candidate.id} onAttachmentChange={() => { if (activeTab === 'preview') loadPreview(); }} />

            {/* ─── Activity Log ─── */}
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">{t('candidateDetail.activity')}</h3>
              {activityLoading ? (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              ) : activityLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('candidateDetail.noActivity')}</p>
              ) : (
                <div className="space-y-2">
                  {activityLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border last:border-b-0">
                      <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0 mt-0.5">
                        {(log.userName || '??').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{log.userName}</span>{' '}
                          <span className={
                            /delete|remove/i.test(log.action)
                              ? 'text-destructive font-medium'
                              : /stage|move/i.test(log.action)
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground'
                          }>{log.action}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 min-h-0 overflow-y-auto mt-0">
          <div className="h-full p-6">
            {previewLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : (
              <CandidateFilePreview
                attachment={previewAttachment}
                previewUrl={previewUrl}
                previewHtml={previewHtml}
                t={t}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Fixed footer */}
      <footer className="shrink-0 flex justify-between items-center gap-3 px-6 py-3 border-t border-border bg-background rounded-b-xl">
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
        </Button>
        {source === 'bulk-upload' ? (
          <Button variant="default" size="sm" className="gap-1.5" onClick={() => { autoSave(); onOpenChange(false); }}>
            <ArrowLeft className="h-4 w-4" /> Back to uploads
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { autoSave(); onOpenChange(false); }}>{t('common.close')}</Button>
        )}
      </footer>
    </div>
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title={t('candidate.deleteCandidate')}
      description={t('candidate.deleteCandidateConfirm', { name: candidate.name })}
      onConfirm={() => { deleteCandidate(candidate.id); onOpenChange(false); }}
    />
    </>
  );
}
