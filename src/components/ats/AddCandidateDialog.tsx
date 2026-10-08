import { useState, useMemo, useRef, useCallback } from 'react';
import { parseCvText } from '@/lib/cvParser';
import { useATS } from '@/context/ATSContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Candidate } from '@/types/ats';
import { Plus, Upload, Loader2, FileText, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { r2Upload } from '@/lib/r2Storage';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck';
import { DuplicateWarning } from './DuplicateWarning';
import { cn } from '@/lib/utils';

interface Props {
  companyId?: string | null;
  positionId?: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  onOpenCandidate?: (candidate: Candidate) => void;
}

import { extractTextFromFile } from '@/lib/extractFileText';

export function AddCandidateDialog({ companyId, positionId: defaultPositionId, externalOpen, onExternalOpenChange, onOpenCandidate }: Props) {
  const { addCandidate, deleteCandidate, addPosition, positions, companies, getCompanyStages } = useATS();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };
  const [name, setName] = useState('');
  const [positionId, setPositionId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [salary, setSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [notes, setNotes] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [stageId, setStageId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);
  const [parsedTags, setParsedTags] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [positionPopoverOpen, setPositionPopoverOpen] = useState(false);
  const [positionSearch, setPositionSearch] = useState('');
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handlePhoneChange = (val: string) => setPhone(val.replace(/[^\d+\s]/g, '').slice(0, 50));
  const handleSalaryChange = (val: string) => setSalary(val.replace(/[^\d.,\s$€£]/g, '').slice(0, 50));

  const currentPositionId = positionId || defaultPositionId || '';

  const isEmailValid = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const [submitted, setSubmitted] = useState(false);
  const errors = {
    name: (submitted || touched.name) && !name.trim() ? t('common.error') : '',
    position: (submitted || touched.position) && !currentPositionId ? t('common.error') : '',
    email: (submitted || touched.email) && email && !isEmailValid(email) ? t('common.error') : '',
  };
  const hasSubmitErrors = !name.trim() || !currentPositionId || (email && !isEmailValid(email));
  const duplicates = useDuplicateCheck(name, email, positionId);

  const handleOpenDuplicate = useCallback((candidate: Candidate) => {
    setOpen(false);
    onOpenCandidate?.(candidate);
  }, [onOpenCandidate]);

  const filteredPositions = companyId
    ? positions.filter(p => p.company_id === companyId)
    : positions;

  const effectivePositionId = positionId || defaultPositionId || '';

  const availableStages = useMemo(() => {
    const pos = positions.find(p => p.id === effectivePositionId);
    if (pos) return getCompanyStages(pos.company_id);
    if (companyId) return getCompanyStages(companyId);
    return [];
  }, [effectivePositionId, companyId, positions, getCompanyStages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTouched({ name: true, position: true, email: true });
    const pid = positionId || defaultPositionId;
    if (!name.trim() || !pid) return;
    if (email && !isEmailValid(email)) return;
    const trimmedName = name.trim().slice(0, 100);
    const trimmedEmail = email.trim().slice(0, 150);
    const trimmedPhone = phone.trim().slice(0, 50);
    const trimmedNotes = notes.trim().slice(0, 2000);
    const trimmedSalary = salary.trim().slice(0, 50);
    const selectedStageId = stageId || (availableStages[0]?.id ?? null);
    const candidate = await addCandidate(trimmedName, pid, {
      expected_salary: trimmedSalary,
      notes: trimmedNotes,
      ai_summary: aiSummary.trim(),
      stage_id: selectedStageId,
      notice_period: noticePeriod.trim(),
      owner_id: undefined,
      phone: trimmedPhone,
      email: trimmedEmail,
      tags: parsedTags,
    });
    // Upload CV file if one was parsed
    if (candidate && (fileInputRef as any).__pendingFile) {
      const file = (fileInputRef as any).__pendingFile as File;
      try {
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const filePath = `${candidate.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
        await r2Upload(filePath, file, file.type || 'application/octet-stream');
        let cvText = '';
        try { cvText = await extractTextFromFile(file); } catch { /* non-critical */ }
        const { data: inserted } = await supabase.from('candidate_attachments').insert({
          candidate_id: candidate.id,
          user_id: (await supabase.auth.getUser()).data.user!.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        } as any).select('id').single();
        if (inserted && cvText) {
          await (supabase.from('candidate_attachments') as any).update({ cv_text: cvText }).eq('id', (inserted as any).id);
        }
      } catch (err) {
        console.error('CV upload error:', err);
      }
      (fileInputRef as any).__pendingFile = null;
    }

    reset();
    setOpen(false);

    if (candidate) {
      toast(t('candidate.addCandidate'), {
        action: { label: 'Undo', onClick: () => deleteCandidate(candidate.id) },
        duration: 5000,
      });
    }
  };

  const reset = () => {
    setName(''); setPositionId(''); setPhone(''); setEmail(''); setSalary('');
    setNoticePeriod(''); setNotes(''); setAiSummary(''); setStageId('');
    setParsedFileName(null); setParsedTags([]); setTouched({}); setSubmitted(false);
  };

  const handleCvUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
    if (!isPdf && !isDocx) { toast.error('Please upload a PDF or Word (.docx) file'); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error('File too large (max 4MB)'); return; }

    setParsing(true);
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) { toast.error('Could not extract text from the file.'); return; }

      const data = await parseCvText(text);

      if (data.name) setName(data.name);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(data.phone);
      if (data.summary) setAiSummary(data.summary);
      if (data.tags?.length) setParsedTags(data.tags);
      setParsedFileName(file.name);
      // Store file reference for upload after candidate creation
      (fileInputRef as any).__pendingFile = file;
      toast.success('CV parsed — review and edit the fields below');
    } catch (err) {
      console.error('CV upload error:', err);
      toast.error('Failed to process CV');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); } setOpen(o); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> {t('candidate.addCandidate')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] max-sm:h-screen max-sm:max-h-screen max-sm:rounded-none max-sm:border-0 flex flex-col p-0 gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-5 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle>{t('candidate.addCandidate')}</DialogTitle>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleCvUpload} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              {parsing ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing…</>) : (<><Upload className="h-3.5 w-3.5" /> Upload CV</>)}
            </Button>
          </div>
          {parsedFileName ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>Extracted from <span className="font-medium text-foreground">{parsedFileName}</span></span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Upload a PDF or Word file — we extract details and store it as an attachment automatically.
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('candidate.name')} *</label>
                <Input value={name} onChange={e => setName(e.target.value.slice(0, 100))} onBlur={() => { if (name !== '') markTouched('name'); }} placeholder={t('candidate.name')} autoFocus className={cn("mt-1.5", errors.name && "border-destructive")} />
                {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">{t('candidate.position')} *</label>
                <Popover open={positionPopoverOpen} onOpenChange={setPositionPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={positionPopoverOpen} className="w-full justify-between mt-1.5 font-normal">
                      {currentPositionId
                        ? (() => {
                            const p = positions.find(pos => pos.id === currentPositionId);
                            const comp = companies.find(c => c.id === p?.company_id);
                            return p ? `${p.title}${comp ? ` (${comp.name})` : ''}` : t('common.select');
                          })()
                        : t('common.select')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder={t('search.searchPlaceholder')} value={positionSearch} onValueChange={setPositionSearch} />
                      <CommandList>
                        {(() => {
                          const search = positionSearch.toLowerCase().trim();
                          const filtered = filteredPositions.filter(p =>
                            p.title.toLowerCase().includes(search)
                          );
                          const exactMatch = filteredPositions.some(p =>
                            p.title.toLowerCase().trim() === search
                          );
                          return (
                            <>
                              {filtered.length === 0 && !positionSearch.trim() && (
                                <CommandEmpty>{t('position.noPositions')}</CommandEmpty>
                              )}
                              {filtered.length === 0 && positionSearch.trim() && !exactMatch && (
                                <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                              )}
                              <CommandGroup>
                                {filtered.map(p => {
                                  const comp = companies.find(c => c.id === p.company_id);
                                  return (
                                    <CommandItem
                                      key={p.id}
                                      value={p.id}
                                      onSelect={() => {
                                        setPositionId(p.id);
                                        setStageId('');
                                        setPositionPopoverOpen(false);
                                        setPositionSearch('');
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", currentPositionId === p.id ? "opacity-100" : "opacity-0")} />
                                      {p.title}{comp ? ` (${comp.name})` : ''}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                              {positionSearch.trim() && !exactMatch && companyId && (
                                <CommandGroup>
                                  <CommandItem
                                    onSelect={async () => {
                                      if (creatingPosition) return;
                                      setCreatingPosition(true);
                                      try {
                                        const newPos = await addPosition(positionSearch.trim(), companyId);
                                        if (newPos) {
                                          setPositionId(newPos.id);
                                          setStageId('');
                                          toast.success(`Position "${newPos.title}" created`);
                                        }
                                      } finally {
                                        setCreatingPosition(false);
                                        setPositionPopoverOpen(false);
                                        setPositionSearch('');
                                      }
                                    }}
                                    disabled={creatingPosition}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    {creatingPosition ? t('common.loading') : `Create "${positionSearch.trim()}"`}
                                  </CommandItem>
                                </CommandGroup>
                              )}
                              {positionSearch.trim() && !exactMatch && !companyId && (
                                <CommandGroup>
                                  <CommandItem disabled className="text-muted-foreground text-xs">
                                    Select a company first to create positions
                                  </CommandItem>
                                </CommandGroup>
                              )}
                            </>
                          );
                        })()}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">{t('candidate.phone')}</label>
                <Input value={phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="e.g. +359 888 123 456" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('candidate.email')}</label>
                <Input value={email} onChange={e => setEmail(e.target.value.slice(0, 150))} onBlur={() => markTouched('email')} placeholder="e.g. name@example.com" className={cn("mt-1.5", errors.email && "border-destructive")} />
                {errors.email && <p className="text-[11px] text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">{t('candidate.expectedSalary')}</label>
                <Input value={salary} onChange={e => handleSalaryChange(e.target.value)} placeholder="e.g. $80,000" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('candidate.noticePeriod')}</label>
                <Input value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} placeholder="e.g. 30 days, 2 months" className="mt-1.5" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('candidate.owner')}</label>
                <div className="mt-1.5 flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {(profile?.name || 'Y').charAt(0).toUpperCase()}
                  </span>
                  {profile?.name || 'You'} <span className="text-muted-foreground/50 text-xs ml-auto">auto</span>
                </div>
              </div>
              {availableStages.length > 0 && (
                <div>
                  <label className="text-sm font-medium">{t('candidate.stage')}</label>
                  <Select value={stageId || availableStages[0]?.id} onValueChange={setStageId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {aiSummary && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('candidate.aiSummary')}</label>
                <p className="text-[11px] text-muted-foreground/70 mb-1">Generated from CV</p>
                <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-line">
                  {aiSummary}
                </div>
              </div>
            )}
            <DuplicateWarning duplicates={duplicates} onOpenExisting={handleOpenDuplicate} />
            <div>
              <label className="text-sm font-medium">{t('candidate.notes')}</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 2000))} rows={3} placeholder={t('candidate.notes')} className="mt-1.5" />
              {notes.length > 1900 && <p className="text-[11px] text-muted-foreground mt-1">{notes.length}/2000</p>}
            </div>
          </div>
          <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={hasSubmitErrors}>{t('candidate.addCandidate')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
