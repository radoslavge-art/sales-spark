import { useATS } from '@/context/ATSContext';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ExcelJS from 'exceljs';

interface Props {
  companyId?: string | null;
  positionId?: string | null;
  asMenuItem?: boolean;
}

const STAGE_BG_COLORS: Record<string, string> = {
  blue: 'DCE4ED', amber: 'FEF3D6', purple: 'EDE4F7', green: 'D9F2E1',
  red: 'FADCD9', teal: 'D6EDED', pink: 'F7D9ED',
};

const STAGE_ACCENT_COLORS: Record<string, string> = {
  blue: '2563EB', amber: 'D97706', purple: '8B5CF6', green: '16A34A',
  red: 'DC2626', teal: '0D9488', pink: 'DB2777',
};

const HEADER_BG = '2563EB';
const HEADER_FG = 'FFFFFF';

const COLUMNS = [
  { header: 'Name', key: 'name' },
  { header: 'Email', key: 'email' },
  { header: 'Phone', key: 'phone' },
  { header: 'Position', key: 'position' },
  { header: 'Company', key: 'company' },
  { header: 'Stage', key: 'stage' },
  { header: 'Owner', key: 'owner' },
  { header: 'Salary Expectations', key: 'salary' },
  { header: 'Resignation Notice', key: 'notice' },
  { header: 'Notes', key: 'notes' },
  { header: 'Tags', key: 'tags' },
  { header: 'Created', key: 'created' },
] as const;

function buildFileName(companies: { id: string; name: string }[], companyId?: string | null, positionId?: string | null, positions?: { id: string; title: string }[]) {
  const date = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];
  if (companyId) {
    const comp = companies.find(c => c.id === companyId);
    if (comp) parts.push(comp.name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase());
  }
  if (positionId && positions) {
    const pos = positions.find(p => p.id === positionId);
    if (pos) parts.push(pos.title.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase());
  }
  parts.push('export', date);
  return parts.join('_');
}

export function ExportCandidatesButton({ companyId, positionId, asMenuItem }: Props) {
  const { candidates, positions, companies, owners, getCompanyStages } = useATS();

  function getFilteredData() {
    let data = candidates;
    if (positionId) {
      data = data.filter(c => c.position_id === positionId);
    } else if (companyId) {
      const posIds = positions.filter(p => p.company_id === companyId).map(p => p.id);
      data = data.filter(c => posIds.includes(c.position_id));
    }
    return data;
  }

  function resolveRow(c: typeof candidates[number]) {
    const pos = positions.find(p => p.id === c.position_id);
    const comp = pos ? companies.find(co => co.id === pos.company_id) : null;
    const stages = comp ? getCompanyStages(comp.id) : [];
    const stage = stages.find(s => s.id === c.stage_id);
    const owner = c.owner_id ? owners.find(o => o.id === c.owner_id) : null;
    return {
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      position: pos?.title || '',
      company: comp?.name || '',
      stage: stage?.label || '',
      stageColor: stage?.color || '',
      owner: owner?.name || '',
      salary: c.expected_salary || '',
      notice: c.notice_period || '',
      notes: c.notes || '',
      tags: (c.tags || []).join(', '),
      created: new Date(c.created_at).toISOString().slice(0, 10),
    };
  }

  const fileName = buildFileName(companies, companyId, positionId, positions);

  // --- CSV Export ---
  const handleExportCSV = () => {
    const data = getFilteredData();
    const rows = data.map(resolveRow);
    const headers = COLUMNS.map(c => c.header);

    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const lines = [headers.map(escapeCSV).join(',')];
    for (const row of rows) {
      const values = COLUMNS.map(col => escapeCSV(String(row[col.key] ?? '')));
      lines.push(values.join(','));
    }

    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Excel Export ---
  const handleExportExcel = async () => {
    const data = getFilteredData();
    const rows = data.map(resolveRow);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Candidates');

    ws.columns = COLUMNS.map(c => ({
      header: c.header,
      key: c.key,
      width: c.key === 'notes' ? 30 : c.key === 'email' ? 24 : c.key === 'name' ? 25 : 18,
    }));

    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11, name: 'Inter' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: '1E40AF' } } };
    });

    rows.forEach(r => {
      const row = ws.addRow(r);
      row.height = 24;
      row.eachCell(cell => {
        cell.font = { size: 10, name: 'Inter' };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'E5E7EB' } } };
      });
      if (r.stageColor) {
        const stageCell = row.getCell('stage');
        const bgColor = STAGE_BG_COLORS[r.stageColor] || 'F3F4F6';
        const fgColor = STAGE_ACCENT_COLORS[r.stageColor] || '374151';
        stageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        stageCell.font = { bold: true, size: 10, name: 'Inter', color: { argb: fgColor } };
        stageCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell(cell => {
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === undefined) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
          }
        });
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (asMenuItem) {
    return (
      <>
        <div role="menuitem" className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </div>
        <div role="menuitem" className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground" onClick={handleExportCSV}>
          <FileText className="h-4 w-4" /> Export CSV
        </div>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Download className="h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
          <FileText className="h-4 w-4" /> CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
