import React, { useState, useEffect, useCallback, useRef, useMemo, memo, useTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Trash2, Upload, FileSpreadsheet, X, GripVertical, Undo2, Redo2, Eye, EyeOff, Copy, Loader2, ExternalLink, MoreVertical, Bold, Italic, Underline, Paintbrush, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as XLSX from 'xlsx';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useAuth } from '@/context/AuthContext';
import { UserMenu } from '@/components/UserMenu';
import { useLanguage } from '@/context/LanguageContext';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';

// ---------- types ----------
interface Sheet {
  id: string;
  name: string;
  sort_order: number;
}

type EditableField = 'company' | 'position' | 'business_category' | 'company_size' | 'country' | 'hq_country' |
  'website_url' | 'jobs_bg_url' | 'linkedin_url' | 'phone' | 'email' | 'company_address' |
  'contact_date_1' | 'contact_date_2' | 'contact_date_3' | 'linkedin_contact' | 'answer' |
  'comments' | 'notes' | 'contact_name' | 'offer' | 'offer_comment' | 'language' | 'salary' | 'special_conditions';

type Lead = { id: string; sort_order: number; [key: string]: any };

interface UndoAction { rowId: string; field: string; oldValue: string; newValue: string }

interface ColumnDef {
  field: EditableField;
  labelKey: string;
  type: 'text' | 'url' | 'answer';
  defaultWidth: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { field: 'company', labelKey: 'sales.company', type: 'text', defaultWidth: 200 },
  { field: 'position', labelKey: 'sales.position', type: 'text', defaultWidth: 200 },
  { field: 'business_category', labelKey: 'sales.businessCategory', type: 'text', defaultWidth: 160 },
  { field: 'company_size', labelKey: 'sales.companySize', type: 'text', defaultWidth: 120 },
  { field: 'country', labelKey: 'sales.country', type: 'text', defaultWidth: 110 },
  { field: 'hq_country', labelKey: 'sales.hqCountry', type: 'text', defaultWidth: 110 },
  { field: 'website_url', labelKey: 'sales.websiteUrl', type: 'url', defaultWidth: 140 },
  { field: 'jobs_bg_url', labelKey: 'sales.jobsBgUrl', type: 'url', defaultWidth: 120 },
  { field: 'linkedin_url', labelKey: 'sales.linkedinUrl', type: 'url', defaultWidth: 120 },
  { field: 'phone', labelKey: 'sales.phone', type: 'text', defaultWidth: 130 },
  { field: 'email', labelKey: 'sales.email', type: 'text', defaultWidth: 180 },
  { field: 'company_address', labelKey: 'sales.companyAddress', type: 'text', defaultWidth: 180 },
  { field: 'contact_date_1', labelKey: 'sales.contactDate1', type: 'text', defaultWidth: 110 },
  { field: 'contact_date_2', labelKey: 'sales.contactDate2', type: 'text', defaultWidth: 110 },
  { field: 'contact_date_3', labelKey: 'sales.contactDate3', type: 'text', defaultWidth: 110 },
  { field: 'linkedin_contact', labelKey: 'sales.linkedinContact', type: 'text', defaultWidth: 200 },
  { field: 'answer', labelKey: 'sales.answer', type: 'answer', defaultWidth: 110 },
  { field: 'comments', labelKey: 'sales.comments', type: 'text', defaultWidth: 250 },
  { field: 'notes', labelKey: 'sales.notes', type: 'text', defaultWidth: 250 },
  { field: 'contact_name', labelKey: 'sales.contactName', type: 'text', defaultWidth: 150 },
  { field: 'offer', labelKey: 'sales.offer', type: 'text', defaultWidth: 90 },
  { field: 'offer_comment', labelKey: 'sales.offerComment', type: 'text', defaultWidth: 180 },
  { field: 'language', labelKey: 'sales.language', type: 'text', defaultWidth: 90 },
  { field: 'salary', labelKey: 'sales.salary', type: 'text', defaultWidth: 110 },
  { field: 'special_conditions', labelKey: 'sales.specialConditions', type: 'text', defaultWidth: 180 },
];

// ---------- Column & Row colors (hex-based for guaranteed rendering) ----------
const COLUMN_COLORS = [
  { id: 'default', label: 'Default', headerHex: '', bodyHex: '', swatch: '' },
  { id: 'blue', label: 'Blue', headerHex: '#2563eb', bodyHex: '#bfdbfe', swatch: '#2563eb' },
  { id: 'red', label: 'Red', headerHex: '#dc2626', bodyHex: '#fecaca', swatch: '#dc2626' },
  { id: 'green', label: 'Green', headerHex: '#16a34a', bodyHex: '#bbf7d0', swatch: '#16a34a' },
  { id: 'orange', label: 'Orange', headerHex: '#ea580c', bodyHex: '#fed7aa', swatch: '#ea580c' },
  { id: 'purple', label: 'Purple', headerHex: '#9333ea', bodyHex: '#d8b4fe', swatch: '#9333ea' },
  { id: 'teal', label: 'Teal', headerHex: '#0d9488', bodyHex: '#99f6e4', swatch: '#0d9488' },
];

interface RowStyle {
  color?: string; // color id from COLUMN_COLORS
}

