import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Circle,
  UserPlus,
  Mail,
  ArrowRight,
  Building2,
  Briefcase,
  Plus,
  Users,
  Package,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ==================== ONBOARDING CONFIG ====================
export interface OnboardingRecord {
  id: string;
  employeeId?: string;
  name: string;
  role: string;
  department: string;
  startDate: string;
  email?: string;
  status: string;
  taskCount: number;
  completedCount: number;
}

export interface OnboardingTask {
  id: string;
  task: string;
  taskKey: string;
  category: string;
  completed: boolean;
  assignmentDetails?: string;
}

function formatStartDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toRecord(r: any): OnboardingRecord {
  const name = r.hire_name ?? (r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : "Unknown");
  const role = r.hire_role ?? r.job_title ?? "";
  const dept = r.hire_department ?? r.department ?? "Other";
  const email = r.hire_email ?? r.work_email;
  const startDate = r.start_date ?? r.join_date ?? "";
  return {
    id: r.id,
    employeeId: r.employee_id,
    name,
    role,
    department: dept,
    startDate,
    email,
    status: r.status,
    taskCount: r.task_count ?? 0,
    completedCount: r.completed_count ?? 0,
  };
}

function toTask(t: any): OnboardingTask {
  return {
    id: t.id,
    task: t.task_name,
    taskKey: t.id,
    category: t.category || "Company-wide",
    completed: t.completed === "true",
    assignmentDetails: t.assignment_details,
  };
}

