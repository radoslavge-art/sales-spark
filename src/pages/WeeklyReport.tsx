import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, ChevronDown, ChevronRight, ChevronLeft, Trash2, CalendarIcon, Upload, FileSpreadsheet, X, GripVertical, Undo2, Redo2, Eye, EyeOff, Filter, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/UserMenu';
import { useLanguage } from '@/context/LanguageContext';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';

// ---------- types ----------
interface Report {
  id: string;
  week_start_date: string;
  week_end_date: string;
  sort_order: number;
  deleted_at?: string | null;
}

interface ReportRow {
  id: string;
  report_id: string;
  company_name: string;
  position_name: string;
  recruiter: string;
  sort_order: number;
  fb_applicants: number;
  job_post: number;
  linkedin: number;
  phone_screens: number;
  sent_to_client: number;
  interviews: number;
  offers: number;
  accepted: number;
  hires: number;
  rejections: number;
  notes: string;
  row_status: string | null;
}

interface CompanyGroup {
  name: string;
  rows: ReportRow[];
  collapsed: boolean;
}

interface ColumnDef {
  field: EditableField;
  label: string;
  type: 'text' | 'num';
  defaultWidth: number;
}

const NUMERIC_FIELDS = [
  'fb_applicants', 'job_post', 'linkedin', 'phone_screens',
  'sent_to_client', 'interviews', 'offers', 'accepted', 'hires', 'rejections',
] as const;

type NumericField = typeof NUMERIC_FIELDS[number];
type EditableField = 'company_name' | 'position_name' | 'recruiter' | NumericField | 'notes';

const ALL_COLUMNS: ColumnDef[] = [
  { field: 'company_name', label: 'Company', type: 'text', defaultWidth: 220 },
  { field: 'position_name', label: 'Position', type: 'text', defaultWidth: 400 },
  { field: 'recruiter', label: 'Recruiter', type: 'text', defaultWidth: 130 },
  { field: 'fb_applicants', label: 'FB Applicants', type: 'num', defaultWidth: 110 },
  { field: 'job_post', label: 'Job Post', type: 'num', defaultWidth: 85 },
  { field: 'linkedin', label: 'LinkedIn', type: 'num', defaultWidth: 90 },
  { field: 'phone_screens', label: 'Phone Screens', type: 'num', defaultWidth: 115 },
  { field: 'sent_to_client', label: 'Sent to Client', type: 'num', defaultWidth: 110 },
  { field: 'interviews', label: 'Interviews', type: 'num', defaultWidth: 95 },
  { field: 'offers', label: 'Offers', type: 'num', defaultWidth: 70 },
  { field: 'accepted', label: 'Accepted', type: 'num', defaultWidth: 90 },
  { field: 'hires', label: 'Hires', type: 'num', defaultWidth: 65 },
  { field: 'rejections', label: 'Rejections', type: 'num', defaultWidth: 90 },
  { field: 'notes', label: 'Notes', type: 'text', defaultWidth: 200 },
];

function cellKey(rowId: string, field: string) { return `${rowId}:${field}`; }

interface UndoAction { rowId: string; field: string; oldValue: string | number | null; newValue: string | number | null; }
function parseCellKey(key: string): { rowId: string; field: string } {
  const i = key.indexOf(':');
  return { rowId: key.slice(0, i), field: key.slice(i + 1) };
}