interface ColumnStyle {
  color?: string; // color id
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface CellStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// ---------- helpers ----------
function cellKey(rowId: string, field: string) { return `${rowId}::${field}`; }
function parseCellKey(key: string) {
  const idx = key.indexOf('::');
  return { rowId: key.slice(0, idx), field: key.slice(idx + 2) };
}

function getAnswerColor(answer: string): string {
  const lower = (answer || '').toLowerCase().trim();
  if (lower === 'да' || lower === 'yes') return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  if (lower === 'не' || lower === 'no') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  if (lower === 'без отговор' || lower === 'no answer') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
  return '';
}

// ---------- Column widths ----------
function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('sales-col-widths');
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    const defaults: Record<string, number> = {};
    ALL_COLUMNS.forEach(c => { defaults[c.field] = c.defaultWidth; });
    return defaults;
  });

  const setWidth = useCallback((field: string, width: number) => {
    setWidths(prev => {
      const next = { ...prev, [field]: Math.max(40, width) };
      localStorage.setItem('sales-col-widths', JSON.stringify(next));
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
    let maxW = ctx.measureText(col.labelKey).width + 24;
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
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-foreground/30 z-10"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    />
  );
}

// ---------- Spreadsheet Cell ----------
const SpreadsheetCell = memo(function SpreadsheetCell({
  rowId, field, value, type, width, isSelected, isEditing, isCursor,
  onChange, onCommit, onMouseDown, onMouseEnter, onStartEdit, onFillHandleMouseDown,
  colStyle, rowBgHex, cellStyle, editValue, onCancelEdit,
}: {
  rowId: string; field: string; value: string; type: ColumnDef['type']; width: number;
  isSelected: boolean; isEditing: boolean; isCursor: boolean;
  onChange: (val: string) => void;
  onCommit: (rowId: string, field: string) => void;
  onCancelEdit?: () => void;
  onMouseDown: (rowId: string, field: string, e: React.MouseEvent) => void;
  onMouseEnter: (rowId: string, field: string) => void;
  onStartEdit: (rowId: string, field: string) => void;
  onFillHandleMouseDown?: (rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => void;
  colStyle?: ColumnStyle;
  rowBgHex?: string;
  cellStyle?: CellStyle;
  editValue?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Merge: cell style overrides column style
  const effectiveBold = cellStyle?.bold ?? colStyle?.bold;
  const effectiveItalic = cellStyle?.italic ?? colStyle?.italic;
  const effectiveUnderline = cellStyle?.underline ?? colStyle?.underline;
  const effectiveColorId = cellStyle?.color ?? colStyle?.color ?? 'default';

  const answerColor = type === 'answer' ? getAnswerColor(value) : '';
  const isUrl = type === 'url' && value && (value.startsWith('http') || value.startsWith('www'));

  // Determine background: answer color > column color > row color
  const colColorDef = COLUMN_COLORS.find(c => c.id === effectiveColorId);
  const bodyHex = colColorDef?.bodyHex || '';
  const cellBgHex = answerColor ? '' : (bodyHex || rowBgHex || '');

  if (isEditing) {
    return (
      <td
        className="px-0 py-0 border-r border-border outline outline-2 outline-primary bg-background z-[3]"
        style={{ width, minWidth: width, maxWidth: width }}
      >
        <input
          ref={inputRef}
          className={cn("w-full h-full px-2 py-1 bg-background outline-none text-[13px] text-left",
            effectiveBold && 'font-bold',
            effectiveItalic && 'italic',
            effectiveUnderline && 'underline',
          )}
          value={editValue ?? value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onCommit(rowId, field)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              onCommit(rowId, field);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancelEdit?.();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        'px-0 py-0 border-r border-border last:border-r-0 relative cursor-default text-left',
        isCursor && 'outline outline-2 outline-primary ring-0 z-[3]',
        isSelected && !isCursor && 'bg-primary/8 ring-1 ring-inset ring-primary/25',
        answerColor,
      )}
      style={{ width, minWidth: width, maxWidth: width, backgroundColor: cellBgHex || undefined }}
      onMouseDown={e => onMouseDown(rowId, field, e)}
      onMouseEnter={() => onMouseEnter(rowId, field)}
      onDoubleClick={() => onStartEdit(rowId, field)}
    >
      <div className={cn(
        'w-full px-2 py-1 text-[13px] h-[28px] cursor-text overflow-hidden whitespace-nowrap text-ellipsis',
        field === 'company' && 'font-semibold text-foreground',
        field === 'position' && 'font-medium text-foreground/90',
        !value && 'text-muted-foreground/20',
        'text-foreground',
        effectiveBold && 'font-bold',
        effectiveItalic && 'italic',
        effectiveUnderline && 'underline',
      )}>
        {isUrl ? (
          <a
            href={value.startsWith('http') ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline truncate flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate">{(() => { try { return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace('www.', ''); } catch { return value; } })()}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          value || '\u00A0'
        )}
      </div>
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

// ---------- Data Row ----------
const DataRow = memo(function DataRow({
  row, columns, columnWidths, selectedFields, editingField, cursorField, isActiveRow,
  onCellMouseDown, onCellMouseEnter, onStartEdit, onFillHandleMouseDown,
  onCopyRow, onDelete, updateCell, columnStyles, rowStyle, onSetRowColor,
  onCommit, draftCellKey, draftValue, onDraftChange, onCancelEdit,
  cellStyles, rowId,
}: {
  row: Lead; columns: ColumnDef[]; columnWidths: Record<string, number>;
  selectedFields: Set<string>; editingField: string | null; cursorField: string | null; isActiveRow: boolean;
  onCellMouseDown: (rowId: string, field: string, e: React.MouseEvent) => void;
  onCellMouseEnter: (rowId: string, field: string) => void;
  onStartEdit: (rowId: string, field: string) => void;
  onFillHandleMouseDown: (rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => void;
  onCopyRow: (rowId: string) => void;
  onDelete: (rowId: string) => void;
  updateCell: (rowId: string, field: string, value: string) => void;
  onCommit: (rowId: string, field: string) => void;
  draftCellKey: string | null;
  draftValue: string;
  onDraftChange: (key: string, value: string) => void;
  onCancelEdit: () => void;
  columnStyles: Record<string, ColumnStyle>;
  rowStyle?: RowStyle;
  onSetRowColor: (rowId: string, colorId: string) => void;
  cellStyles: Record<string, CellStyle>;
  rowId: string;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useLanguage();
  const rowColorDef = COLUMN_COLORS.find(c => c.id === (rowStyle?.color || 'default'));
  const rowBgHex = rowColorDef?.bodyHex || '';

  return (
    <tr
      className={cn('group border-b border-border transition-colors wr-data-row', isActiveRow && 'bg-primary/5')}
      style={{ height: 33 }}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <td className="w-7 px-0 py-0 border-r border-border text-center bg-card">
        <div className="flex items-center justify-center gap-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground p-0.5" tabIndex={-1} title="Row options">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]" onClick={e => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onCopyRow(row.id)} className="text-xs gap-2">
                <Copy className="h-3 w-3" /> {t('sales.copyRow')}
              </DropdownMenuItem>
              <div className="h-px bg-border my-1" />
              <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Paintbrush className="h-3 w-3" /> Row Color
              </div>
              <div className="px-2 pb-2 grid grid-cols-4 gap-1">
                {COLUMN_COLORS.map(c => (
                  <button
                    key={c.id}
                    className={cn(
                      "w-5 h-5 rounded-sm border border-border transition-all hover:scale-110",
                      c.id === 'default' ? 'bg-background' : '',
                      (rowStyle?.color || 'default') === c.id && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                    )}
                    style={{ backgroundColor: c.swatch || undefined }}
                    title={c.label}
                    onClick={(e) => { e.stopPropagation(); onSetRowColor(row.id, c.id); }}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      {columns.map(col => (
        (() => {
          const ck = cellKey(row.id, col.field);
          const isCellEditing = editingField === col.field;
          return (
          <SpreadsheetCell
            key={col.field}
            rowId={row.id}
            field={col.field}
            value={row[col.field] || ''}
            editValue={isCellEditing && draftCellKey === ck ? draftValue : (row[col.field] || '')}
            type={col.type}
            width={columnWidths[col.field] || col.defaultWidth}
            isSelected={selectedFields.has(col.field)}
            isEditing={isCellEditing}
            isCursor={cursorField === col.field}
            onChange={val => onDraftChange(ck, val)}
            onCommit={onCommit}
            onCancelEdit={onCancelEdit}
            onMouseDown={onCellMouseDown}
            onMouseEnter={onCellMouseEnter}
            onStartEdit={onStartEdit}
            onFillHandleMouseDown={onFillHandleMouseDown}
            colStyle={columnStyles[col.field]}
            rowBgHex={rowBgHex}
            cellStyle={cellStyles[cellKey(rowId, col.field)]}
          />
          );
        })()
      ))}
      <td className="w-8 px-1 text-center border-l border-border">
        <div className="flex items-center gap-0">
          {confirmDelete ? (
            <span className="flex items-center gap-0.5">
              <button onClick={() => onDelete(row.id)} className="text-[10px] font-medium text-destructive hover:underline" tabIndex={-1}>{t('common.yes')}</button>
              <span className="text-[10px] text-muted-foreground">/</span>
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-muted-foreground hover:underline" tabIndex={-1}>{t('common.no')}</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5" tabIndex={-1} title={t('sales.deleteRow')}>
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

// ---------- Formula Bar (local state, commits on blur) ----------
function FormulaBar({ cursorCell, draftValue, onDraftChange, onCommitDraft, getColumnLabel, selectedCells, cellStyles, setCellStyleForSelection, t }: {
  cursorCell: string | null;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onCommitDraft: () => void;
  getColumnLabel: (field: string) => string;
  selectedCells: Set<string>;
  cellStyles: Record<string, CellStyle>;
  setCellStyleForSelection: (update: Partial<CellStyle>) => void;
  t: (key: string) => string;
}) {
  const parsed = cursorCell ? parseCellKey(cursorCell) : null;
  // Show style of cursor cell
  const cs = cursorCell ? (cellStyles[cursorCell] || {}) : {};

  return (
    <div className="border-b border-border bg-card px-3 py-1.5 flex items-center gap-2 text-sm shrink-0">
      {cursorCell && parsed ? (
        <>
          <span className="font-semibold text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{getColumnLabel(parsed.field)}:</span>
          <input
            className="flex-1 bg-transparent outline-none text-foreground text-sm font-medium"
            value={draftValue}
            onChange={e => onDraftChange(e.target.value)}
            onBlur={onCommitDraft}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') { e.preventDefault(); onCommitDraft(); (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
            }}
          />
        </>
      ) : (
        <span className="text-muted-foreground/50 text-xs">{t('sales.selectCellToEdit')}</span>
      )}
      {/* Formatting buttons */}
      {cursorCell && selectedCells.size > 0 && (
        <div className="flex items-center gap-0.5 border-l border-border pl-2 ml-auto shrink-0">
          <button
            className={cn("w-7 h-7 flex items-center justify-center rounded border text-xs font-bold transition-colors",
              cs.bold ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent")}
            title="Bold"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setCellStyleForSelection({ bold: !cs.bold })}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            className={cn("w-7 h-7 flex items-center justify-center rounded border text-xs transition-colors",
              cs.italic ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent")}
            title="Italic"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setCellStyleForSelection({ italic: !cs.italic })}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            className={cn("w-7 h-7 flex items-center justify-center rounded border text-xs transition-colors",
              cs.underline ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:bg-accent")}
            title="Underline"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setCellStyleForSelection({ underline: !cs.underline })}
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn("w-7 h-7 flex items-center justify-center rounded border text-xs transition-colors",
                  cs.color && cs.color !== 'default' ? "border-primary" : "bg-background text-foreground border-border hover:bg-accent")}
                title="Cell Color"
                onMouseDown={e => e.preventDefault()}
              >
                <Paintbrush className="h-3.5 w-3.5" style={{ color: COLUMN_COLORS.find(c => c.id === (cs.color || 'default'))?.swatch || undefined }} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end" sideOffset={4}>
              <div className="grid grid-cols-4 gap-1">
                {COLUMN_COLORS.map(c => (
                  <button
                    key={c.id}
                    className={cn(
                      "w-6 h-6 rounded-sm border border-border transition-all hover:scale-110",
                      c.id === 'default' ? 'bg-background' : '',
                      (cs.color || 'default') === c.id && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                    )}
                    style={{ backgroundColor: c.swatch || undefined }}
                    title={c.label}
                    onClick={() => setCellStyleForSelection({ color: c.id })}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export default function Sales() {
  const navigate = useNavigate();
  const { user, isAdmin, isSales } = useAuth();
  const { t } = useLanguage();
  const hasAccess = isAdmin || isSales;

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Selection — use refs for hot-path reads, state only for triggering renders
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cursorCell, setCursorCell] = useState<string | null>(null);
  const [draftCellKey, setDraftCellKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<string | null>(null);

  // Keep refs in sync for use in event handlers without re-creating callbacks
  const selectedCellsRef = useRef(selectedCells);
  selectedCellsRef.current = selectedCells;
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const cursorCellRef = useRef(cursorCell);
  cursorCellRef.current = cursorCell;
  const draftCellKeyRef = useRef(draftCellKey);
  draftCellKeyRef.current = draftCellKey;
  const draftValueRef = useRef(draftValue);
  draftValueRef.current = draftValue;
  const commitDraftRef = useRef<() => void>(() => {});

  // Save indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavesRef = useRef(0);

  // Fill handle
  const isFillDraggingRef = useRef(false);
  const autoFillRef = useRef<{ rowId: string; field: string } | null>(null);
  const fillStartCellRef = useRef<string | null>(null);
  const [fillRange, setFillRange] = useState<Set<string>>(new Set());

  const { widths: columnWidths, setWidth: setColumnWidth } = useColumnWidths();

  // Hidden columns
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sales-hidden-cols');
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* noop */ }
    return new Set();
  });
  const visibleColumns = useMemo(() => ALL_COLUMNS.filter(c => !hiddenColumns.has(c.field)), [hiddenColumns]);
  const visibleColumnsRef = useRef(visibleColumns);
  visibleColumnsRef.current = visibleColumns;
  const hiddenColumnsList = useMemo(() => ALL_COLUMNS.filter(c => hiddenColumns.has(c.field)), [hiddenColumns]);

  const hideColumn = useCallback((field: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev); next.add(field);
      localStorage.setItem('sales-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  }, []);
  const showColumn = useCallback((field: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev); next.delete(field);
      localStorage.setItem('sales-hidden-cols', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Column labels (renameable)
  const [columnLabels, setColumnLabels] = useState<Record<string, string>>(() => {
    try { const saved = localStorage.getItem('sales-col-labels'); if (saved) return JSON.parse(saved); } catch {} return {};
  });
  const [editingColumnField, setEditingColumnField] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');

  // Column styles (color, bold, italic, underline) — per sheet
  const [allColumnStyles, setAllColumnStyles] = useState<Record<string, Record<string, ColumnStyle>>>(() => {
    try { const saved = localStorage.getItem('sales-col-styles-v2'); if (saved) return JSON.parse(saved); } catch {} return {};
  });
  const columnStyles = useMemo(() => (activeSheetId ? allColumnStyles[activeSheetId] || {} : {}), [allColumnStyles, activeSheetId]);

  const setColumnStyle = useCallback((field: string, update: Partial<ColumnStyle>) => {
    if (!activeSheetId) return;
    setAllColumnStyles(prev => {
      const sheetStyles = prev[activeSheetId] || {};
      const next = { ...prev, [activeSheetId]: { ...sheetStyles, [field]: { ...(sheetStyles[field] || {}), ...update } } };
      localStorage.setItem('sales-col-styles-v2', JSON.stringify(next));
      return next;
    });
  }, [activeSheetId]);

  // Cell styles (per cell, per sheet)
  const [allCellStyles, setAllCellStyles] = useState<Record<string, Record<string, CellStyle>>>(() => {
    try { const saved = localStorage.getItem('sales-cell-styles'); if (saved) return JSON.parse(saved); } catch {} return {};
  });
  const cellStyles = useMemo(() => (activeSheetId ? allCellStyles[activeSheetId] || {} : {}), [allCellStyles, activeSheetId]);

  const setCellStyleForSelection = useCallback((update: Partial<CellStyle>) => {
    if (!activeSheetId) return;
    const cells = selectedCellsRef.current;
    if (cells.size === 0) return;
    setAllCellStyles(prev => {
      const sheetStyles = { ...(prev[activeSheetId] || {}) };
      cells.forEach(ck => {
        sheetStyles[ck] = { ...(sheetStyles[ck] || {}), ...update };
      });
      const next = { ...prev, [activeSheetId]: sheetStyles };
      localStorage.setItem('sales-cell-styles', JSON.stringify(next));
      return next;
    });
  }, [activeSheetId]);

  // Row styles (color per row) — per sheet
  const [allRowStyles, setAllRowStyles] = useState<Record<string, Record<string, RowStyle>>>(() => {
    try { const saved = localStorage.getItem('sales-row-styles-v2'); if (saved) return JSON.parse(saved); } catch {} return {};
  });
  const rowStyles = useMemo(() => (activeSheetId ? allRowStyles[activeSheetId] || {} : {}), [allRowStyles, activeSheetId]);

  const setRowColor = useCallback((rowId: string, colorId: string) => {
    if (!activeSheetId) return;
    setAllRowStyles(prev => {
      const sheetStyles = prev[activeSheetId] || {};
      const next = { ...prev, [activeSheetId]: { ...sheetStyles, [rowId]: { ...(sheetStyles[rowId] || {}), color: colorId } } };
      localStorage.setItem('sales-row-styles-v2', JSON.stringify(next));
      return next;
    });
  }, [activeSheetId]);

  const getColumnLabel = useCallback((field: string) => {
    return columnLabels[field] || t(ALL_COLUMNS.find(c => c.field === field)?.labelKey || field);
  }, [columnLabels, t]);

  const handleColumnDoubleClick = useCallback((field: string, e: React.MouseEvent | { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault(); e.stopPropagation();
    setEditingColumnField(field);
    setEditingColumnLabel(getColumnLabel(field));
  }, [getColumnLabel]);

  const commitColumnLabel = useCallback(() => {
    if (!editingColumnField) return;
    const trimmed = editingColumnLabel.trim();
    if (trimmed) {
      setColumnLabels(prev => {
        const next = { ...prev, [editingColumnField]: trimmed };
        localStorage.setItem('sales-col-labels', JSON.stringify(next));
        return next;
      });
    }
    setEditingColumnField(null);
  }, [editingColumnField, editingColumnLabel]);

  // Undo/redo
  const undoStack = useRef<UndoAction[][]>([]);
  const redoStack = useRef<UndoAction[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const MAX_UNDO = 50;

  // Fast row lookup map
  const rowsRef = useRef<Lead[]>([]);
  const rowMapRef = useRef<Map<string, Lead>>(new Map());
  const leadsCache = useRef<Map<string, Lead[]>>(new Map());

  useEffect(() => {
    rowsRef.current = leads;
    const map = new Map<string, Lead>();
    for (const r of leads) map.set(r.id, r);
    rowMapRef.current = map;
    if (activeSheetId) leadsCache.current.set(activeSheetId, leads);
  }, [leads, activeSheetId]);

  const pushUndo = useCallback((actions: UndoAction[]) => {
    undoStack.current.push(actions);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  // Sheet dialogs
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');

  const tableRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const flatRowIds = useMemo(() => leads.map(r => r.id), [leads]);
  const flatRowIdsRef = useRef(flatRowIds);
  flatRowIdsRef.current = flatRowIds;

  // ---- Save field (debounced) ----
  const saveField = useCallback((rowId: string, field: string, value: string | null) => {
    const key = `${rowId}-${field}`;
    const existing = saveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    pendingSavesRef.current++;
    setSaveStatus('saving');
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    saveTimers.current.set(key, setTimeout(async () => {
      try {
        await (supabase.from('sales_leads' as any).update({ [field]: value, updated_at: new Date().toISOString(), updated_by: user?.id } as any).eq('id', rowId) as any);
      } catch (e) {
        console.error('Save failed', e);
      } finally {
        saveTimers.current.delete(key);
        pendingSavesRef.current--;
        if (pendingSavesRef.current <= 0) {
          pendingSavesRef.current = 0;
          setSaveStatus('saved');
          saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
        }
      }
    }, 300));
  }, [user]);

  // ---- Cell range calculation ----
  const getCellRange = useCallback((startKey: string, endKey: string): Set<string> => {
    const s = parseCellKey(startKey);
    const e = parseCellKey(endKey);
    const ids = flatRowIdsRef.current;
    const cols = visibleColumnsRef.current;
    const rowStart = ids.indexOf(s.rowId);
    const rowEnd = ids.indexOf(e.rowId);
    const colStart = cols.findIndex(c => c.field === s.field);
    const colEnd = cols.findIndex(c => c.field === e.field);
    if (rowStart === -1 || rowEnd === -1 || colStart === -1 || colEnd === -1) return new Set();
    const rLo = Math.min(rowStart, rowEnd), rHi = Math.max(rowStart, rowEnd);
    const cLo = Math.min(colStart, colEnd), cHi = Math.max(colStart, colEnd);
    const result = new Set<string>();
    for (let r = rLo; r <= rHi; r++) {
      for (let c = cLo; c <= cHi; c++) {
        result.add(cellKey(ids[r], cols[c].field));
      }
    }
    return result;
  }, []); // stable — reads from refs

  const hydrateDraft = useCallback((key: string | null) => {
    if (!key) {
      setDraftCellKey(null);
      setDraftValue('');
      return;
    }
    const { rowId, field } = parseCellKey(key);
    const row = rowMapRef.current.get(rowId);
    setDraftCellKey(key);
    setDraftValue(row ? (row[field as EditableField] || '') : '');
  }, []);

  const persistCellValue = useCallback((rowId: string, field: string, value: string) => {
    const currentRow = rowMapRef.current.get(rowId);
    if (currentRow) {
      const oldValue = currentRow[field as EditableField] || '';
      if (oldValue !== value) {
        pushUndo([{ rowId, field, oldValue, newValue: value }]);
      }
    }
    setLeads(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
    saveField(rowId, field, value);
  }, [pushUndo, saveField]);

  const commitDraft = useCallback(() => {
    const key = draftCellKeyRef.current;
    if (!key) return;
    const { rowId, field } = parseCellKey(key);
    const currentRow = rowMapRef.current.get(rowId);
    const oldValue = currentRow ? (currentRow[field as EditableField] || '') : '';
    const nextValue = draftValueRef.current;
    if (oldValue !== nextValue) {
      persistCellValue(rowId, field, nextValue);
    }
  }, [persistCellValue]);
  commitDraftRef.current = commitDraft;

  const updateDraft = useCallback((key: string, value: string) => {
    if (draftCellKeyRef.current !== key) setDraftCellKey(key);
    setDraftValue(value);
  }, []);

  // ---- Mouse handlers (stable callbacks — read from refs) ----
  const handleCellMouseDown = useCallback((rowId: string, field: string, e: React.MouseEvent) => {
    const ck = cellKey(rowId, field);
    if (editingCellRef.current === ck) return;
    if (draftCellKeyRef.current && draftCellKeyRef.current !== ck) commitDraftRef.current();
    setEditingCell(null);
    isDraggingRef.current = true;
    dragStartCellRef.current = ck;
    if (e.shiftKey && cursorCellRef.current) {
      setSelectedCells(getCellRange(cursorCellRef.current, ck));
    } else {
      setSelectedCells(new Set([ck]));
    }
    setCursorCell(ck);
    hydrateDraft(ck);
  }, [getCellRange, hydrateDraft]);

  const handleCellMouseEnterWrapped = useCallback((rowId: string, field: string) => {
    if (isFillDraggingRef.current && fillStartCellRef.current) {
      const { field: srcField } = parseCellKey(fillStartCellRef.current);
      const ids = flatRowIdsRef.current;
      const startIdx = ids.indexOf(parseCellKey(fillStartCellRef.current).rowId);
      const endIdx = ids.indexOf(rowId);
      if (startIdx === -1 || endIdx === -1) return;
      const lo = Math.min(startIdx, endIdx), hi = Math.max(startIdx, endIdx);
      const range = new Set<string>();
      for (let i = lo; i <= hi; i++) range.add(cellKey(ids[i], srcField));
      setFillRange(range);
      return;
    }
    if (!isDraggingRef.current || !dragStartCellRef.current) return;
    const ck = cellKey(rowId, field);
    setSelectedCells(getCellRange(dragStartCellRef.current, ck));
  }, [getCellRange]);

  // Mouse up - complete fill drag
  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
      if (isFillDraggingRef.current && fillStartCellRef.current && fillRange.size > 0) {
        isFillDraggingRef.current = false;
        const { rowId: srcRowId, field: srcField } = parseCellKey(fillStartCellRef.current);
        const srcRow = rowMapRef.current.get(srcRowId);
        if (srcRow) {
          const srcValue = srcRow[srcField as EditableField] || '';
          const undoActions: UndoAction[] = [];
          const updates: { rowId: string; field: string; value: string }[] = [];
          fillRange.forEach(ck => {
            if (ck === fillStartCellRef.current) return;
            const { rowId, field } = parseCellKey(ck);
            const currentRow = rowMapRef.current.get(rowId);
            const oldVal = currentRow ? (currentRow[field as EditableField] || '') : '';
            undoActions.push({ rowId, field, oldValue: oldVal, newValue: srcValue });
            updates.push({ rowId, field, value: srcValue });
          });
          if (undoActions.length > 0) pushUndo(undoActions);
          setLeads(prev => {
            const next = [...prev];
            for (const u of updates) {
              const idx = next.findIndex(r => r.id === u.rowId);
              if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
            }
            return next;
          });
          for (const u of updates) saveField(u.rowId, u.field, u.value);
          toast({ title: t('sales.filledCells', { count: String(updates.length) }) });
        }
        setFillRange(new Set());
        fillStartCellRef.current = null;
      }
      isFillDraggingRef.current = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [fillRange, pushUndo, saveField, t]);

  const handleFillHandleMouseDown = useCallback((rowId: string, field: string, e: React.MouseEvent, autoFill?: boolean) => {
    e.preventDefault();
    if (autoFill) {
      // Process auto-fill synchronously instead of via a render-triggering effect
      const srcRow = rowMapRef.current.get(rowId);
      if (!srcRow) return;
      const srcValue = srcRow[field as EditableField] || '';
      const ids = flatRowIdsRef.current;
      const startIdx = ids.indexOf(rowId);
      if (startIdx === -1) return;
      const undoActions: UndoAction[] = [];
      const updates: { rId: string; f: string; v: string }[] = [];
      for (let i = startIdx + 1; i < ids.length; i++) {
        const r = rowMapRef.current.get(ids[i]);
        if (!r) break;
        const oldVal = r[field as EditableField] || '';
        undoActions.push({ rowId: ids[i], field, oldValue: oldVal, newValue: srcValue });
        updates.push({ rId: ids[i], f: field, v: srcValue });
      }
      if (undoActions.length > 0) pushUndo(undoActions);
      setLeads(prev => {
        const next = [...prev];
        for (const u of updates) {
          const idx = next.findIndex(r => r.id === u.rId);
          if (idx !== -1) next[idx] = { ...next[idx], [u.f]: u.v };
        }
        return next;
      });
      for (const u of updates) saveField(u.rId, u.f, u.v);
      if (updates.length > 0) toast({ title: t('sales.filledCells', { count: String(updates.length) }) });
      return;
    }
    isFillDraggingRef.current = true;
    fillStartCellRef.current = cellKey(rowId, field);
    setFillRange(new Set([cellKey(rowId, field)]));
  }, [pushUndo, saveField, t]);

  const handleStartEdit = useCallback((rowId: string, field: string) => {
    const ck = cellKey(rowId, field);
    hydrateDraft(ck);
    setEditingCell(ck);
    setCursorCell(ck);
    setSelectedCells(new Set([ck]));
  }, [hydrateDraft]);

  const handleCommitEdit = useCallback((_rowId: string, _field: string) => {
    commitDraftRef.current();
    setEditingCell(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    const key = editingCellRef.current;
    if (key) hydrateDraft(key);
    setEditingCell(null);
  }, [hydrateDraft]);

  // ---- Update cell ----
  const updateCell = persistCellValue;

  // ---- Copy / Paste ----
  const handleCopy = useCallback(() => {
    const sc = selectedCellsRef.current;
    if (sc.size === 0) return;
    const cells = Array.from(sc).map(ck => parseCellKey(ck));
    const ids = flatRowIdsRef.current;
    const cols = visibleColumnsRef.current;
    const rowIds = [...new Set(cells.map(c => c.rowId))];
    const fields = [...new Set(cells.map(c => c.field))];
    rowIds.sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
    fields.sort((a, b) => cols.findIndex(c => c.field === a) - cols.findIndex(c => c.field === b));
    const tsvRows = rowIds.map(rid => fields.map(f => {
      if (!sc.has(cellKey(rid, f))) return '';
      const row = rowMapRef.current.get(rid);
      return row ? (row[f as EditableField] || '') : '';
    }).join('\t'));
    navigator.clipboard.writeText(tsvRows.join('\n')).then(() => {
      toast({ title: t('sales.copiedCells', { count: String(sc.size) }) });
    });
  }, [t]);

  const handlePaste = useCallback(async () => {
    const cc = cursorCellRef.current;
    if (!cc) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const { rowId, field } = parseCellKey(cc);
      const ids = flatRowIdsRef.current;
      const cols = visibleColumnsRef.current;
      const startRowIdx = ids.indexOf(rowId);
      const startColIdx = cols.findIndex(c => c.field === field);
      if (startRowIdx === -1 || startColIdx === -1) return;
      const pasteRows = text.split('\n').map(line => line.split('\t'));
      const undoActions: UndoAction[] = [];
      const updates: { rowId: string; field: string; value: string }[] = [];
      for (let r = 0; r < pasteRows.length; r++) {
        const ri = startRowIdx + r;
        if (ri >= ids.length) break;
        for (let c = 0; c < pasteRows[r].length; c++) {
          const ci = startColIdx + c;
          if (ci >= cols.length) break;
          const targetRowId = ids[ri];
          const targetField = cols[ci].field;
          const newVal = pasteRows[r][c];
          const currentRow = rowMapRef.current.get(targetRowId);
          const oldVal = currentRow ? (currentRow[targetField] || '') : '';
          undoActions.push({ rowId: targetRowId, field: targetField, oldValue: oldVal, newValue: newVal });
          updates.push({ rowId: targetRowId, field: targetField, value: newVal });
        }
      }
      if (undoActions.length > 0) pushUndo(undoActions);
      setLeads(prev => {
        const next = [...prev];
        for (const u of updates) {
          const idx = next.findIndex(row => row.id === u.rowId);
          if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
        }
        return next;
      });
      for (const u of updates) saveField(u.rowId, u.field, u.value);
      toast({ title: t('sales.pastedCells', { count: String(updates.length) }) });
    } catch {
      toast({ title: t('sales.pasteFailed'), variant: 'destructive' });
    }
  }, [pushUndo, saveField, t]);

  // Bulk clear
  const bulkClearCells = useCallback((cells: Set<string>) => {
    const updates: { rowId: string; field: string; value: string }[] = [];
    const undoActions: UndoAction[] = [];
    cells.forEach(ck => {
      const { rowId, field } = parseCellKey(ck);
      const currentRow = rowMapRef.current.get(rowId);
      const oldVal = currentRow ? (currentRow[field as EditableField] || '') : '';
      updates.push({ rowId, field, value: '' });
      undoActions.push({ rowId, field, oldValue: oldVal, newValue: '' });
    });
    if (undoActions.length > 0) pushUndo(undoActions);
    setLeads(prev => {
      const next = [...prev];
      for (const u of updates) {
        const idx = next.findIndex(r => r.id === u.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [u.field]: u.value };
      }
      return next;
    });
    for (const u of updates) saveField(u.rowId, u.field, u.value);
    toast({ title: t('sales.clearedCells', { count: String(updates.length) }) });
    setSelectedCells(new Set());
  }, [pushUndo, saveField, t]);

  // ---- Undo/Redo (stable — read from refs) ----
  const performUndo = useCallback(() => {
    const batch = undoStack.current.pop();
    if (!batch) return;
    setUndoCount(undoStack.current.length);
    setEditingCell(null);
    setLeads(prev => {
      const next = [...prev];
      for (const a of batch) {
        const idx = next.findIndex(r => r.id === a.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [a.field]: a.oldValue };
      }
      return next;
    });
    for (const a of batch) saveField(a.rowId, a.field, a.oldValue);
    redoStack.current.push(batch);
    setRedoCount(redoStack.current.length);
  }, [saveField]);

  const performRedo = useCallback(() => {
    const batch = redoStack.current.pop();
    if (!batch) return;
    setRedoCount(redoStack.current.length);
    setEditingCell(null);
    setLeads(prev => {
      const next = [...prev];
      for (const a of batch) {
        const idx = next.findIndex(r => r.id === a.rowId);
        if (idx !== -1) next[idx] = { ...next[idx], [a.field]: a.newValue };
      }
      return next;
    });
    for (const a of batch) saveField(a.rowId, a.field, a.newValue);
    undoStack.current.push(batch);
    setUndoCount(undoStack.current.length);
  }, [saveField]);

  // ---- Keyboard navigation (STABLE — reads from refs, no deps on changing state) ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Undo/Redo
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

      const ec = editingCellRef.current;
      if (isInput && ec) {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          commitDraftRef.current();
          target.blur();
          const { rowId, field } = parseCellKey(ec);
          const ids = flatRowIdsRef.current;
          const cols = visibleColumnsRef.current;
          const rowIdx = ids.indexOf(rowId);
          const colIdx = cols.findIndex(c => c.field === field);
          let nextRow = rowIdx, nextCol = colIdx;
          if (e.key === 'Tab') {
            if (e.shiftKey) nextCol--; else nextCol++;
            if (nextCol >= cols.length) { nextCol = 0; nextRow++; }
            if (nextCol < 0) { nextCol = cols.length - 1; nextRow--; }
          } else { nextRow++; }
          if (nextRow >= 0 && nextRow < ids.length && nextCol >= 0 && nextCol < cols.length) {
            const nk = cellKey(ids[nextRow], cols[nextCol].field);
            setCursorCell(nk);
            setSelectedCells(new Set([nk]));
            hydrateDraft(nk);
            setEditingCell(nk);
          } else setEditingCell(null);
          return;
        }
        if (e.key === 'Escape') { e.preventDefault(); target.blur(); setEditingCell(null); return; }
        return;
      }
      if (isInput) return;

      const sc = selectedCellsRef.current;
      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && sc.size > 0) { e.preventDefault(); handleCopy(); return; }
      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); handlePaste(); return; }
      // Bulk clear
      if ((e.key === 'Delete' || e.key === 'Backspace') && sc.size > 0) { e.preventDefault(); bulkClearCells(sc); return; }

      const cc = cursorCellRef.current;
      // Ctrl+D duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && cc) { e.preventDefault(); handleDuplicateRow(parseCellKey(cc).rowId); return; }

      if (!cc) return;
      const { rowId, field } = parseCellKey(cc);
      const ids = flatRowIdsRef.current;
      const cols = visibleColumnsRef.current;
      const rowIdx = ids.indexOf(rowId);
      const colIdx = cols.findIndex(c => c.field === field);
      if (rowIdx === -1 || colIdx === -1) return;

      let nextRow = rowIdx, nextCol = colIdx;

      // Ctrl+Arrow jump
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
        e.preventDefault();
        for (let i = rowIdx + 1; i < ids.length; i++) {
          const r = rowMapRef.current.get(ids[i]);
          if (r && r[field as EditableField]) { nextRow = i; break; }
          if (i === ids.length - 1) nextRow = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
        e.preventDefault();
        for (let i = rowIdx - 1; i >= 0; i--) {
          const r = rowMapRef.current.get(ids[i]);
          if (r && r[field as EditableField]) { nextRow = i; break; }
          if (i === 0) nextRow = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        const row = rowMapRef.current.get(rowId);
        for (let i = colIdx + 1; i < cols.length; i++) {
          if (row && row[cols[i].field]) { nextCol = i; break; }
          if (i === cols.length - 1) nextCol = i;
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        const row = rowMapRef.current.get(rowId);
        for (let i = colIdx - 1; i >= 0; i--) {
          if (row && row[cols[i].field]) { nextCol = i; break; }
          if (i === 0) nextCol = i;
        }
      } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); nextCol++; }
      else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); nextCol--; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nextRow++; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); nextRow--; }
      else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); hydrateDraft(cc); setEditingCell(cc); return; }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        updateDraft(cc, e.key);
        setEditingCell(cc);
        return;
      }
      else return;

      if (nextCol >= cols.length) { nextCol = 0; nextRow++; }
      if (nextCol < 0) { nextCol = cols.length - 1; nextRow--; }
      if (nextRow < 0 || nextRow >= ids.length) return;

      const nk = cellKey(ids[nextRow], cols[nextCol].field);
      if (draftCellKeyRef.current && draftCellKeyRef.current !== nk) commitDraftRef.current();
      setCursorCell(nk);
      hydrateDraft(nk);
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        setSelectedCells(prev => { const next = new Set(prev); next.add(nk); return next; });
      } else {
        setSelectedCells(new Set([nk]));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [performUndo, performRedo, handleCopy, handlePaste, bulkClearCells, hydrateDraft, updateDraft]); // stable deps only

  useEffect(() => {
    if (!cursorCell) {
      if (draftCellKeyRef.current) {
        setDraftCellKey(null);
        setDraftValue('');
      }
      return;
    }
    if (draftCellKeyRef.current !== cursorCell) {
      hydrateDraft(cursorCell);
      return;
    }
    if (!editingCellRef.current) {
      const { rowId, field } = parseCellKey(cursorCell);
      const row = rowMapRef.current.get(rowId);
      const nextValue = row ? (row[field as EditableField] || '') : '';
      if (nextValue !== draftValueRef.current) setDraftValue(nextValue);
    }
  }, [cursorCell, leads, hydrateDraft]);

  // ---- Load data ----
  const loadSheets = useCallback(async () => {
    const { data } = await (supabase.from('sales_sheets' as any).select('*').is('deleted_at', null).order('sort_order', { ascending: true }) as any);
    if (data) {
      setSheets(data);
      if (!activeSheetId && data.length > 0) setActiveSheetId(data[0].id);
    }
    setLoading(false);
  }, [activeSheetId]);

  const loadLeads = useCallback(async (sheetId: string) => {
    const cached = leadsCache.current.get(sheetId);
    if (cached) { setLeads(cached); }
    // Fetch all rows (bypass 1000-row default limit)
    let allRows: Lead[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await (supabase.from('sales_leads' as any).select('*').eq('sheet_id', sheetId).is('deleted_at', null).order('sort_order', { ascending: true }).range(from, from + PAGE - 1) as any);
      const chunk = data || [];
      allRows = allRows.concat(chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
    leadsCache.current.set(sheetId, allRows);
    setLeads(allRows);
  }, []);

  useEffect(() => { loadSheets(); }, []);
  useEffect(() => {
    if (activeSheetId) {
      commitDraftRef.current();
      setSelectedCells(new Set()); setEditingCell(null); setCursorCell(null); setDraftCellKey(null); setDraftValue('');
      loadLeads(activeSheetId);
    } else {
      setLeads([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetId]);

  // ---- Row operations ----
  const addRow = useCallback(async () => {
    if (!activeSheetId || !user) return;
    const { data, error } = await (supabase.from('sales_leads' as any).insert({
      sheet_id: activeSheetId, sort_order: Date.now(), created_by: user.id,
    }).select('*').single() as any);
    if (error) { toast({ title: t('sales.failedToAddRow'), variant: 'destructive' }); return; }
    setLeads(prev => [...prev, data]);
    setTimeout(() => {
      const ck = cellKey(data.id, 'company');
      setCursorCell(ck); setSelectedCells(new Set([ck])); setEditingCell(ck);
    }, 50);
  }, [activeSheetId, user, t]);

  const deleteRow = useCallback(async (rowId: string) => {
    setLeads(prev => prev.filter(r => r.id !== rowId));
    setSelectedCells(prev => new Set([...prev].filter(ck => parseCellKey(ck).rowId !== rowId)));
    if (cursorCellRef.current && parseCellKey(cursorCellRef.current).rowId === rowId) {
      setCursorCell(null);
      setEditingCell(null);
      setDraftCellKey(null);
      setDraftValue('');
    }
    await (supabase.from('sales_leads' as any).update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq('id', rowId) as any);
  }, [user]);

  const handleDuplicateRow = useCallback(async (rowId: string) => {
    if (!activeSheetId || !user) return;
    const srcRow = rowMapRef.current.get(rowId);
    if (!srcRow) return;
    const { id, sort_order, ...rest } = srcRow;
    const { data, error } = await (supabase.from('sales_leads' as any).insert({
      ...rest, sheet_id: activeSheetId, sort_order: Date.now(), created_by: user.id,
    }).select('*').single() as any);
    if (error) { toast({ title: t('sales.failedToDuplicate'), variant: 'destructive' }); return; }
    setLeads(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      const next = [...prev]; next.splice(idx + 1, 0, data); return next;
    });
    toast({ title: t('sales.rowDuplicated') });
  }, [activeSheetId, user, t]);

  const handleCopyRow = useCallback((rowId: string) => {
    const row = rowMapRef.current.get(rowId);
    if (!row) return;
    const cols = visibleColumnsRef.current;
    const vals = cols.map(col => row[col.field] || '');
    navigator.clipboard.writeText(vals.join('\t'));
    toast({ title: t('sales.rowCopied') });
  }, [t]);

  // ---- Sheet operations ----
  const handleCreateSheet = useCallback(async () => {
    if (!user || !newSheetName.trim()) return;
    const { data, error } = await (supabase.from('sales_sheets' as any).insert({
      name: newSheetName.trim(), sort_order: Date.now(), created_by: user.id,
    }).select('*').single() as any);
    if (error) { toast({ title: t('sales.failedToCreateSheet'), variant: 'destructive' }); return; }
    setSheets(prev => [...prev, data]);
    setActiveSheetId(data.id);
    setCreateSheetOpen(false);
    setNewSheetName('');
  }, [user, newSheetName, t]);

  const deleteSheet = useCallback(async (sheetId: string) => {
    const deletedSheet = sheets.find(s => s.id === sheetId);
    setSheets(prev => {
      const next = prev.filter(s => s.id !== sheetId);
      if (activeSheetId === sheetId) setActiveSheetId(next.length > 0 ? next[0].id : null);
      return next;
    });
    await (supabase.from('sales_sheets' as any).update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq('id', sheetId) as any);
    toast({
      title: t('sales.sheetDeleted'),
      action: (
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={async () => {
          await (supabase.from('sales_sheets' as any).update({ deleted_at: null } as any).eq('id', sheetId) as any);
          if (deletedSheet) {
            setSheets(prev => [...prev, deletedSheet]);
            setActiveSheetId(sheetId);
          }
          toast({ title: t('sales.sheetRestored') });
        }}>
          {t('common.undo')}
        </Button>
      ),
    });
  }, [activeSheetId, sheets, user, t]);

  const handleTabDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(sheets);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const updated = reordered.map((r, i) => ({ ...r, sort_order: i }));
    setSheets(updated);
    for (const r of updated) {
      await (supabase.from('sales_sheets' as any).update({ sort_order: r.sort_order, updated_at: new Date().toISOString() } as any).eq('id', r.id) as any);
    }
  }, [sheets]);

  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    if (!tabScrollRef.current) return;
    tabScrollRef.current.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  // ---- Import Excel ----
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let imported = 0;
      for (const sheetName of workbook.SheetNames) {
        let sheetId: string;
        const existingSheet = sheets.find(s => s.name === sheetName);
        if (existingSheet) { sheetId = existingSheet.id; }
        else {
          const { data: newSheet, error } = await (supabase.from('sales_sheets' as any).insert({
            name: sheetName, sort_order: Date.now(), created_by: user.id,
          }).select().single() as any);
          if (error || !newSheet) continue;
          sheetId = newSheet.id;
          setSheets(prev => [...prev, newSheet as Sheet]);
        }
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet);
        const getVal = (r: any, ...keys: string[]) => {
          for (const k of keys) { if (r[k] !== undefined && r[k] !== null) return String(r[k]).trim(); }
          return '';
        };
        const rowsToInsert = jsonRows.map((r: any, i: number) => {
          const company = getVal(r, 'Company', 'Компания', 'f', 'company');
          if (!company) return null;
          return {
            sheet_id: sheetId, sort_order: i, created_by: user.id,
            company, position: getVal(r, 'Позиция', 'Position', 'position'),
            business_category: getVal(r, 'Business Category', 'business_category'),
            company_size: getVal(r, 'Company Size (amount of employees)', 'company_size'),
            country: getVal(r, 'Country', 'country'),
            hq_country: getVal(r, 'HQ Country', 'hq_country'),
            website_url: getVal(r, 'Website URL', 'Уебсайт', 'website_url'),
            jobs_bg_url: getVal(r, 'Jobs BG', 'jobs_bg_url'),
            linkedin_url: getVal(r, 'LinkedIn', 'linkedin_url'),
            phone: getVal(r, 'Phone Number', 'Телефон', 'phone'),
            email: getVal(r, 'Email', 'email'),
            company_address: getVal(r, 'Company  Address', 'Company Address', 'company_address'),
            contact_date_1: getVal(r, 'Contact 1', '1-ви имейл ', 'contact_date_1'),
            contact_date_2: getVal(r, 'Contact 2', '2-ри имейл ', 'contact_date_2'),
            contact_date_3: getVal(r, 'Contact 3', '3-ти имейл', 'contact_date_3'),
            linkedin_contact: getVal(r, 'LinkedIn contact', 'LinkedIn контакт', 'linkedin_contact'),
            answer: getVal(r, 'Answer', 'Отговор', 'answer'),
            comments: getVal(r, 'Comments', 'Коментар', 'comments'),
            notes: getVal(r, 'Notes', 'Бележки', 'notes'),
            contact_name: getVal(r, 'Име', 'Contact Name', 'contact_name'),
            offer: getVal(r, 'Оферта Да/Не', 'Offer', 'offer'),
            offer_comment: getVal(r, 'Коментар 2', 'Offer Comment', 'offer_comment'),
            language: getVal(r, 'Език', 'Language', 'language'),
            salary: getVal(r, 'Заплата', 'Salary', 'salary'),
            special_conditions: getVal(r, 'По-спец.условия', 'Special Conditions', 'special_conditions'),
          };
        }).filter(Boolean);
        if (rowsToInsert.length > 0) {
          await (supabase.from('sales_leads' as any).insert(rowsToInsert as any) as any);
          imported += rowsToInsert.length;
        }
      }
      toast({ title: t('sales.importedRows', { count: String(imported) }) });
      await loadSheets();
      if (sheets.length === 0 && imported > 0) {
        const { data } = await (supabase.from('sales_sheets' as any).select('*').is('deleted_at', null).order('sort_order').limit(1) as any);
        if (data?.[0]) setActiveSheetId(data[0].id);
      }
    } catch {
      toast({ title: t('sales.importFailed'), variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [user, sheets, loadSheets, t]);

  // ---- Export Excel ----
  const handleExport = useCallback(() => {
    if (!leads.length) return;
    const activeSheet = sheets.find(s => s.id === activeSheetId);
    const wb = XLSX.utils.book_new();
    const data = leads.map(row => {
      const obj: Record<string, string> = {};
      ALL_COLUMNS.forEach(col => { obj[getColumnLabel(col.field)] = row[col.field] || ''; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, activeSheet?.name || 'Sheet1');
    XLSX.writeFile(wb, `${activeSheet?.name || 'sales'}.xlsx`);
  }, [leads, sheets, activeSheetId, getColumnLabel]);

  // Bulk delete
  const selectedRowIds = useMemo(() => {
    const ids = new Set<string>();
    selectedCells.forEach(ck => ids.add(parseCellKey(ck).rowId));
    return ids;
  }, [selectedCells]);

  const bulkDeleteRows = useCallback(async () => {
    const ids = [...selectedRowIds];
    setLeads(prev => prev.filter(r => !selectedRowIds.has(r.id)));
    setEditingCell(null);
    if (cursorCellRef.current && selectedRowIds.has(parseCellKey(cursorCellRef.current).rowId)) {
      setCursorCell(null);
      setDraftCellKey(null);
      setDraftValue('');
    }
    const now = new Date().toISOString();
    for (const id of ids) {
      await (supabase.from('sales_leads' as any).update({ deleted_at: now, deleted_by: user?.id } as any).eq('id', id) as any);
    }
    setSelectedCells(new Set());
    toast({ title: t('sales.deletedRows', { count: String(ids.length) }) });
  }, [selectedRowIds, user, t]);

  // Pre-compute per-row props to avoid recomputation in render loop
  // ---- Row virtualization (computed FIRST so rowPropsMap can use it) ----
  const ROW_HEIGHT = 33;
  const OVERSCAN = 10;
  const scrollTopRef = useRef(0);
  const [scrollTick, setScrollTick] = useState(0);
  const rafRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const handleScroll = () => {
      scrollTopRef.current = el.scrollTop;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          setScrollTick(t => t + 1);
        });
      }
    };
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setViewportHeight(entry.contentRect.height);
    });
    el.addEventListener('scroll', handleScroll, { passive: true });
    ro.observe(el);
    return () => { el.removeEventListener('scroll', handleScroll); ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [activeSheetId]);

  const totalRows = leads.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tick = scrollTick; // subscribe to updates
  const st = scrollTopRef.current;
  const startIdx = Math.max(0, Math.floor(st / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(totalRows, Math.ceil((st + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleLeads = useMemo(() => leads.slice(startIdx, endIdx), [leads, startIdx, endIdx]);
  const topSpacerHeight = startIdx * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIdx) * ROW_HEIGHT);

  // Pre-compute per-row props ONLY for visible rows
  const rowPropsMap = useMemo(() => {
    const cursorParsed = cursorCell ? parseCellKey(cursorCell) : null;
    const editingParsed = editingCell ? parseCellKey(editingCell) : null;

    const selectedByRow = new Map<string, Set<string>>();
    selectedCells.forEach(ck => {
      const { rowId, field } = parseCellKey(ck);
      let set = selectedByRow.get(rowId);
      if (!set) { set = new Set(); selectedByRow.set(rowId, set); }
      set.add(field);
    });

    const emptySet = new Set<string>();
    const map = new Map<string, { selectedFields: Set<string>; editingField: string | null; cursorField: string | null; isActiveRow: boolean }>();
    for (const row of visibleLeads) {
      const rid = row.id;
      const isActive = cursorParsed?.rowId === rid;
      map.set(rid, {
        selectedFields: selectedByRow.get(rid) || emptySet,
        editingField: editingParsed?.rowId === rid ? editingParsed.field : null,
        cursorField: isActive ? cursorParsed!.field : null,
        isActiveRow: isActive,
      });
    }
    return map;
  }, [visibleLeads, selectedCells, editingCell, cursorCell]);

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Clear selection on background click
  const handleBackgroundClick = useCallback(() => {
    commitDraftRef.current();
    setSelectedCells(new Set());
    setEditingCell(null);
    setCursorCell(null);
    setDraftCellKey(null);
    setDraftValue('');
  }, []);

  // ========== RENDER ==========
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" onClick={handleBackgroundClick}>
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card flex items-center px-4 h-12 gap-3" onClick={stopProp}>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <img src={autoSorsaLogo} alt="Autsorsa" className="h-7 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity dark:hidden" onClick={() => navigate('/')} fetchPriority="high" />
        <img src={autoSorsaLogoDark} alt="Autsorsa" className="h-7 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity hidden dark:block" onClick={() => navigate('/')} fetchPriority="high" />
        <h1 className="text-sm font-semibold text-foreground truncate">{t('sales.title')}</h1>
        

        {/* Save indicator */}
        <span className={cn('text-[10px] font-medium transition-opacity', saveStatus === 'idle' ? 'opacity-0' : 'opacity-100', saveStatus === 'saving' ? 'text-yellow-600' : 'text-green-600')}>
          {saveStatus === 'saving' ? t('sales.saving') : saveStatus === 'saved' ? t('sales.saved') : ''}
        </span>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={performUndo} disabled={undoCount === 0} title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={performRedo} disabled={redoCount === 0} title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </Button>

        {/* Import / Export (admin only) */}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        {isAdmin && (
          <>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {t('sales.import')}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport} disabled={leads.length === 0}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> {t('sales.export')}
            </Button>
          </>
        )}

        <UserMenu isAdmin={isAdmin} onNavigate={(v) => {
          if (v === 'weekly-report') navigate('/weekly-report');
          else navigate('/');
        }} />
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4" onClick={stopProp}>
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">{t('sales.noSheets')}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('sales.createFirstSheet')}</p>
            <div className="flex items-center gap-2">
              <Button onClick={() => setCreateSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> {t('sales.newSheet')}
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> {t('sales.import')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col min-h-0" onClick={stopProp}>
            {/* Formula bar */}
            <FormulaBar
              cursorCell={cursorCell}
              draftValue={draftCellKey === cursorCell ? draftValue : ''}
              onDraftChange={(value) => {
                if (!cursorCell) return;
                updateDraft(cursorCell, value);
              }}
              onCommitDraft={commitDraft}
              getColumnLabel={getColumnLabel}
              selectedCells={selectedCells}
              cellStyles={cellStyles}
              setCellStyleForSelection={setCellStyleForSelection}
              t={t}
            />



            {/* Grid */}
            <div className="relative flex-1 min-h-0">
              <div ref={tableRef} className="overflow-auto select-none h-full">
                <table className="text-xs border-collapse w-full" style={{ tableLayout: 'fixed' }}>
                  <thead className="sticky top-0 z-40" style={{ boxShadow: '0 2px 6px -2px rgba(0,0,0,0.1)' }}>
                    <tr>
                      <th className="w-7 px-1 py-2 bg-primary border-r border-primary-foreground/20 border-b-2 border-b-primary/80" style={{ width: 28 }} />
                      {visibleColumns.map(col => {
                        const colColor = columnStyles[col.field]?.color || 'default';
                        const colorDef = COLUMN_COLORS.find(c => c.id === colColor);
                        const headerHex = colorDef?.headerHex || '';
                        const colBold = columnStyles[col.field]?.bold;
                        const colItalic = columnStyles[col.field]?.italic;
                        return (
                        <th
                          key={col.field}
                          className={cn(
                            "group/col px-2 py-2 font-semibold text-white whitespace-nowrap border-r border-white/20 last:border-r-0 relative border-b-2 border-b-black/10 text-xs text-left transition-colors cursor-default select-none",
                            !headerHex && 'bg-primary',
                          )}
                          style={{ width: columnWidths[col.field] || col.defaultWidth, minWidth: 40, backgroundColor: headerHex || undefined }}
                          onDoubleClick={e => handleColumnDoubleClick(col.field, e)}
                        >
                          {editingColumnField === col.field ? (
                            <input
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
                            <div className="flex items-center gap-1 pr-4">
                              <span className={cn("flex-1 whitespace-nowrap", colBold && 'font-bold', colItalic && 'italic')}>
                                {getColumnLabel(col.field)}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded hover:bg-white/20 transition-all shrink-0"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-[180px]" onClick={e => e.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => handleColumnDoubleClick(col.field, { preventDefault: () => {}, stopPropagation: () => {} })} className="text-xs gap-2">
                                    <Pencil className="h-3 w-3" /> {t('sales.renameColumn')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => hideColumn(col.field)} className="text-xs gap-2 text-destructive">
                                    <EyeOff className="h-3 w-3" /> {t('sales.hideColumn')}
                                  </DropdownMenuItem>
                                  <div className="h-px bg-border my-1" />
                                  <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                    <Paintbrush className="h-3 w-3" /> Column Color
                                  </div>
                                  <div className="px-2 pb-2 grid grid-cols-4 gap-1">
                                    {COLUMN_COLORS.map(c => (
                                      <button
                                        key={c.id}
                                        className={cn(
                                          "w-5 h-5 rounded-sm border border-border transition-all hover:scale-110",
                                          c.id === 'default' ? 'bg-background' : '',
                                          colColor === c.id && 'ring-2 ring-foreground ring-offset-1 ring-offset-background',
                                        )}
                                        style={{ backgroundColor: c.swatch || undefined }}
                                        title={c.label}
                                        onClick={(e) => { e.stopPropagation(); setColumnStyle(col.field, { color: c.id }); }}
                                      />
                                    ))}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                          <ResizeHandle field={col.field} setWidth={setColumnWidth} tableRef={tableRef} columns={visibleColumns} />
                        </th>
                        );
                      })}
                      <th className="w-8 px-1 py-2 bg-primary border-b-2 border-b-primary/80" style={{ width: 32 }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 text-primary-foreground/70 hover:text-primary-foreground transition-colors" title={hiddenColumnsList.length > 0 ? t('sales.hiddenColumns') : t('sales.allColumnsVisible')}>
                              <Plus className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[160px] max-h-80 overflow-y-auto">
                            {hiddenColumnsList.length > 0 ? (
                              <>
                                <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium">{t('sales.hiddenColumns')}</div>
                                {hiddenColumnsList.map(col => (
                                  <DropdownMenuItem key={col.field} onClick={() => showColumn(col.field)} className="text-xs gap-2">
                                    <Eye className="h-3 w-3" /> {getColumnLabel(col.field)}
                                  </DropdownMenuItem>
                                ))}
                              </>
                            ) : (
                              <div className="px-2 py-2 text-[10px] text-muted-foreground">{t('sales.allColumnsVisible')}</div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSpacerHeight > 0 && (
                      <tr style={{ height: topSpacerHeight }}><td colSpan={visibleColumns.length + 2} /></tr>
                    )}
                    {visibleLeads.map(row => {
                      const props = rowPropsMap.get(row.id);
                      return (
                        <DataRow
                          key={row.id}
                          row={row}
                          columns={visibleColumns}
                          columnWidths={columnWidths}
                          selectedFields={props?.selectedFields || new Set()}
                          editingField={props?.editingField ?? null}
                          cursorField={props?.cursorField ?? null}
                          isActiveRow={props?.isActiveRow ?? false}
                          onCellMouseDown={handleCellMouseDown}
                          onCellMouseEnter={handleCellMouseEnterWrapped}
                          onStartEdit={handleStartEdit}
                          onFillHandleMouseDown={handleFillHandleMouseDown}
                          onCopyRow={handleCopyRow}
                          onDelete={deleteRow}
                          updateCell={updateCell}
                          onCommit={handleCommitEdit}
                          draftCellKey={draftCellKey}
                          draftValue={draftValue}
                          onDraftChange={updateDraft}
                          onCancelEdit={handleCancelEdit}
                          columnStyles={columnStyles}
                          rowStyle={rowStyles[row.id]}
                          onSetRowColor={setRowColor}
                          cellStyles={cellStyles}
                          rowId={row.id}
                        />
                      );
                    })}
                    {bottomSpacerHeight > 0 && (
                      <tr style={{ height: bottomSpacerHeight }}><td colSpan={visibleColumns.length + 2} /></tr>
                    )}
                    {/* Add row */}
                    <tr className="border-t-2 border-border/80">
                      <td className="w-7" />
                      <td colSpan={visibleColumns.length + 1} className="px-3 py-3">
                        <Button onClick={addRow} size="sm">
                          <Plus className="h-3.5 w-3.5 mr-1" /> {t('sales.addRow')}
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-background to-transparent z-10" />
              <div className="pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-background to-transparent z-10" />
            </div>

            {/* Floating summary + bulk bar */}
            {selectedCells.size > 1 && (() => {
              const showBulk = selectedRowIds.size > 1;
              return (
                <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30 bg-card border border-border shadow-lg rounded-lg px-4 py-2 flex items-center gap-3" onClick={stopProp}>
                  <span className="text-xs font-medium text-muted-foreground">{selectedCells.size} {t('sales.cellsSelected')}</span>
                  {showBulk && (
                    <>
                      <span className="w-px h-3 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">{selectedRowIds.size} {t('sales.rows')}</span>
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

      {/* Bottom tabs */}
      <DragDropContext onDragEnd={handleTabDragEnd}>
        <Droppable droppableId="sales-tabs" direction="horizontal">
          {(provided) => (
            <div className="h-10 border-t border-border bg-muted/30 flex items-center gap-0 px-1 shrink-0">
              <button
                onClick={() => setCreateSheetOpen(true)}
                className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded"
                title={t('sales.newSheet')}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => scrollTabs('left')} className="px-1 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div
                ref={(el) => { provided.innerRef(el); (tabScrollRef as any).current = el; }}
                {...provided.droppableProps}
                 className="flex items-center gap-1 overflow-x-auto flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {sheets.map((sheet, idx) => (
                  <Draggable key={sheet.id} draggableId={sheet.id} index={idx}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        data-tab-id={sheet.id}
                        className={cn("relative group/tab shrink-0", snapshot.isDragging && "z-30")}
                        onMouseEnter={() => setHoveredTab(sheet.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                      >
                        <button
                          onClick={() => {
                            if (draftCellKeyRef.current) commitDraftRef.current();
                            startTransition(() => setActiveSheetId(sheet.id));
                          }}
                          className={cn(
                             'flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all rounded-t-md border border-b-0 pr-7',
                            sheet.id === activeSheetId
                               ? 'bg-background text-primary border-border shadow-sm'
                               : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border-muted-foreground/20',
                            snapshot.isDragging && 'shadow-lg rounded bg-background border border-border'
                          )}
                        >
                          <span {...dragProvided.dragHandleProps} className="opacity-0 group-hover/tab:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing -ml-1 mr-0.5">
                            <GripVertical className="h-3 w-3" />
                          </span>
                          {sheet.name}
                        </button>
                        {hoveredTab === sheet.id && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteSheet(sheet.id); }}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title={t('sales.deleteSheet')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
              <button onClick={() => scrollTabs('right')} className="px-1 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 rounded">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Create sheet dialog */}
      <Dialog open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <DialogContent className="max-w-sm" onClick={stopProp}>
          <DialogHeader>
            <DialogTitle>{t('sales.newSheet')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('sales.sheetName')}</Label>
              <Input
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                placeholder={t('sales.sheetNamePlaceholder')}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSheet(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSheetOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateSheet} disabled={!newSheetName.trim()}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
