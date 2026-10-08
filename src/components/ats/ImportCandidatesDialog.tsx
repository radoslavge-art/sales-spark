import { useState, useRef, useCallback } from 'react';
import { useATS } from '@/context/ATSContext';
import { FileSpreadsheet, ChevronDown, ChevronRight, Download, AlertTriangle, CheckCircle2, Copy, ArrowLeft, Upload, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface Props {
  companyId?: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  isAdmin?: boolean;
}

interface ParsedCandidate {
  name: string;
  position: string;
  stage: string;
  phone: string;
  email: string;
  salary: string;
  notes: string;
  contactDate: string;
  ownerEmail: string;
}

interface ParsedCompany {
  sheetName: string;
  selected: boolean;
  positions: Map<string, ParsedCandidate[]>;
  stages: Set<string>;
  totalCandidates: number;
  expanded: boolean;
}

type RowStatus = 'valid' | 'invalid' | 'duplicate';

interface PreviewRow {
  candidate: ParsedCandidate;
  company: string;
  status: RowStatus;
  reason?: string;
}

interface RawSheet {
  sheetName: string;
  headers: string[];
  rows: any[][];
}

type CandidateField = 'name' | 'position' | 'stage' | 'phone' | 'email' | 'salary' | 'notes' | 'contactDate' | 'ownerEmail';
type ColumnMapping = Record<CandidateField, number>;

const CANDIDATE_FIELDS: { key: CandidateField; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'position', label: 'Position' },
  { key: 'stage', label: 'Stage' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'salary', label: 'Expected Salary' },
  { key: 'notes', label: 'Notes' },
  { key: 'contactDate', label: 'Contact Date' },
  { key: 'ownerEmail', label: 'Owner Email' },
];

const HEADER_MAP: Record<string, string[]> = {
  name: ['applicant', 'candidate', 'candidate name', 'full name', 'name', 'nombre'],
  position: ['position', 'role', 'job', 'job title'],
  stage: ['stage', 'status', 'pipeline'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'cell'],
  email: ['email', 'e-mail', 'mail'],
  salary: ['salary', 'expected salary', 'salary expectations', 'expected_salary', 'compensation'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
  contactDate: ['contact date', 'date', 'created', 'created_at'],
  ownerEmail: ['owner_email', 'owner email', 'recruiter email', 'assigned_to'],
};

function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => candidates.includes(h));
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map(h => String(h).toLowerCase().trim());
  return {
    name: findColumn(lower, HEADER_MAP.name),
    position: findColumn(lower, HEADER_MAP.position),
    stage: findColumn(lower, HEADER_MAP.stage),
    phone: findColumn(lower, HEADER_MAP.phone),
    email: findColumn(lower, HEADER_MAP.email),
    salary: findColumn(lower, HEADER_MAP.salary),
    notes: findColumn(lower, HEADER_MAP.notes),
    contactDate: findColumn(lower, HEADER_MAP.contactDate),
    ownerEmail: findColumn(lower, HEADER_MAP.ownerEmail),
  };
}