// ---------- date helpers ----------
function getMostRecentWednesday(d: Date): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = result.getDay();
  const diff = (day >= 3) ? (day - 3) : (day + 4);
  result.setDate(result.getDate() - diff);
  return result;
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtShort(d: Date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function getISOWeek(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function makeWeekLabel(startStr: string, endStr: string): string {
  const s = parseDate(startStr);
  const e = parseDate(endStr);
  return `W${getISOWeek(s)} (${fmtShort(s)} – ${fmtShort(e)})`;
}

const ROW_STATUS_OPTIONS = [
  { value: null, labelKey: 'weeklyReport.statusNone', color: 'text-muted-foreground', dot: 'bg-transparent border border-muted-foreground/40' },
  { value: 'accepted', labelKey: 'weeklyReport.acceptedHired', color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  { value: 'paused', labelKey: 'weeklyReport.pausedOnHold', color: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { value: 'closed', labelKey: 'weeklyReport.closed', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
] as const;

function getRowColor(row: ReportRow): string {
  if (row.row_status === 'closed') return 'wr-row-closed';
  if (row.row_status === 'paused') return 'wr-row-paused';
  if (row.row_status === 'accepted') return 'wr-row-accepted';
  if (row.row_status === null || row.row_status === undefined) {
    const notesLower = (row.notes || '').toLowerCase();
    if (notesLower.includes('closed')) return 'wr-row-closed';
    if (notesLower.includes('paused') || notesLower.includes('on hold')) return 'wr-row-paused';
    if (row.accepted > 0 || row.hires > 0) return 'wr-row-accepted';
  }
  return '';
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ---------- Column widths ----------
function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('wr-col-widths');
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    const defaults: Record<string, number> = {};
    ALL_COLUMNS.forEach(c => { defaults[c.field] = c.defaultWidth; });
    return defaults;
  });

  const setWidth = useCallback((field: string, width: number) => {
    setWidths(prev => {
      const next = { ...prev, [field]: Math.max(40, width) };
      localStorage.setItem('wr-col-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  return { widths, setWidth };
}

// ---------- Resize handle ----------
function ResizeHandle({ field, setWidth, tableRef, columns }: { field: string; setWidth: (field: string, w: number) => void; tableRef?: React.RefObject<HTMLDivElement | null>; columns: ColumnDef[] }) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).parentElement;
    if (!th) return;
    startXRef.current = e.clientX;
    startWidthRef.current = th.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startXRef.current;
      setWidth(field, startWidthRef.current + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [field, setWidth]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tableRef?.current) return;
    const col = columns.find(c => c.field === field);
    if (!col) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    let maxW = ctx.measureText(col.label).width + 24;
    ctx.font = '400 12px Inter, system-ui, sans-serif';
    const table = tableRef.current.querySelector('table');
    if (table) {
      const colIdx = columns.findIndex(c => c.field === field);
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(tr => {
        const cells = tr.querySelectorAll('td');
        const cell = cells[colIdx + 1];
        if (cell) {
          const text = cell.textContent || '';
          const w = ctx.measureText(text).width + 16;
          if (w > maxW) maxW = w;
        }
      });
    }
    setWidth(field, Math.max(40, Math.ceil(maxW)));
  }, [field, setWidth, tableRef, columns]);

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 z-10"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

// ---------- Spreadsheet Cell ----------
const SpreadsheetCell = memo(function SpreadsheetCell({
  rowId,
  field,
  value,
  type,
  width,
  isSelected,
  isEditing,
  isCursor,
  stickyLeft,
  onChange,
  onMouseDown,
  onMouseEnter,
  onStartEdit,
  onFillHandleMouseDown,
  badge,
}: {
  rowId: string;
  field: string;
  value: string | number;
  type: 'text' | 'num';
  width: number;
  isSelected: boolean;
  isEditing: boolean;
  isCursor: boolean;
  stickyLeft?: number;
  onChange: (val: string | number) => void;
  onMouseDown: (rowId: string, field: string, e: React.MouseEvent) => void;
  onMouseEnter: (rowId: string, field: string) => void;
  onStartEdit: (rowId: string, field: string) => void;
  onFillHandleMouseDown?: (rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => void;
  badge?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayValue = type === 'num' && value === 0 ? '' : String(value);
  const inputValue = type === 'num' && value === 0 ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (type === 'num') {
      const cleaned = raw.replace(/[^\d]/g, '');
      onChange(cleaned === '' ? 0 : parseInt(cleaned, 10));
    } else {
      onChange(raw);
    }
  };

  return (
    <td
      className={cn(
        'px-0 py-0 border-r border-border last:border-r-0 relative cursor-default',
        type === 'num' ? 'text-center' : 'text-left',
        isCursor && !isEditing && 'outline outline-2 outline-primary ring-0 z-[3]',
        isSelected && !isCursor && !isEditing && 'bg-primary/8 ring-1 ring-inset ring-primary/25',
        isEditing && 'outline outline-2 outline-primary bg-background z-[3]',
      )}
      style={{ width, minWidth: width, maxWidth: width }}
      onMouseDown={e => onMouseDown(rowId, field, e)}
      onMouseEnter={() => onMouseEnter(rowId, field)}
      onDoubleClick={() => onStartEdit(rowId, field)}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          className={cn(
            'w-full h-full px-2 py-1 bg-background outline-none text-[13px]',
            type === 'num' ? 'text-center tabular-nums font-medium' : 'text-left',
          )}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      ) : (
        <div
          className={cn(
            'w-full px-2 py-1 text-[13px] min-h-[28px] cursor-text overflow-hidden',
            badge ? 'flex items-center' : '',
            (field === 'position_name' || field === 'company_name' || field === 'notes') ? 'whitespace-normal break-words' : 'whitespace-nowrap',
            type === 'num' ? 'text-center tabular-nums font-medium text-muted-foreground' : 'text-left text-muted-foreground',
            field === 'company_name' && 'font-semibold text-foreground',
            field === 'position_name' && 'font-medium text-foreground/90',
            !displayValue && 'text-muted-foreground/20',
          )}
        >
          <span>{displayValue || (type === 'num' ? '' : '\u00A0')}</span>
          {badge}
        </div>
      )}
      {/* Fill handle */}
      {isCursor && !isEditing && onFillHandleMouseDown && (
        <div
          className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-crosshair z-10 translate-x-1/2 translate-y-1/2"
          onMouseDown={e => { e.stopPropagation(); onFillHandleMouseDown(rowId, field, e); }}
          onDoubleClick={e => { e.stopPropagation(); onFillHandleMouseDown(rowId, field, e, true); }}
        />
      )}
    </td>
  );
});

// ---------- Data row ----------
const DataRow = memo(function DataRow({
  row,
  columns,
  columnWidths,
  updateCell,
  deleteRow,
  selectedCells,
  editingCell,
  cursorCell,
  onCellMouseDown,
  onCellMouseEnter,
  onStartEdit,
  onFillHandleMouseDown,
  onCopyRow,
  isEven,
  isActiveRow,
  isNewPosition,
}: {
  row: ReportRow;
  columns: ColumnDef[];
  columnWidths: Record<string, number>;
  updateCell: (rowId: string, field: string, value: string | number | null) => void;
  deleteRow: (rowId: string) => void;
  selectedCells: Set<string>;
  editingCell: string | null;
  cursorCell: string | null;
  onCellMouseDown: (rowId: string, field: string, e: React.MouseEvent) => void;
  onCellMouseEnter: (rowId: string, field: string) => void;
  onStartEdit: (rowId: string, field: string) => void;
  onFillHandleMouseDown: (rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => void;
  onCopyRow: (rowId: string) => void;
  isEven: boolean;
  isActiveRow: boolean;
  isNewPosition?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useLanguage();
  const colorClass = getRowColor(row);
  const currentStatus = ROW_STATUS_OPTIONS.find(o => o.value === row.row_status) || ROW_STATUS_OPTIONS[0];

  return (
    <tr
      className={cn('group border-b border-border transition-colors wr-data-row', colorClass, isActiveRow && !colorClass && 'bg-primary/5')}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <td className="w-7 px-0 py-0 border-r border-border text-center bg-card">
        <div className="flex items-center justify-center gap-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 opacity-40 group-hover:opacity-100 transition-opacity" tabIndex={-1} title={t('weeklyReport.setRowStatus')}>
                <span className={cn('inline-block w-2.5 h-2.5 rounded-full', currentStatus.dot)} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              {ROW_STATUS_OPTIONS.map(opt => (
                <DropdownMenuItem
                  key={String(opt.value)}
                  onClick={() => updateCell(row.id, 'row_status', opt.value as any)}
                  className={cn('gap-2 text-xs', opt.color)}
                >
                  <span className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', opt.dot)} />
                  {t(opt.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      {columns.map((col, colIdx) => {
        const ck = cellKey(row.id, col.field);
        return (
          <SpreadsheetCell
            key={col.field}
            rowId={row.id}
            field={col.field}
            value={row[col.field as keyof ReportRow] as string | number}
            type={col.type}
            width={columnWidths[col.field] || col.defaultWidth}
            isSelected={selectedCells.has(ck)}
            isEditing={editingCell === ck}
            isCursor={cursorCell === ck}
            onChange={val => updateCell(row.id, col.field, val)}
            onMouseDown={onCellMouseDown}
            onMouseEnter={onCellMouseEnter}
            onStartEdit={onStartEdit}
            onFillHandleMouseDown={onFillHandleMouseDown}
            badge={col.field === 'position_name' && isNewPosition && !editingCell ? (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 leading-tight shrink-0">
                New
              </span>
            ) : undefined}
          />
        );
      })}
      <td className="w-8 px-1 text-center border-l border-border">
        <div className="flex items-center gap-0">
          <button onClick={() => onCopyRow(row.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5" tabIndex={-1} title={t('weeklyReport.copyRow')}>
            <Copy className="h-3 w-3" />
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-0.5">
              <button onClick={() => deleteRow(row.id)} className="text-[10px] font-medium text-destructive hover:underline" tabIndex={-1}>{t('common.yes')}</button>
              <span className="text-[10px] text-muted-foreground">/</span>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-muted-foreground hover:underline" tabIndex={-1}>{t('common.no')}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5" tabIndex={-1} title={t('weeklyReport.deleteRow')}>
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ---------- Group section ----------
function GroupSection({
  group,
  columns,
  onToggle,
  columnWidths,
  updateCell,
  deleteRow,
  deleteCompany,
  renameCompany,
  addRowToCompany,
  selectedCells,
  editingCell,
  cursorCell,
  onCellMouseDown,
  onCellMouseEnter,
  onStartEdit,
  onFillHandleMouseDown,
  onCopyRow,
  isNewCompany,
  isNewPosition,
}: {
  group: CompanyGroup;
  columns: ColumnDef[];
  onToggle: () => void;
  columnWidths: Record<string, number>;
  updateCell: (rowId: string, field: string, value: string | number | null) => void;
  deleteRow: (rowId: string) => void;
  deleteCompany: (companyName: string) => void;
  renameCompany: (oldName: string, newName: string) => void;
  addRowToCompany: (companyName: string) => void;
  selectedCells: Set<string>;
  editingCell: string | null;
  cursorCell: string | null;
  onCellMouseDown: (rowId: string, field: string, e: React.MouseEvent) => void;
  onCellMouseEnter: (rowId: string, field: string) => void;
  onStartEdit: (rowId: string, field: string) => void;
  onFillHandleMouseDown: (rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => void;
  onCopyRow: (rowId: string) => void;
  isNewCompany?: boolean;
  isNewPosition?: (row: ReportRow) => boolean;
}) {
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitRename = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue.trim() !== group.name) {
      renameCompany(group.name, nameValue.trim());
    } else {
      setNameValue(group.name);
    }
  };

  return (
    <>
      <tr
        className="wr-group-header cursor-pointer group/header border-t-2 border-border"
        onClick={onToggle}
        onMouseLeave={() => setConfirmDeleteGroup(false)}
      >
        <td colSpan={columns.length + 2} className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            {group.collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            {editingName ? (
              <input
                ref={nameInputRef}
                className="font-semibold text-[13px] text-foreground bg-background outline-none ring-2 ring-primary/50 rounded-sm px-1.5 py-0.5 min-w-[120px]"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingName(false); setNameValue(group.name); }
                }}
              />
            ) : (
              <span
                className="font-semibold text-[13px] text-foreground cursor-text hover:underline decoration-dotted underline-offset-2"
                onDoubleClick={e => { e.stopPropagation(); setNameValue(group.name); setEditingName(true); }}
                title={t('weeklyReport.doubleClickToRename') || 'Double-click to rename'}
              >
                {group.name}
              </span>
            )}
            {isNewCompany && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                New
              </span>
            )}
            <span className="text-[11px] text-muted-foreground font-medium">({group.rows.length})</span>
            <div className="ml-auto">
              {confirmDeleteGroup ? (
                <span className="flex items-center gap-1 text-[10px]" onClick={e => e.stopPropagation()}>
                  <span className="text-destructive font-medium">{t('weeklyReport.deleteCompanyRows')}</span>
                  <button onClick={() => deleteCompany(group.name)} className="text-destructive font-medium hover:underline">{t('common.yes')}</button>
                  <span className="text-muted-foreground">/</span>
                  <button onClick={() => setConfirmDeleteGroup(false)} className="text-muted-foreground hover:underline">{t('common.no')}</button>
                </span>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDeleteGroup(true); }}
                  className="opacity-0 group-hover/header:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
                  tabIndex={-1}
                  title={t('weeklyReport.deleteCompanyPositions')}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </td>
      </tr>
      {!group.collapsed && group.rows.map((row, idx) => (
        <DataRow
          key={row.id}
          row={row}
          columns={columns}
          columnWidths={columnWidths}
          updateCell={updateCell}
          deleteRow={deleteRow}
          selectedCells={selectedCells}
          editingCell={editingCell}
          cursorCell={cursorCell}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onStartEdit={onStartEdit}
          onFillHandleMouseDown={onFillHandleMouseDown}
           onCopyRow={onCopyRow}
           isEven={idx % 2 === 0}
           isActiveRow={cursorCell ? parseCellKey(cursorCell).rowId === row.id : false}
           isNewPosition={isNewPosition ? isNewPosition(row) : false}
        />
      ))}
      {!group.collapsed && (
        <tr className="border-b border-border hover:bg-muted/40 transition-colors">
          <td colSpan={columns.length + 2} className="px-4 py-2">
            <button
              onClick={e => { e.stopPropagation(); addRowToCompany(group.name); }}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 pl-6 py-0.5"
            >
              <Plus className="h-3.5 w-3.5" /> {t('weeklyReport.addPosition')}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------- New row (auto-creates on typing) ----------
function NewRowInput({
  activeReportId,
  rowCount,
  onRowCreated,
  columnWidths,
  columns,
}: {
  activeReportId: string;
  rowCount: number;
  onRowCreated: (row: ReportRow) => void;
  columnWidths: Record<string, number>;
  columns: ColumnDef[];
}) {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const creatingRef = useRef(false);
  const { t } = useLanguage();

  const createRow = useCallback(async () => {
    if (creatingRef.current) return;
    if (!company.trim() && !position.trim()) return;
    creatingRef.current = true;
    const { data, error } = await supabase
      .from('weekly_report_rows')
      .insert({
        report_id: activeReportId,
        company_name: company.trim(),
        position_name: position.trim(),
        sort_order: rowCount,
      } as any)
      .select()
      .single();
    creatingRef.current = false;
    if (error) { toast({ title: t('weeklyReport.failedToAddRow'), variant: 'destructive' }); return; }
    onRowCreated(data as ReportRow);
    setCompany('');
    setPosition('');
  }, [activeReportId, rowCount, onRowCreated, company, position, t]);

  return (
    <tr className="border-t-2 border-border/80">
      <td className="w-7" />
      <td colSpan={columns.length} className="px-3 py-3">
        {!company && !position ? (
          <Button
            onClick={() => setCompany(' ')}
            className="mt-2 ml-1"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" /> {t('weeklyReport.addCompany')}
          </Button>
        ) : (
          <div className="flex items-center gap-2 mt-2">
            <input
              className="bg-transparent outline-none text-xs px-1.5 py-1 border border-border rounded-md w-40 focus:ring-2 focus:ring-primary/50"
              placeholder={t('weeklyReport.companyName')}
              value={company}
              onChange={e => setCompany(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); createRow(); }
                if (e.key === 'Escape') { setCompany(''); setPosition(''); }
              }}
            />
            <input
              className="bg-transparent outline-none text-xs px-1.5 py-1 border border-border rounded-md w-48 focus:ring-2 focus:ring-primary/50"
              placeholder={t('weeklyReport.positionOptional')}
              value={position}
              onChange={e => setPosition(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); createRow(); }
                if (e.key === 'Escape') { setCompany(''); setPosition(''); }
              }}
            />
            <Button size="sm" onClick={createRow}>{t('common.add')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCompany(''); setPosition(''); }}>{t('common.cancel')}</Button>
          </div>
        )}
      </td>
      <td className="w-8" />
    </tr>
  );
}

// ---------- main component ----------
export default function WeeklyReport() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [importing, setImporting] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [confirmDeleteTabId, setConfirmDeleteTabId] = useState<string | null>(null);

  // Selection
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cursorCell, setCursorCell] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<string | null>(null);

  // Save indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef(0);

  // (recruiter filter removed)

  // Fill handle drag
  const isFillDraggingRef = useRef(false);
  const autoFillRef = useRef<{ rowId: string; field: string } | null>(null);
  const fillStartCellRef = useRef<string | null>(null);
  const [fillRange, setFillRange] = useState<Set<string>>(new Set());

  const { widths: columnWidths, setWidth: setColumnWidth } = useColumnWidths();

  // ---- Hidden columns (persisted) ----
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('wr-hidden-cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* noop */ }
    return new Set();
  });

  const visibleColumns = useMemo(() =>
    ALL_COLUMNS.filter(c => !hiddenColumns.has(c.field)),
    [hiddenColumns]
  );

  const hideColumn = useCallback((field: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      next.add(field);
      localStorage.setItem('wr-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const showColumn = useCallback((field: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      next.delete(field);
      localStorage.setItem('wr-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // ---- Column labels (renameable, persisted in localStorage) ----
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wr-col-labels');
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    return {};
  });
  const [editingColumnField, setEditingColumnField] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');
  const columnInputRef = useRef<HTMLInputElement>(null);
  const [contextMenuCol, setContextMenuCol] = useState<{ field: string; x: number; y: number } | null>(null);

  const getColumnLabel = useCallback((field: string) => {
    return columnLabels[field] || ALL_COLUMNS.find(c => c.field === field)?.label || field;
  }, [columnLabels]);

  const handleColumnDoubleClick = useCallback((field: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingColumnField(field);
    setEditingColumnLabel(getColumnLabel(field));
  }, [getColumnLabel]);

  const commitColumnLabel = useCallback(() => {
    if (!editingColumnField) return;
    const trimmed = editingColumnLabel.trim();
    if (trimmed) {
      setColumnLabels(prev => {
        const next = { ...prev, [editingColumnField]: trimmed };
        localStorage.setItem('wr-col-labels', JSON.stringify(next));
        return next;
      });
    }
    setEditingColumnField(null);
  }, [editingColumnField, editingColumnLabel]);

  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editName, setEditName] = useState('');
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [pendingNewReportId, setPendingNewReportId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createWeekLabel, setCreateWeekLabel] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const createWeekLabelRef = useRef('');
  const autoFocusFirstCellRef = useRef(false);

  // ---- New entry tracking (emerald "New" badges) ----
  const [newEntries, setNewEntries] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wr-new-entries');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const markNew = useCallback((key: string, reportId: string) => {
    setNewEntries(prev => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: reportId };
      localStorage.setItem('wr-new-entries', JSON.stringify(next));
      return next;
    });
  }, []);

  const isNewForCurrentTab = useCallback((key: string) => {
    const originReportId = newEntries[key];
    if (!originReportId) return false;
    const originIdx = reports.findIndex(r => r.id === originReportId);
    const currentIdx = reports.findIndex(r => r.id === activeReportId);
    if (originIdx === -1 || currentIdx === -1) return false;
    // Reports are sorted newest-first (descending), so "next tab" is originIdx - 1
    return currentIdx === originIdx || currentIdx === originIdx - 1;
  }, [newEntries, reports, activeReportId]);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  // ---- Undo/Redo system ----
  const undoStack = useRef<UndoAction[][]>([]);
  const redoStack = useRef<UndoAction[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_UNDO = 50;

  // Refs to always have current values for delayed persistence
  const rowsRef = useRef<ReportRow[]>([]);
  const activeReportIdRef = useRef<string | null>(null);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { activeReportIdRef.current = activeReportId; }, [activeReportId]);

  const pushUndo = useCallback((actions: UndoAction[]) => {
    undoStack.current.push(actions);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  const performUndo = useCallback(() => {
    const batch = undoStack.current.pop();
    if (!batch) return;
    setUndoCount(undoStack.current.length);
    setEditingCell(null);
    setRows(prev => {
      const next = [...prev];
      for (const action of batch) {
        const idx = next.findIndex(r => r.id === action.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [action.field]: action.oldValue };
      }
      return next;
    });
    for (const action of batch) saveField(action.rowId, action.field, action.oldValue);
    redoStack.current.push(batch);
    setRedoCount(redoStack.current.length);
  }, []);

  const performRedo = useCallback(() => {
    const batch = redoStack.current.pop();
    if (!batch) return;
    setRedoCount(redoStack.current.length);
    setEditingCell(null);
    setRows(prev => {
      const next = [...prev];
      for (const action of batch) {
        const idx = next.findIndex(r => r.id === action.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [action.field]: action.newValue };
      }
      return next;
    });
    for (const action of batch) saveField(action.rowId, action.field, action.newValue);
    undoStack.current.push(batch);
    setUndoCount(undoStack.current.length);
  }, []);

  const flatRowIds = useMemo(() => rows.map(r => r.id), [rows]);

  useEffect(() => { loadReports(); }, []);

  // ---- Tab scroll controls ----
  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    if (!tabScrollRef.current) return;
    const amount = 200;
    tabScrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    if (!activeReportId || !tabScrollRef.current) return;
    const activeEl = tabScrollRef.current.querySelector(`[data-tab-id="${activeReportId}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeReportId]);

  // ---- Cell range calculation ----
  const getCellRange = useCallback((startKey: string, endKey: string): Set<string> => {
    const s = parseCellKey(startKey);
    const e = parseCellKey(endKey);
    const rowStart = flatRowIds.indexOf(s.rowId);
    const rowEnd = flatRowIds.indexOf(e.rowId);
    const colStart = visibleColumns.findIndex(c => c.field === s.field);
    const colEnd = visibleColumns.findIndex(c => c.field === e.field);
    if (rowStart === -1 || rowEnd === -1 || colStart === -1 || colEnd === -1) return new Set();
    const rLo = Math.min(rowStart, rowEnd), rHi = Math.max(rowStart, rowEnd);
    const cLo = Math.min(colStart, colEnd), cHi = Math.max(colStart, colEnd);
    const result = new Set<string>();
    for (let r = rLo; r <= rHi; r++) {
      for (let c = cLo; c <= cHi; c++) {
        result.add(cellKey(flatRowIds[r], visibleColumns[c].field));
      }
    }
    return result;
  }, [flatRowIds, visibleColumns]);

  // ---- Mouse handlers for cell selection ----
  const handleCellMouseDown = useCallback((rowId: string, field: string, e: React.MouseEvent) => {
    const ck = cellKey(rowId, field);
    if (editingCell === ck) return;
    setEditingCell(null);
    isDraggingRef.current = true;
    dragStartCellRef.current = ck;
    if (e.shiftKey && cursorCell) {
      setSelectedCells(getCellRange(cursorCell, ck));
    } else {
      setSelectedCells(new Set([ck]));
    }
    setCursorCell(ck);
  }, [editingCell, cursorCell, getCellRange]);

  const handleCellMouseEnter = useCallback((rowId: string, field: string) => {
    if (!isDraggingRef.current || !dragStartCellRef.current) return;
    const ck = cellKey(rowId, field);
    setSelectedCells(getCellRange(dragStartCellRef.current, ck));
  }, [getCellRange]);

  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
      // Handle fill drag complete
      if (isFillDraggingRef.current && fillStartCellRef.current && fillRange.size > 0) {
        isFillDraggingRef.current = false;
        const { rowId: srcRowId, field: srcField } = parseCellKey(fillStartCellRef.current);
        const srcRow = rowsRef.current.find(r => r.id === srcRowId);
        if (srcRow) {
          const srcValue = srcRow[srcField as keyof ReportRow] as string | number;
          const undoActions: UndoAction[] = [];
          const updates: { rowId: string; field: string; value: string | number }[] = [];
          fillRange.forEach(ck => {
            if (ck === fillStartCellRef.current) return;
            const { rowId, field } = parseCellKey(ck);
            const currentRow = rowsRef.current.find(r => r.id === rowId);
            const oldVal = currentRow ? (currentRow[field as keyof ReportRow] as string | number | null) : null;
            undoActions.push({ rowId, field, oldValue: oldVal, newValue: srcValue });
            updates.push({ rowId, field, value: srcValue });
          });
          if (undoActions.length > 0) pushUndo(undoActions);
          setRows(prev => {
            const next = [...prev];
            for (const u of updates) {
              const idx = next.findIndex(r => r.id === u.rowId);
              if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
            }
            return next;
          });
          for (const u of updates) saveField(u.rowId, u.field, u.value);
          toast({ title: t('weeklyReport.filledCells', { count: updates.length }) });
        }
        setFillRange(new Set());
        fillStartCellRef.current = null;
      }
      isFillDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [fillRange, pushUndo]);

  // Fill handle mouse down
  const handleFillHandleMouseDown = useCallback((rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => {
    e.preventDefault();
    if (autoFill) {
      // Mark for auto-fill (handled via effect-like pattern below)
      autoFillRef.current = { rowId, field };
      return;
    }
    isFillDraggingRef.current = true;
    const ck = cellKey(rowId, field);
    fillStartCellRef.current = ck;
    setFillRange(new Set([ck]));
  }, []);

  // Override mouse enter for fill drag
  const handleCellMouseEnterWrapped = useCallback((rowId: string, field: string) => {
    if (isFillDraggingRef.current && fillStartCellRef.current) {
      const { field: srcField } = parseCellKey(fillStartCellRef.current);
      // Fill only vertically (same column)
      const ck = cellKey(rowId, srcField);
      const startIdx = flatRowIds.indexOf(parseCellKey(fillStartCellRef.current).rowId);
      const endIdx = flatRowIds.indexOf(rowId);
      if (startIdx === -1 || endIdx === -1) return;
      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);
      const range = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        range.add(cellKey(flatRowIds[i], srcField));
      }
      setFillRange(range);
      return;
    }
    if (!isDraggingRef.current || !dragStartCellRef.current) return;
    const ck = cellKey(rowId, field);
    setSelectedCells(getCellRange(dragStartCellRef.current, ck));
  }, [getCellRange, flatRowIds]);

  const handleStartEdit = useCallback((rowId: string, field: string) => {
    const ck = cellKey(rowId, field);
    setEditingCell(ck);
    setCursorCell(ck);
    setSelectedCells(new Set([ck]));
  }, []);

  const saveField = useCallback((rowId: string, field: string, value: string | number | null) => {
    const key = `${rowId}-${field}`;
    const existing = saveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    pendingSavesRef.current++;
    setSaveStatus('saving');
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    saveTimers.current.set(key, setTimeout(async () => {
      await supabase.from('weekly_report_rows').update({ [field]: value } as any).eq('id', rowId);
      saveTimers.current.delete(key);
      pendingSavesRef.current--;
      if (pendingSavesRef.current <= 0) {
        pendingSavesRef.current = 0;
        setSaveStatus('saved');
        saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
      }
    }, 300));
  }, []);

  // ---- Copy / Paste ----
  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;
    const cells = Array.from(selectedCells).map(ck => parseCellKey(ck));
    const rowIds = [...new Set(cells.map(c => c.rowId))];
    const fields = [...new Set(cells.map(c => c.field))];
    // Sort by grid position
    rowIds.sort((a, b) => flatRowIds.indexOf(a) - flatRowIds.indexOf(b));
    fields.sort((a, b) => {
      const ai = visibleColumns.findIndex(c => c.field === a);
      const bi = visibleColumns.findIndex(c => c.field === b);
      return ai - bi;
    });
    const tsvRows = rowIds.map(rid => {
      return fields.map(f => {
        const ck = cellKey(rid, f);
        if (!selectedCells.has(ck)) return '';
        const row = rowsRef.current.find(r => r.id === rid);
        if (!row) return '';
        const val = row[f as keyof ReportRow];
        const col = visibleColumns.find(c => c.field === f);
        if (col?.type === 'num' && val === 0) return '0';
        return String(val ?? '');
      }).join('\t');
    });
    navigator.clipboard.writeText(tsvRows.join('\n')).then(() => {
      toast({ title: t('weeklyReport.copiedCells', { count: selectedCells.size }) });
    });
  }, [selectedCells, flatRowIds, visibleColumns]);

  const handlePaste = useCallback(async () => {
    if (!cursorCell) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const { rowId, field } = parseCellKey(cursorCell);
      const startRowIdx = flatRowIds.indexOf(rowId);
      const startColIdx = visibleColumns.findIndex(c => c.field === field);
      if (startRowIdx === -1 || startColIdx === -1) return;
      const pasteRows = text.split('\n').map(line => line.split('\t'));
      const undoActions: UndoAction[] = [];
      const updates: { rowId: string; field: string; value: string | number }[] = [];
      for (let r = 0; r < pasteRows.length; r++) {
        const ri = startRowIdx + r;
        if (ri >= flatRowIds.length) break;
        for (let c = 0; c < pasteRows[r].length; c++) {
          const ci = startColIdx + c;
          if (ci >= visibleColumns.length) break;
          const targetRowId = flatRowIds[ri];
          const targetField = visibleColumns[ci].field;
          const col = visibleColumns[ci];
          const raw = pasteRows[r][c];
          const newVal = col.type === 'num' ? (parseInt(raw, 10) || 0) : raw;
          const currentRow = rowsRef.current.find(row => row.id === targetRowId);
          const oldVal = currentRow ? (currentRow[targetField as keyof ReportRow] as string | number | null) : null;
          undoActions.push({ rowId: targetRowId, field: targetField, oldValue: oldVal, newValue: newVal });
          updates.push({ rowId: targetRowId, field: targetField, value: newVal });
        }
      }
      if (undoActions.length > 0) pushUndo(undoActions);
      setRows(prev => {
        const next = [...prev];
        for (const u of updates) {
          const idx = next.findIndex(row => row.id === u.rowId);
          if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
        }
        return next;
      });
      for (const u of updates) saveField(u.rowId, u.field, u.value);
      toast({ title: t('weeklyReport.pastedCells', { count: updates.length }) });
    } catch {
      toast({ title: t('weeklyReport.pasteFailed'), variant: 'destructive' });
    }
  }, [cursorCell, flatRowIds, visibleColumns, pushUndo, saveField]);

  // Auto-fill on double-click (needs saveField)
  useEffect(() => {
    if (!autoFillRef.current) return;
    const { rowId, field } = autoFillRef.current;
    autoFillRef.current = null;
    const srcRow = rowsRef.current.find(r => r.id === rowId);
    if (!srcRow) return;
    const srcValue = srcRow[field as keyof ReportRow] as string | number;
    const startIdx = flatRowIds.indexOf(rowId);
    if (startIdx === -1) return;
    const undoActions: UndoAction[] = [];
    const updates: { rowId: string; field: string; value: string | number }[] = [];
    for (let i = startIdx + 1; i < flatRowIds.length; i++) {
      const r = rowsRef.current.find(rr => rr.id === flatRowIds[i]);
      if (!r || r.company_name !== srcRow.company_name) break;
      const oldVal = r[field as keyof ReportRow] as string | number | null;
      undoActions.push({ rowId: flatRowIds[i], field, oldValue: oldVal, newValue: srcValue });
      updates.push({ rowId: flatRowIds[i], field, value: srcValue });
    }
    if (undoActions.length > 0) pushUndo(undoActions);
    setRows(prev => {
      const next = [...prev];
      for (const u of updates) {
        const idx = next.findIndex(r => r.id === u.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
      }
      return next;
    });
    for (const u of updates) saveField(u.rowId, u.field, u.value);
    if (updates.length > 0) toast({ title: t('weeklyReport.autoFilledCells', { count: updates.length }) });
  });

  // ---- Keyboard navigation ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Undo / Redo — handle BEFORE isInput checks so they work from formula bar too
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (isInput) (target as HTMLInputElement).blur();
        setEditingCell(null);
        performUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z'))) {
        e.preventDefault();
        if (isInput) (target as HTMLInputElement).blur();
        setEditingCell(null);
        performRedo();
        return;
      }

      if (isInput && editingCell) {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          target.blur();
          const { rowId, field } = parseCellKey(editingCell);
          const rowIdx = flatRowIds.indexOf(rowId);
          const colIdx = visibleColumns.findIndex(c => c.field === field);
          let nextRow = rowIdx, nextCol = colIdx;

          if (e.key === 'Tab') {
            if (e.shiftKey) { nextCol--; } else { nextCol++; }
            if (nextCol >= visibleColumns.length) { nextCol = 0; nextRow++; }
            if (nextCol < 0) { nextCol = visibleColumns.length - 1; nextRow--; }
          } else {
            nextRow++;
          }

          if (nextRow >= 0 && nextRow < flatRowIds.length && nextCol >= 0 && nextCol < visibleColumns.length) {
            const nk = cellKey(flatRowIds[nextRow], visibleColumns[nextCol].field);
            setCursorCell(nk);
            setSelectedCells(new Set([nk]));
            setEditingCell(nk);
          } else {
            setEditingCell(null);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          target.blur();
          setEditingCell(null);
          return;
        }
        return;
      }

      if (isInput) return;



      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedCells.size > 0) {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Bulk clear
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCells.size > 0) {
        e.preventDefault();
        bulkClearCells(selectedCells);
        return;
      }

      // Ctrl+D duplicate row
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && cursorCell) {
        e.preventDefault();
        const { rowId } = parseCellKey(cursorCell);
        handleCopyRowAsNew(rowId);
        return;
      }

      if (!cursorCell) return;
      const { rowId, field } = parseCellKey(cursorCell);
      const rowIdx = flatRowIds.indexOf(rowId);
      const colIdx = visibleColumns.findIndex(c => c.field === field);
      if (rowIdx === -1 || colIdx === -1) return;

      let nextRow = rowIdx;
      let nextCol = colIdx;

      // Ctrl+Arrow: jump to next non-empty cell
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        for (let i = rowIdx + 1; i < flatRowIds.length; i++) {
          const r = rowsRef.current.find(rr => rr.id === flatRowIds[i]);
          if (r && r[field as keyof ReportRow]) { nextRow = i; break; }
          if (i === flatRowIds.length - 1) nextRow = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        for (let i = rowIdx - 1; i >= 0; i--) {
          const r = rowsRef.current.find(rr => rr.id === flatRowIds[i]);
          if (r && r[field as keyof ReportRow]) { nextRow = i; break; }
          if (i === 0) nextRow = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        const row = rowsRef.current.find(rr => rr.id === rowId);
        for (let i = colIdx + 1; i < visibleColumns.length; i++) {
          if (row && row[visibleColumns[i].field as keyof ReportRow]) { nextCol = i; break; }
          if (i === visibleColumns.length - 1) nextCol = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        const row = rowsRef.current.find(rr => rr.id === rowId);
        for (let i = colIdx - 1; i >= 0; i--) {
          if (row && row[visibleColumns[i].field as keyof ReportRow]) { nextCol = i; break; }
          if (i === 0) nextCol = i;
        }
      } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); nextCol++; }
      else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); nextCol--; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nextRow++; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); nextRow--; }
      else if (e.key === 'Enter') {
        e.preventDefault();
        setEditingCell(cursorCell);
        return;
      }
      else if (e.key === 'F2') {
        e.preventDefault();
        setEditingCell(cursorCell);
        return;
      }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setEditingCell(cursorCell);
        return;
      }
      else return;

      if (nextCol >= visibleColumns.length) { nextCol = 0; nextRow++; }
      if (nextCol < 0) { nextCol = visibleColumns.length - 1; nextRow--; }
      if (nextRow < 0 || nextRow >= flatRowIds.length) return;

      const nk = cellKey(flatRowIds[nextRow], visibleColumns[nextCol].field);
      setCursorCell(nk);
      if (e.shiftKey && (e.key.startsWith('Arrow'))) {
        setSelectedCells(prev => {
          const next = new Set(prev);
          next.add(nk);
          return next;
        });
      } else {
        setSelectedCells(new Set([nk]));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingCell, cursorCell, flatRowIds, selectedCells, visibleColumns]);

  const bulkClearCells = useCallback((cells: Set<string>) => {
    const updates: { rowId: string; field: string; value: string | number }[] = [];
    const undoActions: UndoAction[] = [];
    cells.forEach(ck => {
      const { rowId, field } = parseCellKey(ck);
      const col = visibleColumns.find(c => c.field === field);
      if (!col) return;
      const newVal = col.type === 'num' ? 0 : '';
      const currentRow = rowsRef.current.find(r => r.id === rowId);
      const oldVal = currentRow ? (currentRow[field as keyof ReportRow] as string | number | null) : null;
      updates.push({ rowId, field, value: newVal });
      undoActions.push({ rowId, field, oldValue: oldVal, newValue: newVal });
    });

    if (undoActions.length > 0) pushUndo(undoActions);

    setRows(prev => {
      const next = [...prev];
      for (const u of updates) {
        const idx = next.findIndex(r => r.id === u.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
      }
      return next;
    });

    for (const u of updates) saveField(u.rowId, u.field, u.value);
    toast({ title: t('weeklyReport.clearedCells', { count: updates.length }) });
    setSelectedCells(new Set());
  }, [visibleColumns, pushUndo]);

  // ---- Data loading ----
  const loadReports = useCallback(async (selectReportId?: string) => {
    const { data, error } = await supabase
      .from('weekly_reports')
      .select('id, week_start_date, week_end_date, sort_order')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) { toast({ title: t('weeklyReport.errorLoadingReports'), variant: 'destructive' }); setLoading(false); return; }
    setReports(data || []);
    if (selectReportId) setActiveReportId(selectReportId);
    else if (data && data.length > 0) setActiveReportId(data[0].id);
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (activeReportId) loadRows(activeReportId);
    else setRows([]);
  }, [activeReportId]);

  const loadRows = useCallback(async (reportId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('weekly_report_rows').select('*').eq('report_id', reportId).is('deleted_at', null).order('sort_order', { ascending: true });
    if (error) toast({ title: t('weeklyReport.errorLoadingRows'), variant: 'destructive' });
    setRows((data as ReportRow[]) || []);
    setLoading(false);
    setSelectedCells(new Set());
    setEditingCell(null);
    setCursorCell(null);
  }, []);

  // Auto-focus first cell after creating a new week (once rows are available)
  useEffect(() => {
    if (autoFocusFirstCellRef.current && rows.length > 0 && visibleColumns.length > 0) {
      autoFocusFirstCellRef.current = false;
      const firstRow = rows[0];
      const firstField = visibleColumns[0].field;
      const ck = cellKey(firstRow.id, firstField);
      setCursorCell(ck);
      setEditingCell(ck);
    }
  }, [rows, visibleColumns]);

  // ---- Week management (modal-based creation) ----
  // Compute next week dates from latest report
  const computeNextWeekDates = useCallback((): { start: Date; end: Date } => {
    const latestReport = reports.length > 0 ? reports[0] : null;
    if (latestReport) {
      const prevEnd = parseDate(latestReport.week_end_date);
      const nextStart = new Date(prevEnd);
      const nextEnd = addDays(nextStart, 7);
      return { start: nextStart, end: nextEnd };
    }
    // Default: find next Wednesday from today
    const today = new Date();
    const day = today.getDay();
    const daysUntilWed = (3 - day + 7) % 7 || 7;
    const nextWed = new Date(today);
    nextWed.setDate(today.getDate() - (day === 3 ? 0 : (day - 3 + 7) % 7));
    return { start: nextWed, end: addDays(nextWed, 7) };
  }, [reports]);

  const openCreateModal = useCallback(() => {
    const { start, end } = computeNextWeekDates();
    const defaultLabel = makeWeekLabel(fmt(start), fmt(end));
    setCreateWeekLabel(defaultLabel);
    setShowCreateModal(true);
  }, [computeNextWeekDates]);

  // Keep ref in sync for use in callback without re-creating it
  createWeekLabelRef.current = createWeekLabel;

  const handleCreateWeekSubmit = useCallback(async () => {
    const label = createWeekLabelRef.current.trim();
    if (!label) {
      toast({ title: t('weeklyReport.labelRequired'), variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    console.log('[WeeklyReport] CREATE WEEK via modal, label:', label);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsCreating(false); return; }

    const latestReport = reports.length > 0 ? reports[0] : null;

    // Use the computed next week dates for DB storage
    const { start: nextStart, end: nextEnd } = computeNextWeekDates();
    const startStr = fmt(nextStart);
    const endStr = fmt(nextEnd);
    console.log('[WeeklyReport] Next week dates:', startStr, endStr);

    const newSortOrder = reports.length > 0 ? Math.max(...reports.map(r => r.sort_order)) + 1 : 0;
    const { data: newWeek, error } = await supabase
      .from('weekly_reports')
      .insert({ week_start_date: startStr, week_end_date: endStr, created_by: user.id, sort_order: newSortOrder } as any)
      .select()
      .single();

    if (error) {
      console.error('[WeeklyReport] Create week error:', error);
      toast({ title: t('weeklyReport.failedToCreateWeek'), description: error.message, variant: 'destructive' });
      setIsCreating(false);
      return;
    }

    const newReport = newWeek as Report;
    let copiedRows: ReportRow[] = [];

    // Duplicate rows from latest week (1:1 clone)
    if (latestReport) {
      const { data: prevRows } = await supabase
        .from('weekly_report_rows')
        .select('*')
        .eq('report_id', latestReport.id)
        .is('deleted_at', null)
        .order('sort_order');

      if (prevRows && prevRows.length > 0) {
        const newRows = prevRows.map((r: any, i: number) => ({
          report_id: newReport.id,
          company_name: r.company_name,
          position_name: r.position_name,
          recruiter: r.recruiter,
          sort_order: r.sort_order ?? i,
          row_status: r.row_status,
          fb_applicants: r.fb_applicants,
          job_post: r.job_post,
          linkedin: r.linkedin,
          phone_screens: r.phone_screens,
          sent_to_client: r.sent_to_client,
          interviews: r.interviews,
          offers: r.offers,
          accepted: r.accepted,
          hires: r.hires,
          rejections: r.rejections,
          notes: r.notes ?? '',
        }));

        const { data: inserted } = await supabase
          .from('weekly_report_rows')
          .insert(newRows as any)
          .select();

        copiedRows = (inserted as ReportRow[]) || [];
      }
    }

    console.log('[WeeklyReport] CREATED WEEK:', newReport);
    // Refetch all weeks to ensure consistent state, select the new one
    await loadReports(newReport.id);
    autoFocusFirstCellRef.current = true;
    setShowCreateModal(false);
    setIsCreating(false);
    toast({ title: t('weeklyReport.createdLabel', { label }) });
  }, [reports]);

  const deleteWeek = useCallback(async (reportId: string) => {
    // Optimistic remove
    const deletedReport = reports.find(r => r.id === reportId);
    const deletedRows = rows.filter(r => r.report_id === reportId);
    setReports(prev => {
      const next = prev.filter(r => r.id !== reportId);
      if (activeReportId === reportId) setActiveReportId(next.length > 0 ? next[0].id : null);
      return next;
    });

    const now = new Date().toISOString();
    await supabase.from('weekly_report_rows').update({ deleted_at: now } as any).eq('report_id', reportId);
    await supabase.from('weekly_reports').update({ deleted_at: now } as any).eq('id', reportId);

    toast({
      title: t('weeklyReport.weekDeleted'),
      action: (
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={async () => {
          await supabase.from('weekly_reports').update({ deleted_at: null } as any).eq('id', reportId);
          await supabase.from('weekly_report_rows').update({ deleted_at: null } as any).eq('report_id', reportId);
          if (deletedReport) {
            setReports(prev => [deletedReport, ...prev]);
            setActiveReportId(reportId);
          }
          toast({ title: t('weeklyReport.weekRestored') });
        }}>
          {t('weeklyReport.undo')}
        </Button>
      ),
    });
  }, [activeReportId, reports, rows]);

  const handleTabDoubleClick = useCallback((report: Report) => {
    setEditingReport(report);
    setEditName(makeWeekLabel(report.week_start_date, report.week_end_date));
  }, []);

  const handleEditDateSelect = useCallback(async (date: Date | undefined) => {
    if (!date || !editingReport) return;
    const wed = getMostRecentWednesday(date);
    const startStr = fmt(wed);
    const endStr = fmt(addDays(wed, 7));
    await supabase.from('weekly_reports')
      .update({ week_start_date: startStr, week_end_date: endStr } as any).eq('id', editingReport.id);
    setReports(prev => prev.map(r =>
      r.id === editingReport.id ? { ...r, week_start_date: startStr, week_end_date: endStr } : r
    ));
    setEditingReport(prev => prev ? { ...prev, week_start_date: startStr, week_end_date: endStr } : null);
    setEditName(makeWeekLabel(startStr, endStr));
    setEditDatePickerOpen(false);
    toast({ title: t('weeklyReport.weekDateUpdated') });
  }, [editingReport]);

  const handleTabDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(reports);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((r, i) => ({ ...r, sort_order: i }));
    setReports(updated);
    for (const r of updated) {
      await supabase.from('weekly_reports').update({ sort_order: r.sort_order } as any).eq('id', r.id);
    }
  }, [reports]);

  // ---- Row/cell operations ----
  const deleteRow = useCallback(async (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
    await supabase.from('weekly_report_rows').update({ deleted_at: new Date().toISOString() } as any).eq('id', rowId);
  }, []);

  const deleteCompany = useCallback(async (companyName: string) => {
    const toDelete = rows.filter(r => (r.company_name.trim() || 'Ungrouped') === companyName);
    const ids = toDelete.map(r => r.id);
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from('weekly_report_rows').update({ deleted_at: now } as any).eq('id', id);
    }
    toast({ title: t('weeklyReport.deletedFromCompany', { count: ids.length, name: companyName }) });
  }, [rows]);

  const renameCompany = useCallback(async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setRows(prev => prev.map(r => (r.company_name.trim() || 'Ungrouped') === oldName ? { ...r, company_name: trimmed } : r));
    const toUpdate = rows.filter(r => (r.company_name.trim() || 'Ungrouped') === oldName);
    for (const row of toUpdate) {
      await supabase.from('weekly_report_rows').update({ company_name: trimmed } as any).eq('id', row.id);
    }
  }, [rows]);

  // saveField moved above (before copy/paste)

  const updateCell = useCallback((rowId: string, field: string, value: string | number | null) => {
    // Use ref to get current row state (avoids stale closure)
    const currentRow = rowsRef.current.find(r => r.id === rowId);
    if (currentRow) {
      const oldValue = currentRow[field as keyof ReportRow] as string | number | null;
      if (oldValue !== value) {
        pushUndo([{ rowId, field, oldValue, newValue: value }]);
      }
    }
    setRows(prev => {
      const updated = prev.map(r => r.id === rowId ? { ...r, [field]: value } : r);
      const row = updated.find(r => r.id === rowId);
      if (row && !row.company_name.trim() && !row.position_name.trim()) {
        supabase.from('weekly_report_rows').update({ deleted_at: new Date().toISOString() } as any).eq('id', rowId);
        return updated.filter(r => r.id !== rowId);
      }
      // Track new entries when position_name is first set
      if (row && activeReportIdRef.current && field === 'position_name' && typeof value === 'string' && value.trim()) {
        markNew(`position::${row.company_name.trim().toLowerCase()}::${value.trim().toLowerCase()}`, activeReportIdRef.current);
      }
      if (row && activeReportIdRef.current && field === 'company_name' && typeof value === 'string' && value.trim()) {
        markNew(`company::${value.trim().toLowerCase()}`, activeReportIdRef.current);
      }
      return updated;
    });
    saveField(rowId, field, value);
  }, [saveField, pushUndo, markNew]);

  const handleRowCreated = useCallback((row: ReportRow) => {
    setRows(prev => [...prev, row]);
    if (activeReportId) {
      if (row.company_name.trim()) {
        markNew(`company::${row.company_name.trim().toLowerCase()}`, activeReportId);
      }
      if (row.position_name.trim()) {
        markNew(`position::${row.company_name.trim().toLowerCase()}::${row.position_name.trim().toLowerCase()}`, activeReportId);
      }
    }
  }, [activeReportId, markNew]);

  // Import Excel
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }
    // Verify admin role server-side
    const { data: roleData } = await (supabase.from('user_roles' as any).select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle() as any);
    if (!roleData) {
      toast({ title: t('weeklyReport.importAdminOnly'), variant: 'destructive' });
      setImporting(false);
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let imported = 0;
      const dateRe = /\((\d{1,2})[\./](\d{1,2})\s*[-–]\s*(\d{1,2})[\./](\d{1,2})\)?/;
      interface SheetDate { sheetName: string; startDay: number; startMonth: number; }
      const sheetsWithDates: SheetDate[] = [];
      for (const name of workbook.SheetNames) {
        const m = name.match(dateRe);
        if (m) sheetsWithDates.push({ sheetName: name, startDay: parseInt(m[1]), startMonth: parseInt(m[2]) });
      }
      let currentYear = new Date().getFullYear();
      if (sheetsWithDates.length > 0) {
        let rollovers = 0;
        for (let i = 1; i < sheetsWithDates.length; i++) {
          if (sheetsWithDates[i].startMonth < sheetsWithDates[i - 1].startMonth) rollovers++;
        }
        currentYear -= rollovers;
      }
      const sheetYearMap = new Map<string, number>();
      for (let i = 0; i < sheetsWithDates.length; i++) {
        if (i > 0 && sheetsWithDates[i].startMonth < sheetsWithDates[i - 1].startMonth) currentYear++;
        sheetYearMap.set(sheetsWithDates[i].sheetName, currentYear);
      }
      for (const sheetName of workbook.SheetNames) {
        let wednesday: Date | null = null;
        const dm = sheetName.match(dateRe);
        if (dm) {
          const year = sheetYearMap.get(sheetName) || new Date().getFullYear();
          const startDate = new Date(year, parseInt(dm[2]) - 1, parseInt(dm[1]));
          wednesday = getMostRecentWednesday(startDate);
        }
        if (!wednesday) {
          const isoMatch = sheetName.match(/(\d{4}-\d{2}-\d{2})/);
          if (isoMatch) wednesday = getMostRecentWednesday(parseDate(isoMatch[1]));
        }
        if (!wednesday) {
          const weekMatch = sheetName.match(/week\s*\d/i);
          if (!weekMatch) continue;
          const baseWed = getMostRecentWednesday(new Date());
          wednesday = addDays(baseWed, (workbook.SheetNames.indexOf(sheetName) - workbook.SheetNames.length + 1) * 7);
        }
        const startStr = fmt(wednesday);
        const endStr = fmt(addDays(wednesday, 7));
        let reportId: string;
        const existing = reports.find(r => r.week_start_date === startStr);
        if (existing) { reportId = existing.id; }
        else {
          const { data: rep, error } = await supabase
            .from('weekly_reports').insert({ week_start_date: startStr, week_end_date: endStr, created_by: user.id, sort_order: 0 } as any).select().single();
          if (error || !rep) continue;
          reportId = rep.id;
          setReports(prev => [...prev, rep as Report]);
        }
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet);
        const isJunkValue = (v: string) => /^week\s*\d|^\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]?\d{0,4}\s*[-–]\s*\d{1,2}[\.\-\/]/i.test(v.trim());
        const getVal = (r: any, ...keys: string[]) => {
          for (const k of keys) { if (r[k] !== undefined && r[k] !== null) return r[k]; }
          return '';
        };
        const rowsToInsert = jsonRows
          .map((r: any, i: number) => {
            const company = String(getVal(r, 'Client', 'Company', 'company', 'company_name', 'Client ')).trim();
            const position = String(getVal(r, 'Position', 'position', 'position_name')).trim();
            if (!position || !company) return null;
            if (isJunkValue(company) || isJunkValue(position)) return null;
            return {
              report_id: reportId, company_name: company.slice(0, 200), position_name: position.slice(0, 200),
              recruiter: String(getVal(r, 'Recruiter', 'recruiter')).trim().slice(0, 100), sort_order: i,
              fb_applicants: parseInt(getVal(r, 'Contacted', 'Contacted ', 'FB', 'fb_applicants', 'FB Applicants', 'Facebook Applicants') || 0) || 0,
              job_post: parseInt(getVal(r, 'Job Posts Аpplicants', 'Job Post', 'job_post', 'Job Post Applicants', 'Аpplicants') || 0) || 0,
              linkedin: parseInt(getVal(r, 'Sourced candidates', 'LinkedIn', 'linkedin', 'LinkedIn Applicants') || 0) || 0,
              phone_screens: parseInt(getVal(r, 'Phone Screens', 'Phone', 'phone_screens') || 0) || 0,
              sent_to_client: parseInt(getVal(r, 'Sent to client', 'Sent to Client', 'Sent', 'sent_to_client') || 0) || 0,
              interviews: parseInt(getVal(r, 'Interviews', 'interviews') || 0) || 0,
              offers: parseInt(getVal(r, 'Offers', 'offers') || 0) || 0,
              accepted: parseInt(getVal(r, 'Accepted offers', 'Accepted', 'accepted') || 0) || 0,
              hires: parseInt(getVal(r, 'Hires', 'hires') || 0) || 0,
              rejections: parseInt(getVal(r, 'Rejections', 'rejections', 'Rej.') || 0) || 0,
              notes: String(getVal(r, 'Reason for rejected offer', 'Notes', 'notes')).trim().slice(0, 2000),
            };
          })
          .filter(Boolean);
        if (rowsToInsert.length > 0) {
          await supabase.from('weekly_report_rows').insert(rowsToInsert as any);
          imported += rowsToInsert.length;
        }
      }
      toast({ title: t('weeklyReport.importedRows', { count: imported }) });
      await loadReports();
    } catch {
      toast({ title: t('weeklyReport.importFailedMsg'), variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [reports, loadReports]);

  // Recruiter list
  const recruiterList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.recruiter.trim()) set.add(r.recruiter.trim()); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = rows;

  const persistCompanySortOnExit = useCallback(async () => {
    const reportId = activeReportIdRef.current;
    const currentRows = rowsRef.current;
    if (!reportId || currentRows.length === 0) return;

    const groupedRows = new Map<string, ReportRow[]>();
    currentRows.forEach(row => {
      const key = row.company_name.trim() || '';
      if (!key && !row.position_name.trim()) return;
      const groupName = key || 'Ungrouped';
      if (!groupedRows.has(groupName)) groupedRows.set(groupName, []);
      groupedRows.get(groupName)!.push(row);
    });

    const sortedRows = Array.from(groupedRows.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap(([, group]) => group);

    const changedRows = sortedRows.filter((row, index) => row.sort_order !== index);
    if (changedRows.length === 0) return;

    await Promise.all(
      changedRows.map((row, index) =>
        supabase
          .from('weekly_report_rows')
          .update({ sort_order: sortedRows.findIndex(sortedRow => sortedRow.id === row.id) } as any)
          .eq('id', row.id)
      )
    );
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      void persistCompanySortOnExit();
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      void persistCompanySortOnExit();
    };
  }, [persistCompanySortOnExit]);

  // Grouping (uses filteredRows)
  const groups: CompanyGroup[] = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const row of filteredRows) {
      const key = row.company_name.trim() || '';
      if (!key && !row.position_name.trim()) continue;
      const groupName = key || 'Ungrouped';
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName)!.push(row);
    }
    return Array.from(map.entries()).map(([name, rows]) => ({
      name, rows, collapsed: collapsedGroups.has(name),
    }));
  }, [filteredRows, collapsedGroups]);

  const addRowToCompany = useCallback(async (companyName: string) => {
    if (!activeReportId) return;
    const { data, error } = await supabase
      .from('weekly_report_rows')
      .insert({ report_id: activeReportId, company_name: companyName, position_name: '', sort_order: rows.length } as any)
      .select().single();
    if (error) { toast({ title: t('weeklyReport.failedToAddRow'), variant: 'destructive' }); return; }
    const newRow = data as ReportRow;
    setRows(prev => [...prev, newRow]);
    setTimeout(() => {
      const ck = cellKey(newRow.id, 'position_name');
      setCursorCell(ck);
      setSelectedCells(new Set([ck]));
      setEditingCell(ck);
    }, 50);
  }, [activeReportId, rows.length]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setEditingCell(null);
    setCursorCell(null);
  }, []);

  // Copy a full row as TSV
  const handleCopyRow = useCallback((rowId: string) => {
    const row = rowsRef.current.find(r => r.id === rowId);
    if (!row) return;
    const vals = visibleColumns.map(col => {
      const v = row[col.field as keyof ReportRow];
      return col.type === 'num' ? String(v ?? 0) : String(v ?? '');
    });
    navigator.clipboard.writeText(vals.join('\t'));
    toast({ title: t('weeklyReport.rowCopied') });
  }, [visibleColumns]);

  // Duplicate row (Ctrl+D)
  const handleCopyRowAsNew = useCallback(async (rowId: string) => {
    if (!activeReportId) return;
    const srcRow = rowsRef.current.find(r => r.id === rowId);
    if (!srcRow) return;
    const { id, created_at, ...rest } = srcRow as any;
    const { data, error } = await supabase
      .from('weekly_report_rows')
      .insert({ ...rest, report_id: activeReportId, sort_order: rows.length } as any)
      .select().single();
    if (error) { toast({ title: t('weeklyReport.failedToDuplicate'), variant: 'destructive' }); return; }
    const newRow = data as ReportRow;
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
    toast({ title: t('weeklyReport.rowDuplicated') });
  }, [activeReportId, rows.length]);

  // Bulk row actions - detect selected rows
  const selectedRowIds = useMemo(() => {
    const ids = new Set<string>();
    selectedCells.forEach(ck => ids.add(parseCellKey(ck).rowId));
    return ids;
  }, [selectedCells]);

  const bulkSetStatus = useCallback((status: string | null) => {
    const undoActions: UndoAction[] = [];
    selectedRowIds.forEach(rid => {
      const row = rowsRef.current.find(r => r.id === rid);
      if (row) {
        undoActions.push({ rowId: rid, field: 'row_status', oldValue: row.row_status, newValue: status });
      }
    });
    if (undoActions.length > 0) pushUndo(undoActions);
    setRows(prev => prev.map(r => selectedRowIds.has(r.id) ? { ...r, row_status: status } : r));
    selectedRowIds.forEach(rid => saveField(rid, 'row_status', status));
    toast({ title: t('weeklyReport.updatedRows', { count: selectedRowIds.size }) });
  }, [selectedRowIds, pushUndo, saveField]);

  const bulkDeleteRows = useCallback(async () => {
    const ids = Array.from(selectedRowIds);
    setRows(prev => prev.filter(r => !selectedRowIds.has(r.id)));
    setSelectedCells(new Set());
    setCursorCell(null);
    const now = new Date().toISOString();
    for (const id of ids) {
      await supabase.from('weekly_report_rows').update({ deleted_at: now } as any).eq('id', id);
    }
    toast({ title: t('weeklyReport.deletedRows', { count: ids.length }) });
  }, [selectedRowIds]);

  const bulkAssignRecruiter = useCallback((recruiter: string) => {
    const undoActions: UndoAction[] = [];
    selectedRowIds.forEach(rid => {
      const row = rowsRef.current.find(r => r.id === rid);
      if (row) {
        undoActions.push({ rowId: rid, field: 'recruiter', oldValue: row.recruiter, newValue: recruiter });
      }
    });
    if (undoActions.length > 0) pushUndo(undoActions);
    setRows(prev => prev.map(r => selectedRowIds.has(r.id) ? { ...r, recruiter } : r));
    selectedRowIds.forEach(rid => saveField(rid, 'recruiter', recruiter));
    toast({ title: t('weeklyReport.assignedRecruiter', { count: selectedRowIds.size }) });
  }, [selectedRowIds, pushUndo, saveField]);

  const hiddenColumnsList = useMemo(() =>
    ALL_COLUMNS.filter(c => hiddenColumns.has(c.field)),
    [hiddenColumns]
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" onClick={clearSelection}>
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
        <div className="px-2 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <img src={autoSorsaLogo} alt="Autsorsa" className="h-7 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity dark:hidden" onClick={() => navigate('/')} fetchPriority="high" />
          <img src={autoSorsaLogoDark} alt="Autsorsa" className="h-7 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity hidden dark:block" onClick={() => navigate('/')} fetchPriority="high" />
          <h1 className="text-lg font-semibold text-foreground">{t('weeklyReport.title')}</h1>
          

          {/* Admin Import - left side */}
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload className="h-3 w-3" /> {importing ? t('weeklyReport.importing') : t('common.import')}
              </Button>
            </>
          )}

          {/* Save indicator */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('weeklyReport.saving')}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check className="h-3 w-3" /> {t('weeklyReport.saved')}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">

            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={performUndo}
              disabled={undoCount === 0}
              title={t('weeklyReport.undoTooltip')}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={performRedo}
              disabled={redoCount === 0}
              title={t('weeklyReport.redoTooltip')}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            {selectedCells.size > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => bulkClearCells(selectedCells)}
              >
                {t('weeklyReport.clearCells', { count: selectedCells.size })}
              </Button>
            )}
            <UserMenu isAdmin={isAdmin} onNavigate={(view) => {
              if (view === 'settings') navigate('/settings');
              else if (view === 'myboard') navigate('/');
              else if (view === 'weekly-report') { /* already here */ }
              else if (view === 'admin') navigate('/admin');
            }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="text-muted-foreground text-sm py-12 text-center">{t('weeklyReport.loading')}</div>
        ) : !activeReportId ? (
          <div className="text-center py-16 space-y-4" onClick={e => e.stopPropagation()}>
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <div>
              <p className="text-muted-foreground text-sm font-medium">{t('weeklyReport.noReports')}</p>
              <p className="text-muted-foreground/60 text-xs mt-1">{t('weeklyReport.noReportsDesc')}</p>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Button size="sm" onClick={openCreateModal} className="gap-1.5">
                <Plus className="h-4 w-4" /> {t('weeklyReport.createFirstWeek')}
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Upload className="h-4 w-4" /> {t('weeklyReport.importExcel')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col min-h-0" onClick={e => e.stopPropagation()}>
            {/* Formula bar */}
            <div className="border-b border-border bg-card px-3 py-1.5 flex items-center gap-2 text-sm shrink-0">
              {cursorCell ? (() => {
                const { rowId, field } = parseCellKey(cursorCell);
                const row = rows.find(r => r.id === rowId);
                const col = ALL_COLUMNS.find(c => c.field === field);
                const colLabel = col ? getColumnLabel(col.field) : field;
                const rawVal = row ? (row as any)[field] ?? '' : '';
                const displayVal = col?.type === 'num' && rawVal === 0 ? '' : String(rawVal);
                return (
                  <>
                    <span className="font-semibold text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{colLabel}:</span>
                    <input
                      className="flex-1 bg-transparent outline-none text-foreground text-sm font-medium"
                      value={displayVal}
                      onChange={e => {
                        if (row && col) {
                          const newVal = col.type === 'num' ? (e.target.value === '' ? 0 : Number(e.target.value.replace(/[^\d]/g, '')) || 0) : e.target.value;
                          updateCell(rowId, field, newVal);
                        }
                      }}
                      onFocus={() => { if (editingCell !== cursorCell) handleStartEdit(rowId, field); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditingCell(null); }
                        if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); setEditingCell(null); }
                      }}
                    />
                  </>
                );
              })() : (
                <span className="text-muted-foreground/50 text-xs">{t('weeklyReport.selectCellToEdit')}</span>
              )}
            </div>
            <div className="relative flex-1 min-h-0">
              <div ref={tableRef} className="overflow-auto select-none h-full">
              <table className="text-xs border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                <thead className="sticky top-0 z-40" style={{ boxShadow: '0 2px 6px -2px rgba(0,0,0,0.1)' }}>
                  <tr>
                    <th className="w-7 px-1 py-2 bg-muted border-r border-border border-b-2 border-b-border/60 hover:bg-muted/80 transition-colors" style={{ width: 28, boxShadow: '0 2px 6px -2px rgba(0,0,0,0.1)' }} />
                    {visibleColumns.map(col => {
                      return (
                      <th
                        key={col.field}
                        className={cn(
                          'px-3 py-2 font-semibold text-foreground/80 whitespace-nowrap border-r border-border last:border-r-0 relative bg-muted border-b-2 border-b-border/60 group/colheader text-xs hover:bg-muted/80 transition-colors cursor-default',
                          col.type === 'num' ? 'text-center' : 'text-left',
                        )}
                        style={{ width: columnWidths[col.field] || col.defaultWidth, minWidth: 40 }}
                        onClick={() => {}}
                        onDoubleClick={e => handleColumnDoubleClick(col.field, e)}
                        onContextMenu={e => { e.preventDefault(); setContextMenuCol({ field: col.field, x: e.clientX, y: e.clientY }); }}
                      >
                        {editingColumnField === col.field ? (
                          <input
                            ref={columnInputRef}
                            className="w-full bg-background text-foreground text-xs font-semibold px-1 py-0.5 outline-none ring-2 ring-inset ring-primary/50 rounded-sm"
                            value={editingColumnLabel}
                            onChange={e => setEditingColumnLabel(e.target.value)}
                            onBlur={commitColumnLabel}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitColumnLabel(); }
                              if (e.key === 'Escape') { e.preventDefault(); setEditingColumnField(null); }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 whitespace-nowrap flex items-center gap-1.5">
                            {getColumnLabel(col.field)}
                            {col.field === 'company_name' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold text-primary border border-primary/30 bg-primary/10">
                                A→Z
                              </span>
                            )}
                          </span>
                        )}
                        <ResizeHandle field={col.field} setWidth={setColumnWidth} tableRef={tableRef} columns={visibleColumns} />
                      </th>
                      );
                    })}
                    {/* Add / restore column button */}
                    <th className="w-8 px-1 py-2 bg-muted border-b-2 border-b-border/60 hover:bg-muted/80 transition-colors" style={{ width: 32, boxShadow: '0 2px 6px -2px rgba(0,0,0,0.1)' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title={hiddenColumnsList.length > 0 ? t('weeklyReport.hiddenColumnsLabel') : t('weeklyReport.allColumnsVisible')}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px]">
                          {hiddenColumnsList.length > 0 ? (
                            <>
                              <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">{t('weeklyReport.hiddenColumnsLabel')}</div>
                              {hiddenColumnsList.map(col => (
                                <DropdownMenuItem key={col.field} onClick={() => showColumn(col.field)} className="text-xs gap-2">
                                  <Eye className="h-3 w-3" /> {getColumnLabel(col.field)}
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : (
                            <div className="px-2 py-2 text-[10px] text-muted-foreground">{t('weeklyReport.allColumnsVisible')}</div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(group => (
                    <GroupSection
                      key={group.name}
                      group={group}
                      columns={visibleColumns}
                      onToggle={() => toggleGroup(group.name)}
                      columnWidths={columnWidths}
                      updateCell={updateCell}
                      deleteRow={deleteRow}
                      deleteCompany={deleteCompany}
                      renameCompany={renameCompany}
                      addRowToCompany={addRowToCompany}
                      selectedCells={selectedCells}
                      editingCell={editingCell}
                      cursorCell={cursorCell}
                      onCellMouseDown={handleCellMouseDown}
                      onCellMouseEnter={handleCellMouseEnterWrapped}
                      onStartEdit={handleStartEdit}
                      onFillHandleMouseDown={handleFillHandleMouseDown}
                      onCopyRow={handleCopyRow}
                      isNewCompany={isNewForCurrentTab(`company::${group.name.trim().toLowerCase()}`)}
                      isNewPosition={(row) => row.position_name.trim() ? isNewForCurrentTab(`position::${row.company_name.trim().toLowerCase()}::${row.position_name.trim().toLowerCase()}`) : false}
                    />
                  ))}
                  {activeReportId && (
                    <NewRowInput
                      activeReportId={activeReportId}
                      rowCount={rows.length}
                      onRowCreated={handleRowCreated}
                      columnWidths={columnWidths}
                      columns={visibleColumns}
                    />
                  )}
                </tbody>
              </table>
              </div>
              <div className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-background to-transparent z-10" />
              <div className="pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-background to-transparent z-10" />
            </div>

            {/* Column context menu */}
            {contextMenuCol && (
              <div
                className="fixed z-50 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]"
                style={{ left: contextMenuCol.x, top: contextMenuCol.y }}
                onClick={() => setContextMenuCol(null)}
                onMouseLeave={() => setContextMenuCol(null)}
              >
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  onClick={() => { handleColumnDoubleClick(contextMenuCol.field, { preventDefault: () => {}, stopPropagation: () => {} } as any); setContextMenuCol(null); }}
                >
                  {t('weeklyReport.renameColumn')}
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={() => { hideColumn(contextMenuCol.field); setContextMenuCol(null); }}
                >
                  <EyeOff className="h-3 w-3" /> {t('weeklyReport.hideColumnAction')}
                </button>
              </div>
            )}

            {/* Floating summary + bulk actions bar */}
            {selectedCells.size > 0 && (() => {
              const nums: number[] = [];
              selectedCells.forEach(ck => {
                const { rowId, field } = parseCellKey(ck);
                const col = visibleColumns.find(c => c.field === field);
                if (!col || col.type !== 'num') return;
                const row = rows.find(r => r.id === rowId);
                if (!row) return;
                const v = Number(row[field as keyof ReportRow]) || 0;
                if (v !== 0) nums.push(v);
              });
              const sum = nums.reduce((a, b) => a + b, 0);
              const avg = nums.length > 0 ? (sum / nums.length).toFixed(1) : '0';
              const showStats = nums.length > 0;
              const showBulk = selectedRowIds.size > 1;
              if (!showStats && !showBulk) return null;
              return (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-card border border-border shadow-lg rounded-lg px-4 py-2 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  {showStats && (
                    <>
                      <span className="text-xs font-medium tabular-nums text-foreground">{t('weeklyReport.sum')}: {sum}</span>
                      <span className="w-px h-3 bg-border" />
                      <span className="text-xs font-medium tabular-nums text-foreground">{t('weeklyReport.avg')}: {avg}</span>
                      <span className="w-px h-3 bg-border" />
                      <span className="text-xs font-medium tabular-nums text-foreground">{t('weeklyReport.count')}: {nums.length}</span>
                    </>
                  )}
                  {showBulk && showStats && <span className="w-px h-3 bg-border" />}
                  {showBulk && (
                    <>
                      <span className="text-xs font-medium text-muted-foreground">{t('weeklyReport.rowsCount', { count: selectedRowIds.size })}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">{t('weeklyReport.markAs')}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {ROW_STATUS_OPTIONS.map(opt => (
                            <DropdownMenuItem key={String(opt.value)} onClick={() => bulkSetStatus(opt.value as string | null)} className={cn('text-xs gap-2', opt.color)}>
                              <span className={cn('inline-block w-2 h-2 rounded-full', opt.dot)} />
                              {t(opt.labelKey)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">{t('weeklyReport.assignRecruiterAction')}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {recruiterList.map(r => (
                            <DropdownMenuItem key={r} onClick={() => bulkAssignRecruiter(r)} className="text-xs">{r}</DropdownMenuItem>
                          ))}
                          {recruiterList.length === 0 && (
                            <div className="px-2 py-1 text-[10px] text-muted-foreground">{t('weeklyReport.noRecruiters')}</div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="destructive" size="sm" className="h-6 text-[10px] gap-1" onClick={bulkDeleteRows}>
                        <Trash2 className="h-3 w-3" /> {t('common.delete')}
                      </Button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom tabs (Excel-style) */}
      <DragDropContext onDragEnd={handleTabDragEnd}>
        <Droppable droppableId="week-tabs" direction="horizontal">
          {(provided) => (
            <div className="h-10 border-t border-border bg-muted/30 flex items-center gap-0 px-1 shrink-0">
              <button
                onClick={openCreateModal}
                className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded"
                title={t('weeklyReport.createNextWeek')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => scrollTabs('left')}
                className="px-1 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded"
                title={t('weeklyReport.scrollLeft')}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div
                ref={(el) => {
                  provided.innerRef(el);
                  (tabScrollRef as any).current = el;
                }}
                {...provided.droppableProps}
                className="flex items-center gap-0.5 overflow-x-auto flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {reports.map((r, index) => (
                  <Draggable key={r.id} draggableId={r.id} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        data-tab-id={r.id}
                        className={cn("relative group/tab shrink-0", snapshot.isDragging && "z-30")}
                        onMouseEnter={() => setHoveredTab(r.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                      >
                        <button
                            onClick={() => setActiveReportId(r.id)}
                            onDoubleClick={(e) => { e.preventDefault(); handleTabDoubleClick(r); }}
                            className={cn(
                              'flex items-center gap-1 px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors rounded-t border border-b-0 pr-6',
                              r.id === activeReportId
                                ? 'bg-background text-foreground border-border'
                                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent',
                              snapshot.isDragging && 'shadow-lg rounded bg-background border border-border'
                            )}
                          >
                            <span {...dragProvided.dragHandleProps} className="opacity-0 group-hover/tab:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing -ml-1 mr-0.5">
                              <GripVertical className="h-3 w-3" />
                            </span>
                            {makeWeekLabel(r.week_start_date, r.week_end_date)}
                          </button>
                        {hoveredTab === r.id && confirmDeleteTabId !== r.id && (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteTabId(r.id); }}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t('weeklyReport.deleteWeekAction')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {confirmDeleteTabId === r.id && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-background border border-border rounded-md shadow-md px-1.5 py-0.5 z-50" onClick={e => e.stopPropagation()}>
                            <span className="text-[10px] text-destructive font-medium whitespace-nowrap">{t('common.delete')}?</span>
                            <button onClick={() => { deleteWeek(r.id); setConfirmDeleteTabId(null); }} className="text-[10px] font-medium text-destructive hover:underline">{t('common.yes')}</button>
                            <span className="text-[10px] text-muted-foreground">/</span>
                            <button onClick={() => setConfirmDeleteTabId(null)} className="text-[10px] text-muted-foreground hover:underline">{t('common.no')}</button>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>

              <button
                onClick={() => scrollTabs('right')}
                className="px-1 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded"
                title={t('weeklyReport.scrollRight')}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create Week modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) setShowCreateModal(false); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('weeklyReport.createWeek')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">{t('weeklyReport.weekLabel')}</Label>
              <Input
                ref={(el) => { if (el && !el.dataset.initialized) { el.dataset.initialized = 'true'; requestAnimationFrame(() => { el.focus(); el.select(); }); } }}
                value={createWeekLabel}
                onChange={e => setCreateWeekLabel(e.target.value)}
                className="h-8 text-xs"
                placeholder={t('weeklyReport.weekLabelPlaceholder')}
                onKeyDown={e => { if (e.key === 'Enter' && !isCreating && createWeekLabel.trim()) handleCreateWeekSubmit(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleCreateWeekSubmit} disabled={isCreating || !createWeekLabel.trim()} className="gap-1.5">
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit week dialog */}
      <Dialog open={!!editingReport} onOpenChange={(open) => { if (!open) { setEditingReport(null); setEditDatePickerOpen(false); } }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('weeklyReport.editWeek')}</DialogTitle>
          </DialogHeader>
          {editingReport && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">{t('weeklyReport.weekLabel')}</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-xs" readOnly />
                <p className="text-[10px] text-muted-foreground">{t('weeklyReport.labelAutoGenerated')}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => { setEditingReport(null); setEditDatePickerOpen(false); }}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