export default function Onboarding() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Support ?recordId=xxx from employee creation redirect
  const recordIdFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("recordId") : null;
  const [taskDetailDialog, setTaskDetailDialog] = useState<{
    open: boolean;
    task: OnboardingTask | null;
  }>({ open: false, task: null });
  const [taskDetailInput, setTaskDetailInput] = useState("");
  const [addCustomForm, setAddCustomForm] = useState({ task: "", category: "" });

  // Fetch all onboarding records
  const { data: recordsRaw = [] } = useQuery({
    queryKey: ["/api/onboarding"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/onboarding");
      return res.json();
    },
  });

  const records: OnboardingRecord[] = Array.isArray(recordsRaw) ? recordsRaw.map(toRecord) : [];

  // Fetch selected record with tasks
  const { data: selectedRecordRaw, isLoading: selectedLoading } = useQuery({
    queryKey: ["/api/onboarding", selectedRecordId],
    queryFn: async () => {
      if (!selectedRecordId) return null;
      const res = await apiRequest("GET", `/api/onboarding/${selectedRecordId}`);
      return res.json();
    },
    enabled: !!selectedRecordId,
  });

  const selectedRecord = selectedRecordRaw ? toRecord(selectedRecordRaw) : null;
  const tasks: OnboardingTask[] = Array.isArray(selectedRecordRaw?.tasks)
    ? selectedRecordRaw.tasks.map(toTask)
    : [];
  const companyWideTasks = tasks.filter((t) => t.category === "Company-wide");
  const additionalTasks = tasks.filter((t) => t.category !== "Company-wide");
  const fullTasks = [...companyWideTasks, ...additionalTasks];
  const totalTasks = fullTasks.length;
  const completedCount = fullTasks.filter((t) => t.completed).length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const activeRecords = records.filter((r) => r.status === "in_progress");
  const completedRecords = records.filter((r) => r.status === "completed");

  // Auto-select: recordId from URL (redirect from creation) > first active > first record
  useEffect(() => {
    if (records.length === 0) return;
    if (recordIdFromUrl && records.some((r) => r.id === recordIdFromUrl)) {
      setSelectedRecordId(recordIdFromUrl);
      window.history.replaceState({}, "", "/onboarding");
      return;
    }
    if (!selectedRecordId) {
      const firstActive = records.find((r) => r.status === "in_progress");
      setSelectedRecordId(firstActive?.id ?? records[0].id);
    }
  }, [records, selectedRecordId, recordIdFromUrl]);

  // Toggle task (only when assignment_details exists - enforced by backend)
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ recordId, taskId, completed }: { recordId: string; taskId: string; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/${recordId}/tasks/${taskId}`, { completed });
      return res.json();
    },
    onSuccess: () => {
      if (selectedRecordId) {
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding", selectedRecordId] });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      }
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update task"),
  });

  // Update task assignment details
  const updateTaskDetailsMutation = useMutation({
    mutationFn: async ({ recordId, taskId, assignmentDetails }: { recordId: string; taskId: string; assignmentDetails: string }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/${recordId}/tasks/${taskId}`, { assignmentDetails });
      return res.json();
    },
    onSuccess: () => {
      if (selectedRecordId) {
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding", selectedRecordId] });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      }
      toast.success("Assignment details saved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  // Add custom task
  const addTaskMutation = useMutation({
    mutationFn: async ({ recordId, taskName, notes }: { recordId: string; taskName: string; notes?: string }) => {
      const name = notes?.trim() ? `${taskName.trim()} (${notes.trim()})` : taskName.trim();
      const res = await apiRequest("POST", `/api/onboarding/${recordId}/tasks`, {
        taskName: name,
        category: "Additional Assigned Items",
      });
      return res.json();
    },
    onSuccess: () => {
      if (selectedRecordId) {
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding", selectedRecordId] });
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      }
      toast.success("Item added to checklist");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add item"),
  });

  // Complete onboarding
  const completeMutation = useMutation({
    mutationFn: async (payload: { recordId: string; record: OnboardingRecord; tasksForRec: OnboardingTask[] }) => {
      const res = await apiRequest("PATCH", `/api/onboarding/${payload.recordId}`, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      await res.json();
      return payload;
    },
    onSuccess: async (payload) => {
      const { recordId, record: rec, tasksForRec } = payload;
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", recordId] });
      const msAccountTask = tasksForRec.find((t) => t.task === "Company Microsoft Account");
      const laptopTask = tasksForRec.find((t) => t.task === "Laptop");
      const additionalItemsSummary = tasksForRec
        .filter((t) => t.task !== "Company Microsoft Account" && t.task !== "Laptop")
        .map((t) => (t.assignmentDetails ? `${t.task}: ${t.assignmentDetails}` : t.task))
        .join(", ");

      if (rec?.employeeId) {
        try {
          const updatePayload: Record<string, string> = {};
          if (msAccountTask?.assignmentDetails) {
            updatePayload.customField1 = `MS Account: ${msAccountTask.assignmentDetails}`;
          }
          const assetParts: string[] = [];
          if (laptopTask?.assignmentDetails) {
            assetParts.push(`Laptop: ${laptopTask.assignmentDetails}`);
            const match = laptopTask.assignmentDetails.match(/\(([^)]+)\)\s*$/);
            if (match) {
              const stockId = match[1].trim();
              try {
                const assignRes = await apiRequest("POST", "/api/assets/systems/assign-from-stock", {
                  stockItemId: stockId,
                  employeeId: rec.employeeId,
                });
                // Validate response is real JSON from backend
                const ct = assignRes.headers.get("content-type") || "";
                if (ct.includes("application/json")) {
                  const assignData = await assignRes.json();
                  if (assignData?.id) {
                    // Assignment succeeded – invalidate Asset Management caches
                    queryClient.invalidateQueries({ queryKey: ["/api/assets/stock"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/assets/systems"] });
                    queryClient.invalidateQueries({ queryKey: ["onboarding-stock"] });
                  }
                }
              } catch {
                /* may be manual entry with parentheses, not a real stock id – ignore */
              }
            }
          }
          if (additionalItemsSummary) assetParts.push(additionalItemsSummary);
          if (assetParts.length > 0) updatePayload.customField2 = assetParts.join(" | ");
          if (Object.keys(updatePayload).length > 0) {
            await apiRequest("PATCH", `/api/employees/${rec.employeeId}`, updatePayload);
          }
        } catch {
          /* non-blocking */
        }
      }

      const summaryParts: string[] = [];
      if (msAccountTask?.assignmentDetails) summaryParts.push(`MS Account: ${msAccountTask.assignmentDetails}`);
      if (laptopTask?.assignmentDetails) summaryParts.push(`Laptop: ${laptopTask.assignmentDetails}`);
      if (additionalItemsSummary) summaryParts.push(`Additional: ${additionalItemsSummary}`);
      addNotification({
        type: "onboarding",
        title: "Onboarding Completed",
        message: `${rec?.name} (${rec?.role}, ${rec?.department}) has completed onboarding.${summaryParts.length > 0 ? " " + summaryParts.join(" | ") : ""}`,
        roles: ["admin", "hr"],
        link: "/onboarding",
        icon: "UserPlus",
      });

      toast.success(`Onboarding completed for ${rec?.name}`, {
        description: "HR has been notified. Assigned items synced to profile.",
      });
      if (rec?.employeeId) {
        // Force refetch so Employee Profile and Asset Management see the new data immediately
        queryClient.refetchQueries({ queryKey: ["/api/assets/systems/user", rec.employeeId] });
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        window.dispatchEvent(new CustomEvent("employee-updated", { detail: { employeeId: rec.employeeId } }));
      }
      const remaining = records.filter((r) => r.id !== recordId && r.status === "in_progress");
      setSelectedRecordId(remaining[0]?.id ?? null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to complete"),
  });

  const handleToggleTask = (task: OnboardingTask) => {
    if (!selectedRecordId) return;
    if (!task.assignmentDetails?.trim()) {
      toast.error("Save assignment details first");
      return;
    }
    toggleTaskMutation.mutate({ recordId: selectedRecordId, taskId: task.id, completed: !task.completed });
  };

  const handleCompleteStage = () => {
    if (progress < 100) {
      toast.error("Complete all items before finishing onboarding");
      return;
    }
    if (!selectedRecordId || !selectedRecord) return;
    completeMutation.mutate({
      recordId: selectedRecordId,
      record: selectedRecord,
      tasksForRec: tasks,
    });
  };

  // Fetch stock for laptop assignment
  const { data: stockItems = [] } = useQuery({
    queryKey: ["onboarding-stock"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/assets/stock");
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    retry: false,
  });
  const availableLaptops = stockItems.filter(
    (s: any) => (s.available ?? s.quantity ?? 0) > 0 && (s.category === "Systems" || s.name?.toLowerCase().includes("laptop") || s.name?.toLowerCase().includes("notebook"))
  );
  const allStockItems = stockItems.filter((s: any) => (s.available ?? s.quantity ?? 0) > 0);

  const handleTaskClick = (item: OnboardingTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskDetailInput(item.assignmentDetails || "");
    setTaskDetailDialog({ open: true, task: item });
  };

  const handleSaveTaskDetails = () => {
    if (!taskDetailDialog.task || !selectedRecordId) return;
    const value = taskDetailInput.trim();
    if (!value) {
      toast.error("Enter assignment details");
      return;
    }
    updateTaskDetailsMutation.mutate({
      recordId: selectedRecordId,
      taskId: taskDetailDialog.task.id,
      assignmentDetails: value,
    });
    setTaskDetailDialog({ open: false, task: null });
  };

  const handleAddCustomItem = () => {
    if (!addCustomForm.task.trim()) {
      toast.error("Please enter an item name");
      return;
    }
    if (!selectedRecordId) return;
    addTaskMutation.mutate({
      recordId: selectedRecordId,
      taskName: addCustomForm.task.trim(),
      notes: addCustomForm.category.trim() || undefined,
    });
    setAddCustomForm({ task: "", category: "" });
  };

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Onboarding</h1>
          <p className="text-muted-foreground text-sm">
            Manage new hire checklists. Start onboarding from an employee profile. Company-wide items (MS Account, Laptop) are assigned by default. IT Admin can add additional items per employee.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Hires List */}
        <div className="space-y-6">
          <h3 className="font-bold text-muted-foreground text-sm uppercase tracking-wider">Incoming Hires</h3>
          {activeRecords.map((record) => {
            const hireProgress = record.taskCount > 0 ? Math.round((record.completedCount / record.taskCount) * 100) : 0;
            return (
              <Card
                key={record.id}
                className={`border shadow-sm cursor-pointer transition-all group ${
                  selectedRecordId === record.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedRecordId(record.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <Avatar>
                      <AvatarFallback>{record.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-foreground truncate">{record.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {record.role} • {record.department}
                      </p>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Starts {formatStartDate(record.startDate) || record.startDate || "—"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{hireProgress}%</span>
                    </div>
                    <Progress value={hireProgress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {activeRecords.length === 0 && (
            <Card className="border border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{completedRecords.length > 0 ? "All hires completed." : "No new hires yet."}</p>
                <p className="text-sm">
                  {completedRecords.length > 0 ? "Start onboarding from an employee profile." : "Create an employee first, then start onboarding from their profile."}
                </p>
              </CardContent>
            </Card>
          )}

          {completedRecords.length > 0 && (
            <>
              <h3 className="font-bold text-muted-foreground text-sm uppercase tracking-wider mt-8">Completed</h3>
              {completedRecords.map((record) => (
                <Card key={record.id} className="border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>{record.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-foreground truncate">{record.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.role} • {record.department}
                        </p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Checklist Detail */}
        <div className="lg:col-span-2">
          {!selectedRecordId ? (
            <Card className="border border-dashed">
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">All onboarding complete</h3>
                <p className="text-muted-foreground">
                  {completedRecords.length > 0
                    ? `${completedRecords.length} hire(s) have completed onboarding.`
                    : "Create an employee, then start onboarding from their profile."}
                </p>
              </CardContent>
            </Card>
          ) : selectedLoading ? (
            <Card className="border border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          ) : selectedRecord?.status === "completed" ? (
            <Card className="border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-600" />
                <h3 className="text-lg font-semibold mb-2">Onboarding completed</h3>
                <p className="text-muted-foreground">
                  {selectedRecord.name} has completed all onboarding items.
                </p>
              </CardContent>
            </Card>
          ) : selectedRecord ? (
            <Card className="border border-border shadow-sm h-full bg-card">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle>{selectedRecord.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>{selectedRecord.role}</span>
                      <span>•</span>
                      <Badge variant="outline" className="font-normal">
                        <Building2 className="h-3 w-3 mr-1" />
                        {selectedRecord.department}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <Mail className="h-4 w-4 mr-2" /> Resend Welcome
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1">
                    <Progress value={progress} className="h-2" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {completedCount} / {totalTasks} completed
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-8">
                  <div>
                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary border border-primary/20">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <span>Company-wide</span>
                      <Badge variant="secondary" className="text-xs font-normal">
                        All employees
                      </Badge>
                    </h4>
                    <div className="space-y-2 ml-10">
                      {companyWideTasks.map((item) => (
                        <div
                          key={item.taskKey}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-border"
                          onClick={(e) => handleTaskClick(item, e)}
                        >
                          <div
                            className={`shrink-0 transition-colors cursor-pointer ${item.completed ? "text-green-500" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTask(item);
                            }}
                            role="button"
                            aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                          >
                            {item.completed ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm block ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {item.task}
                            </span>
                            {item.assignmentDetails && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">→ {item.assignmentDetails}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.assignmentDetails ? "Edit" : "Assign"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted text-muted-foreground border border-border">
                        <Package className="h-4 w-4" />
                      </div>
                      <span>Additional Assigned Items</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        Manual
                      </Badge>
                    </h4>
                    <div className="space-y-2 ml-10">
                      {additionalTasks.length > 0 ? (
                        additionalTasks.map((item) => (
                          <div
                            key={item.taskKey}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-border"
                            onClick={(e) => handleTaskClick(item, e)}
                          >
                            <div
                              className={`shrink-0 transition-colors cursor-pointer ${item.completed ? "text-green-500" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTask(item);
                              }}
                              role="button"
                              aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                            >
                              {item.completed ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm block ${item.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {item.task}
                              </span>
                              {item.assignmentDetails && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">→ {item.assignmentDetails}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {item.assignmentDetails ? "Edit" : "Assign"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">
                          No additional items yet. Use the button below to add department-specific or custom items.
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Input
                          placeholder="e.g. VPN Access, Design Tool License, ID Badge…"
                          value={addCustomForm.task}
                          onChange={(e) => setAddCustomForm({ ...addCustomForm, task: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCustomItem();
                          }}
                          className="flex-1 h-9 text-sm"
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={addCustomForm.category}
                          onChange={(e) => setAddCustomForm({ ...addCustomForm, category: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCustomItem();
                          }}
                          className="w-40 h-9 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddCustomItem}
                          disabled={!addCustomForm.task.trim() || addTaskMutation.isPending}
                          className="shrink-0 h-9"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {fullTasks.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No checklist for this hire.</p>
                      <p className="text-sm">Select a hire or add a new one to see their onboarding items.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Company-wide:</strong> Microsoft Account, Laptop &bull; <strong>Additional:</strong> Add items manually per employee
                  </p>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                    disabled={progress < 100 || completeMutation.isPending}
                    onClick={handleCompleteStage}
                  >
                    Complete Onboarding
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Task Detail Dialog - Laptop / Microsoft Account */}
      <Dialog open={taskDetailDialog.open} onOpenChange={(open) => setTaskDetailDialog({ ...taskDetailDialog, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {taskDetailDialog.task?.task === "Company Microsoft Account"
                ? "Microsoft Account"
                : taskDetailDialog.task?.task === "Laptop"
                  ? "Laptop Assignment"
                  : "Assignment Details"}
            </DialogTitle>
            <DialogDescription>
              {taskDetailDialog.task?.task === "Company Microsoft Account"
                ? "Enter the employee's company Microsoft account email."
                : taskDetailDialog.task?.task === "Laptop"
                  ? "Select which laptop from stock is being assigned, or enter manually."
                  : "Enter assignment details or notes. Task can be marked complete only after details are saved."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {taskDetailDialog.task?.task === "Company Microsoft Account" && (
              <div className="space-y-2">
                <Label>Microsoft Account (Email)</Label>
                <Input
                  type="email"
                  placeholder="e.g. john.doe@company.com"
                  value={taskDetailInput}
                  onChange={(e) => setTaskDetailInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The work email used for Microsoft 365, Teams, etc.
                </p>
              </div>
            )}
            {taskDetailDialog.task?.task === "Laptop" && (
              <div className="space-y-2">
                <Label>Laptop from Stock</Label>
                {allStockItems.length > 0 && (
                  <Select
                    value={taskDetailInput && allStockItems.some((s: any) => `${s.name} (${s.id})` === taskDetailInput) ? taskDetailInput : ""}
                    onValueChange={(v) => setTaskDetailInput(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from available stock" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableLaptops.length > 0 ? availableLaptops : allStockItems).map((s: any) => (
                        <SelectItem key={s.id} value={`${s.name} (${s.id})`}>
                          {s.name} — {s.available ?? s.quantity} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {allStockItems.length > 0 ? "Or enter manually" : "Enter laptop details"}
                  </Label>
                  <Input
                    placeholder="e.g. Dell XPS 15 (AST-001)"
                    value={taskDetailInput}
                    onChange={(e) => setTaskDetailInput(e.target.value)}
                  />
                </div>
              </div>
            )}
            {taskDetailDialog.task &&
              taskDetailDialog.task.task !== "Company Microsoft Account" &&
              taskDetailDialog.task.task !== "Laptop" && (
                <div className="space-y-2">
                  <Label>Assignment details / notes</Label>
                  <Input
                    placeholder="e.g. VPN Access granted, ID Badge #123"
                    value={taskDetailInput}
                    onChange={(e) => setTaskDetailInput(e.target.value)}
                  />
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDetailDialog({ open: false, task: null })}>
              Close
            </Button>
            <Button onClick={handleSaveTaskDetails} disabled={!taskDetailInput.trim() || updateTaskDetailsMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
