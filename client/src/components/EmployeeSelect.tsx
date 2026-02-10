import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  work_email?: string;
  department?: string;
  job_title?: string;
  avatar?: string;
  employment_status?: string;
}

// ==================== SINGLE SELECT ====================

interface EmployeeSelectProps {
  value: string;
  onChange: (employeeId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Pass employees externally to avoid refetching. If omitted, fetches from /api/employees */
  employees?: EmployeeOption[];
}

export function EmployeeSelect({
  value,
  onChange,
  placeholder = "Select employee...",
  disabled = false,
  className = "",
  employees: externalEmployees,
}: EmployeeSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: fetchedEmployees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
    enabled: !externalEmployees,
  });

  const employees = externalEmployees || fetchedEmployees;
  const selected = employees.find((e) => e.id === value);

  const label = selected
    ? `${selected.first_name} ${selected.last_name}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`w-full justify-between font-normal ${className}`}
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate">
            {selected && (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px]">
                  {selected.first_name[0]}{selected.last_name[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <span className="truncate">{label}</span>
          </span>
          {value ? (
            <X
              className="ml-1 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, ID, or dept..." />
          <CommandList>
            <CommandEmpty>No employees found.</CommandEmpty>
            <CommandGroup>
              {employees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.first_name} ${emp.last_name} ${emp.employee_id || ""} ${emp.department || ""} ${emp.work_email || ""}`}
                  onSelect={() => {
                    onChange(emp.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {emp.first_name[0]}{emp.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm truncate">{emp.first_name} {emp.last_name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {emp.employee_id && `${emp.employee_id} · `}{emp.department || ""}{emp.work_email ? ` · ${emp.work_email}` : ""}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ==================== MULTI SELECT ====================

interface EmployeeMultiSelectProps {
  value: string[];
  onChange: (employeeIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  employees?: EmployeeOption[];
}

export function EmployeeMultiSelect({
  value,
  onChange,
  placeholder = "Select employees...",
  disabled = false,
  className = "",
  employees: externalEmployees,
}: EmployeeMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: fetchedEmployees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
    enabled: !externalEmployees,
  });

  const employees = externalEmployees || fetchedEmployees;

  const selectedNames = value
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `${e!.first_name} ${e!.last_name}`);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            {value.length > 0
              ? `${value.length} selected`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search employees..." />
            <CommandList>
              <CommandEmpty>No employees found.</CommandEmpty>
              <CommandGroup>
                {employees.map((emp) => (
                  <CommandItem
                    key={emp.id}
                    value={`${emp.first_name} ${emp.last_name} ${emp.employee_id || ""} ${emp.department || ""}`}
                    onSelect={() => {
                      onChange(
                        value.includes(emp.id)
                          ? value.filter((x) => x !== emp.id)
                          : [...value, emp.id]
                      );
                    }}
                  >
                    <Checkbox
                      checked={value.includes(emp.id)}
                      className="mr-2 pointer-events-none"
                    />
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[9px]">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm">{emp.first_name} {emp.last_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {emp.department || ""}
                        </span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedNames.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">{selectedNames.join(", ")}</p>
      )}
    </div>
  );
}

/**
 * Resolve employee name from ID.
 * Useful for display when only employee_id is stored.
 */
export function resolveEmployeeName(employees: EmployeeOption[], id: string): string {
  const emp = employees.find((e) => e.id === id);
  return emp ? `${emp.first_name} ${emp.last_name}` : "";
}

export function resolveEmployeeEmail(employees: EmployeeOption[], id: string): string {
  const emp = employees.find((e) => e.id === id);
  return emp?.work_email || "";
}
