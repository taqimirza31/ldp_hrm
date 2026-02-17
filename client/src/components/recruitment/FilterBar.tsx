import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import type { FilterBarProps } from "./types";

export function FilterBar({
  jobFilterValue,
  onJobFilterChange,
  jobOptions,
  jobFilterOptions,
  onAdvancedFiltersClick,
  view,
  onViewChange,
  selectedCount = 0,
  bulkActions,
}: FilterBarProps) {
  const options = jobFilterOptions ?? jobOptions ?? [];
  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Job</Label>
        <Select value={jobFilterValue} onValueChange={onJobFilterChange}>
          <SelectTrigger className="w-[220px] h-9 rounded-xl border-border/80">
            <SelectValue placeholder="All jobs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All jobs</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl gap-1.5"
        onClick={onAdvancedFiltersClick}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Advanced
      </Button>
      <div className="flex-1 min-w-[80px]" />
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => v && onViewChange(v as "board" | "list")}
        className="gap-0 rounded-xl border border-border/80 p-0.5 bg-muted/30"
      >
        <ToggleGroupItem
          value="board"
          aria-label="Board"
          className="h-8 px-3 rounded-lg gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Board
        </ToggleGroupItem>
        <ToggleGroupItem
          value="list"
          aria-label="List"
          className="h-8 px-3 rounded-lg gap-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          <List className="h-3.5 w-3.5" />
          List
        </ToggleGroupItem>
      </ToggleGroup>
      {selectedCount > 0 && bulkActions && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          {bulkActions}
        </div>
      )}
    </div>
  );
}
