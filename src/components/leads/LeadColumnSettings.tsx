import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Settings2, GripVertical, Plus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type BuiltInColumnKey = "name" | "company" | "status" | "priority" | "owner" | "source" | "created";

export interface ColumnConfig {
  key: string;
  labelKey: string;
  visible: boolean;
  isCustom?: boolean;
  customLabel?: string;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "name", labelKey: "leads.name", visible: true },
  { key: "company", labelKey: "leads.company", visible: true },
  { key: "status", labelKey: "leads.status", visible: true },
  { key: "priority", labelKey: "leads.priority", visible: true },
  { key: "owner", labelKey: "leads.owner", visible: true },
  { key: "source", labelKey: "leads.source", visible: true },
  { key: "created", labelKey: "leads.created", visible: true },
];

interface Props {
  columns: ColumnConfig[];
  onChange: (columns: ColumnConfig[]) => void;
}

export function LeadColumnSettings({ columns, onChange }: Props) {
  const { t } = useLanguage();
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);

  const toggleVisibility = (key: string) => {
    const visibleCount = columns.filter((c) => c.visible).length;
    onChange(
      columns.map((col) =>
        col.key === key
          ? { ...col, visible: col.visible && visibleCount <= 1 ? true : !col.visible }
          : col
      )
    );
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
    setDragging(true);
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const reordered = [...columns];
      const [removed] = reordered.splice(dragItem.current, 1);
      reordered.splice(dragOverItem.current, 0, removed);
      onChange(reordered);
    }
    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };

  const addCustomColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    const key = `custom_${Date.now()}`;
    onChange([...columns, { key, labelKey: key, visible: true, isCustom: true, customLabel: name }]);
    setNewColName("");
    setShowAddInput(false);
  };

  const removeCustomColumn = (key: string) => {
    onChange(columns.filter((col) => col.key !== key));
  };

  const getLabel = (col: ColumnConfig) => col.isCustom ? col.customLabel ?? col.key : t(col.labelKey);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          {t("leads.columns")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs text-muted-foreground mb-2 px-1">{t("leads.dragToReorder")}</p>
        <div className="space-y-0.5">
          {columns.map((col, index) => (
            <div
              key={col.key}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-2 rounded-md px-1 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:bg-accent transition-colors ${
                dragging && dragItem.current === index ? "opacity-50" : ""
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Checkbox
                checked={col.visible}
                onCheckedChange={() => toggleVisibility(col.key)}
                id={`col-${col.key}`}
              />
              <label htmlFor={`col-${col.key}`} className="flex-1 cursor-pointer select-none truncate">
                {getLabel(col)}
              </label>
              {col.isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeCustomColumn(col.key); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t mt-2 pt-2">
          {showAddInput ? (
            <div className="flex items-center gap-1">
              <Input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomColumn()}
                placeholder={t("leads.customColumnName")}
                className="h-7 text-xs"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={addCustomColumn}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => { setShowAddInput(false); setNewColName(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-1.5 h-7" onClick={() => setShowAddInput(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("leads.addCustomColumn")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
