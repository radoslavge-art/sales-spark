import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, GripVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type ColumnKey = "name" | "company" | "status" | "priority" | "owner" | "source" | "created";

export interface ColumnConfig {
  key: ColumnKey;
  labelKey: string;
  visible: boolean;
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

  const toggleVisibility = (key: ColumnKey) => {
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
              <label htmlFor={`col-${col.key}`} className="flex-1 cursor-pointer select-none">
                {t(col.labelKey)}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