function sanitize(val: any, maxLen = 500): string {
  if (val == null) return '';
  return String(val).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function sanitizePhone(val: any): string {
  if (val == null) return '';
  return String(val).replace(/[^\d+\s()-]/g, '').trim().slice(0, 50);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function applyMapping(rows: any[][], mapping: ColumnMapping): ParsedCandidate[] {
  const nameCol = mapping.name >= 0 ? mapping.name : 0;
  return rows
    .filter(row => Array.isArray(row) && row.some(cell => cell != null && String(cell).trim() !== ''))
    .map(row => ({
      name: sanitize(row[nameCol], 100),
      position: mapping.position >= 0 ? sanitize(row[mapping.position], 200) : '',
      stage: mapping.stage >= 0 ? sanitize(row[mapping.stage], 100) : '',
      phone: mapping.phone >= 0 ? sanitizePhone(row[mapping.phone]) : '',
      email: mapping.email >= 0 ? sanitize(row[mapping.email], 150).toLowerCase() : '',
      salary: mapping.salary >= 0 ? sanitize(row[mapping.salary], 50) : '',
      notes: mapping.notes >= 0 ? sanitize(row[mapping.notes], 2000) : '',
      contactDate: mapping.contactDate >= 0 ? sanitize(row[mapping.contactDate]) : '',
      ownerEmail: mapping.ownerEmail >= 0 ? sanitize(row[mapping.ownerEmail], 150) : '',
    }))
    .filter(c => c.name.length > 0);
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [
    ['name', 'email', 'phone', 'position', 'company', 'stage', 'owner_email', 'notes'],
    ['John Doe', 'john@example.com', '+359888123456', 'Backend Developer', 'Company X', 'Contacted', 'recruiter@example.com', 'Strong profile'],
    ['Jane Smith', 'jane@example.com', '+359888654321', 'Frontend Developer', 'Company X', 'Interview', 'recruiter@example.com', 'Senior candidate'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 20 },
    { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Company X');
  XLSX.writeFile(wb, 'import_template.xlsx');
}

export function ImportCandidatesDialog({ companyId, externalOpen, onExternalOpenChange, isAdmin = false }: Props) {
  const { addCompany, addPosition, addCandidate, addStage, companies, positions, getCompanyStages, candidates: atsCandidates } = useATS();
  const [open, setOpen] = useState(false);
  const [parsedCompanies, setParsedCompanies] = useState<ParsedCompany[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [rawSheets, setRawSheets] = useState<RawSheet[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(() => autoDetectMapping([]));
  const [unmappedCount, setUnmappedCount] = useState(0);


  const selectedCompanies = parsedCompanies.filter(c => c.selected && c.totalCandidates > 0);
  const totalCandidates = selectedCompanies.reduce((sum, c) => sum + c.totalCandidates, 0);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** Parse file into raw sheets and auto-detect column mapping */
  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast({ title: 'Invalid file', description: 'Please upload a .csv, .xlsx or .xls file', variant: 'destructive' });
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: RawSheet[] = workbook.SheetNames.map(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          const headers = allRows[0]?.map((h: any) => String(h).trim()) || [];
          const dataRows = allRows.slice(1);
          return { sheetName, headers, rows: dataRows };
        });

        setRawSheets(sheets);

        // Auto-detect mapping from first sheet's headers
        const firstHeaders = sheets[0]?.headers || [];
        const detected = autoDetectMapping(firstHeaders);
        setColumnMapping(detected);

        // Count how many fields were NOT auto-detected
        const mapped = Object.values(detected).filter(v => v >= 0).length;
        setUnmappedCount(CANDIDATE_FIELDS.length - mapped);

        // If all key columns auto-detected, skip mapping step
        if (detected.name >= 0 && mapped >= 3) {
          rebuildCompanies(sheets, detected);
        } else {
          setStep('mapping');
        }
      } catch {
        toast({ title: 'Error', description: 'Could not parse file', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  /** Rebuild parsedCompanies from raw sheets using a given mapping */
  const rebuildCompanies = (sheets: RawSheet[], mapping: ColumnMapping) => {
    const parsed: ParsedCompany[] = sheets.map(({ sheetName, rows }) => {
      const candidates = applyMapping(rows, mapping);
      const positionMap = new Map<string, ParsedCandidate[]>();
      const stageSet = new Set<string>();

      for (const c of candidates) {
        const posKey = c.position || 'Unassigned';
        if (!positionMap.has(posKey)) positionMap.set(posKey, []);
        positionMap.get(posKey)!.push(c);
        if (c.stage) stageSet.add(c.stage);
      }

      return { sheetName, selected: candidates.length > 0, positions: positionMap, stages: stageSet, totalCandidates: candidates.length, expanded: false };
    });

    setParsedCompanies(parsed);
    setStep('upload');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); }, []);

  const toggleCompany = (idx: number) => {
    setParsedCompanies(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  };

  const toggleExpanded = (idx: number) => {
    setParsedCompanies(prev => prev.map((c, i) => i === idx ? { ...c, expanded: !c.expanded } : c));
  };

  function buildDuplicateIndex(companyId: string) {
    const nameKeys = new Set<string>();
    const emailKeys = new Set<string>();
    const companyPositionIds = new Set(positions.filter(p => p.company_id === companyId).map(p => p.id));
    for (const c of atsCandidates) {
      if (!companyPositionIds.has(c.position_id)) continue;
      nameKeys.add(c.name.toLowerCase().trim());
      if (c.email) emailKeys.add(c.email.toLowerCase().trim());
    }
    return { nameKeys, emailKeys };
  }

  const generatePreview = () => {
    const rows: PreviewRow[] = [];
    for (const pc of selectedCompanies) {
      const company = companies.find(c => c.name.toLowerCase().trim() === pc.sheetName.toLowerCase().trim());
      const dupIndex = company ? buildDuplicateIndex(company.id) : { nameKeys: new Set<string>(), emailKeys: new Set<string>() };
      const seenNames = new Set<string>();
      const seenEmails = new Set<string>();

      for (const [, candidates] of pc.positions) {
        for (const cand of candidates) {
          if (!cand.name) { rows.push({ candidate: cand, company: pc.sheetName, status: 'invalid', reason: 'Missing name' }); continue; }
          if (cand.email && !isValidEmail(cand.email)) { rows.push({ candidate: cand, company: pc.sheetName, status: 'invalid', reason: 'Invalid email' }); continue; }

          const nameKey = cand.name.toLowerCase().trim();
          const emailKey = cand.email?.toLowerCase().trim() || '';

          if (dupIndex.nameKeys.has(nameKey) || seenNames.has(nameKey)) { rows.push({ candidate: cand, company: pc.sheetName, status: 'duplicate', reason: 'Duplicate name' }); continue; }
          if (emailKey && (dupIndex.emailKeys.has(emailKey) || seenEmails.has(emailKey))) { rows.push({ candidate: cand, company: pc.sheetName, status: 'duplicate', reason: 'Duplicate email' }); continue; }

          seenNames.add(nameKey);
          if (emailKey) seenEmails.add(emailKey);
          rows.push({ candidate: cand, company: pc.sheetName, status: 'valid' });
        }
      }
    }
    setPreviewRows(rows);
    setStep('preview');
  };

  const validRows = previewRows.filter(r => r.status === 'valid');
  const invalidRows = previewRows.filter(r => r.status === 'invalid');
  const duplicateRows = previewRows.filter(r => r.status === 'duplicate');

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);

    let imported = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;

    for (const pc of selectedCompanies) {
      let company = companies.find(c => c.name.toLowerCase().trim() === pc.sheetName.toLowerCase().trim());
      if (!company) { company = await addCompany(pc.sheetName) ?? undefined; if (!company) { skippedInvalid += pc.totalCandidates; continue; } }

      const dupIndex = buildDuplicateIndex(company.id);
      const batchNames = new Set<string>();
      const batchEmails = new Set<string>();

      const existingStages = getCompanyStages(company.id);
      const stageMap = new Map<string, string>();
      for (const s of existingStages) stageMap.set(s.label.toLowerCase().trim(), s.id);
      const stageColors = ['blue', 'amber', 'purple', 'green', 'red', 'teal', 'pink'];
      let colorIdx = existingStages.length;
      for (const stageLabel of pc.stages) {
        const key = stageLabel.toLowerCase().trim();
        if (!stageMap.has(key)) { const color = stageColors[colorIdx % stageColors.length]; colorIdx++; const ns = await addStage(company.id, stageLabel, color); if (ns) stageMap.set(key, ns.id); }
      }

      for (const [posTitle, candidates] of pc.positions) {
        let position = positions.find(p => p.company_id === company!.id && p.title.toLowerCase().trim() === posTitle.toLowerCase().trim());
        if (!position) { position = await addPosition(posTitle, company.id) ?? undefined; }
        if (!position) { skippedInvalid += candidates.length; continue; }

        for (const cand of candidates) {
          if (!cand.name) { skippedInvalid++; continue; }
          const email = cand.email && isValidEmail(cand.email) ? cand.email : '';
          const nameKey = cand.name.toLowerCase().trim();
          const emailKey = email.toLowerCase().trim();
          if (dupIndex.nameKeys.has(nameKey) || batchNames.has(nameKey)) { skippedDuplicates++; continue; }
          if (emailKey && (dupIndex.emailKeys.has(emailKey) || batchEmails.has(emailKey))) { skippedDuplicates++; continue; }
          const stageId = cand.stage ? (stageMap.get(cand.stage.toLowerCase().trim()) ?? null) : null;
          try {
            const result = await addCandidate(cand.name, position.id, { stage_id: stageId, phone: cand.phone, email, expected_salary: cand.salary, notes: cand.notes });
            if (result) { imported++; batchNames.add(nameKey); if (emailKey) batchEmails.add(emailKey); } else { skippedInvalid++; }
          } catch { skippedInvalid++; }
        }
      }
    }

    const parts: string[] = [`Imported: ${imported}`];
    if (skippedDuplicates > 0) parts.push(`Skipped (duplicates): ${skippedDuplicates}`);
    if (skippedInvalid > 0) parts.push(`Skipped (invalid): ${skippedInvalid}`);
    toast({ title: 'Import complete', description: parts.join(' · ') });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { await supabase.from('activity_logs').insert({ user_id: user.id, action: 'import_candidates', entity_type: 'candidate', metadata: { file_name: fileName, imported, skipped_duplicates: skippedDuplicates, skipped_invalid: skippedInvalid } }); }
    } catch { /* best-effort */ }

    reset();
    setOpen(false);
  };

  const reset = () => {
    setParsedCompanies([]);
    setFileName('');
    setFileSize(0);
    setPreviewRows([]);
    setRawSheets([]);
    setStep('upload');
    setDragging(false);
    setColumnMapping(autoDetectMapping([]));
    setUnmappedCount(0);
  };

  const isOpen = externalOpen !== undefined ? externalOpen : open;
  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    onExternalOpenChange?.(o);
    if (o) reset();
  };

  const updateMapping = (field: CandidateField, colIndex: number) => {
    setColumnMapping(prev => ({ ...prev, [field]: colIndex }));
  };

  const applyMappingAndContinue = () => {
    rebuildCompanies(rawSheets, columnMapping);
  };

  const statusIcon = (status: RowStatus) => {
    if (status === 'valid') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    if (status === 'duplicate') return <Copy className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  };

  // Preview data from first sheet for the mapping step
  const firstSheet = rawSheets[0];
  const fileHeaders = firstSheet?.headers || [];
  const sampleRows = firstSheet?.rows.slice(0, 3) || [];

  // Block non-admin users entirely
  if (!isAdmin) return null;

  const stepTitle = step === 'mapping' ? 'Map Columns' : step === 'preview' ? 'Review Import' : 'Import Candidates';
  const stepDesc = step === 'mapping'
    ? 'Match your file columns to candidate fields. We auto-detected what we could.'
    : step === 'preview'
      ? 'Review parsed rows before importing. Invalid and duplicate rows will be skipped.'
      : 'Upload an Excel or CSV file where each tab is a company.';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
          <DialogDescription>{stepDesc}</DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">File (CSV / Excel)</label>
                <div className="flex items-center gap-2">
                  {rawSheets.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setStep('mapping')}>
                      Edit column mapping
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Download Template
                  </Button>
                </div>
              </div>
              <div
                className={`mt-1 relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                  {fileName ? (
                    <>
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">{fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">{dragging ? 'Drop file here' : 'Drag & drop or click to upload'}</p>
                        <p className="text-xs text-muted-foreground">.csv, .xlsx, .xls</p>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>
            </div>

            {parsedCompanies.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Companies & Positions found</label>
                {parsedCompanies.map((pc, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={pc.selected} onCheckedChange={() => toggleCompany(i)} disabled={pc.totalCandidates === 0} />
                      <button className="flex items-center gap-1 text-sm font-medium hover:text-primary" onClick={() => toggleExpanded(i)}>
                        {pc.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {pc.sheetName}
                      </button>
                      <Badge variant="secondary" className="text-xs">{pc.totalCandidates} candidate{pc.totalCandidates !== 1 ? 's' : ''}</Badge>
                      <Badge variant="outline" className="text-xs">{pc.positions.size} position{pc.positions.size !== 1 ? 's' : ''}</Badge>
                    </div>
                    {pc.expanded && pc.selected && (
                      <div className="ml-6 space-y-2">
                        {Array.from(pc.positions.entries()).map(([posTitle, candidates]) => (
                          <div key={posTitle} className="rounded border p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">{posTitle}</span>
                              <Badge variant="secondary" className="text-xs">{candidates.length}</Badge>
                            </div>
                            <ScrollArea className="max-h-24">
                              <div className="flex flex-wrap gap-1">
                                {candidates.map((c, ci) => (
                                  <Badge key={ci} variant="outline" className="text-xs">
                                    {c.name}{c.stage && <span className="ml-1 opacity-60">· {c.stage}</span>}
                                  </Badge>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={generatePreview} disabled={totalCandidates === 0}>
                Review {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>

        ) : step === 'mapping' ? (
          <div className="flex flex-col gap-4 overflow-hidden min-h-0">
            {/* Mapping grid */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3">
                {CANDIDATE_FIELDS.map(({ key, label, required }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-right">
                      <span className="text-sm text-foreground">{label}</span>
                      {required && <span className="text-destructive ml-0.5">*</span>}
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={columnMapping[key] >= 0 ? String(columnMapping[key]) : '__none__'}
                      onValueChange={(val) => updateMapping(key, val === '__none__' ? -1 : parseInt(val, 10))}
                    >
                      <SelectTrigger className="w-52 h-8 text-xs">
                        <SelectValue placeholder="— skip —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs text-muted-foreground">— skip —</SelectItem>
                        {fileHeaders.map((h, idx) => (
                          <SelectItem key={idx} value={String(idx)} className="text-xs">{h || `Column ${idx + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {columnMapping[key] >= 0 && sampleRows.length > 0 && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        e.g. "{sanitize(sampleRows[0]?.[columnMapping[key]], 40)}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Sample data preview */}
            {sampleRows.length > 0 && (
              <div className="shrink-0">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">File preview (first 3 rows)</p>
                <ScrollArea className="border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {fileHeaders.map((h, i) => (
                          <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h || `Col ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, ri) => (
                        <tr key={ri} className="border-t">
                          {fileHeaders.map((_, ci) => (
                            <td key={ci} className="px-2 py-1 text-muted-foreground truncate max-w-[120px]">{sanitize(row[ci], 50) || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between shrink-0">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { rebuildCompanies(rawSheets, columnMapping); }}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button onClick={applyMappingAndContinue} disabled={columnMapping.name < 0} className="gap-1.5">
                  Apply Mapping <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

        ) : (
          <TooltipProvider delayDuration={200}>
          <div className="flex flex-col gap-3 overflow-hidden min-h-0">
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {validRows.length} valid
              </Badge>
              {duplicateRows.length > 0 && (
                <Badge variant="secondary" className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3 text-amber-500" />
                  {duplicateRows.length} duplicate{duplicateRows.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {invalidRows.length > 0 && (
                <Badge variant="destructive" className="gap-1.5 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {invalidRows.length} invalid
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Position</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className={`border-t ${row.status === 'invalid' ? 'bg-destructive/5' : row.status === 'duplicate' ? 'bg-amber-500/5' : ''}`}>
                      <td className="px-3 py-1.5">
                        {row.reason ? (
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-default">{statusIcon(row.status)}</span></TooltipTrigger>
                            <TooltipContent side="right" className="text-xs">{row.reason}</TooltipContent>
                          </Tooltip>
                        ) : statusIcon(row.status)}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-foreground truncate max-w-[140px]">
                        {row.candidate.name || <span className="text-destructive italic">empty</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[120px]">{row.candidate.position || 'Unassigned'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[140px]">{row.candidate.email || '—'}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">{row.company}</td>
                      <td className="px-3 py-1.5">
                        {row.reason && (
                          <span className={`text-[11px] ${row.status === 'invalid' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>{row.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <div className="flex items-center justify-between shrink-0">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep('upload')}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={validRows.length === 0 || importing}>
                  {importing ? 'Importing...' : `Import ${validRows.length} candidate${validRows.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </div>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
