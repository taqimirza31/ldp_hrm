import Layout from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  LogOut, Search, Calendar, Clock, CheckCircle, XCircle,
  AlertTriangle, ChevronRight, User, Briefcase, Shield,
  Package, FileText, MessageSquare, Ban, RotateCcw, CircleDot,
  ClipboardList, Timer, Users, ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EmployeeSelect } from "@/components/EmployeeSelect";

// ==================== TYPES ====================

interface OffboardingRecord {
  id: string;
  employee_id: string;
  initiated_by: string;
  offboarding_type: string;
  reason: string | null;
  notice_required: boolean;
  notice_period_days: number | null;
  initiated_at: string;
  exit_date: string;
  status: string;
  completed_at: string | null;
  remarks: string | null;
  // Joined
  first_name: string;
  last_name: string;
  work_email: string;
  emp_id: string;
  department: string;
  job_title: string;
  avatar: string | null;
  initiator_first_name: string;
  initiator_last_name: string;
  total_tasks: number;
  done_tasks: number;
}

interface OffboardingDetail extends OffboardingRecord {
  employment_status: string;
  tasks: OffboardingTask[];
  assets: AssetRow[];
  audit_log: AuditEntry[];
}

interface OffboardingTask {
  id: string;
  offboarding_id: string;
  task_type: string;
  title: string;
  assigned_to: string | null;
  status: string;
  completed_at: string | null;
  notes: string | null;
  related_asset_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
}

interface AssetRow {
  id: string;
  asset_id: string;
  user_name: string;
  ram: string | null;
  storage: string | null;
  processor: string | null;
  status: string;
  assigned_date: string | null;
}

interface AuditEntry {
  id: string;
  offboarding_id: string;
  action: string;
  performed_by: string;
  details: string | null;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

type EmpOption = { id: string; first_name: string; last_name: string; department?: string; employee_id?: string; work_email?: string };

// ==================== HELPERS ====================

const statusBadge: Record<string, { label: string; className: string }> = {
  initiated: { label: "Initiated", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_notice: { label: "In Notice", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

const typeBadge: Record<string, { label: string; className: string }> = {
  resignation: { label: "Resignation", className: "bg-orange-100 text-orange-700 border-orange-200" },
  termination: { label: "Termination", className: "bg-red-100 text-red-700 border-red-200" },
  contract_end: { label: "Contract End", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

const taskTypeIcon: Record<string, typeof Package> = {
  asset_return: Package,
  handover: ArrowRight,
  knowledge_transfer: FileText,
  final_settlement: Briefcase,
  exit_interview: MessageSquare,
};

const taskTypeLabel: Record<string, string> = {
  asset_return: "Asset Return",
  handover: "Handover",
  knowledge_transfer: "Knowledge Transfer",
  final_settlement: "Final Settlement",
  exit_interview: "Exit Interview",
};

function daysUntil(dateStr: string): number {
  const exit = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((exit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ==================== INITIATE DIALOG ====================

function InitiateDialog({
  open,
  onClose,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: EmpOption[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employeeId: "",
    offboardingType: "resignation" as string,
    reason: "",
    noticeRequired: true,
    noticePeriodDays: "30",
    exitDateOverride: "",
    remarks: "",
  });
  const [loading, setLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm({
        employeeId: "",
        offboardingType: "resignation",
        reason: "",
        noticeRequired: true,
        noticePeriodDays: "30",
        exitDateOverride: "",
        remarks: "",
      });
    }
  }, [open]);

  const computedExitDate = useMemo(() => {
    if (form.exitDateOverride) return form.exitDateOverride;
    if (!form.noticeRequired) return new Date().toISOString().split("T")[0];
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(form.noticePeriodDays) || 0));
    return d.toISOString().split("T")[0];
  }, [form.noticeRequired, form.noticePeriodDays, form.exitDateOverride]);

  const handleSubmit = async () => {
    if (!form.employeeId) { toast.error("Select an employee"); return; }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/offboarding/initiate", {
        employeeId: form.employeeId,
        offboardingType: form.offboardingType,
        reason: form.reason || null,
        noticeRequired: form.noticeRequired,
        noticePeriodDays: form.noticeRequired ? parseInt(form.noticePeriodDays) || 0 : null,
        exitDateOverride: form.exitDateOverride || null,
        remarks: form.remarks || null,
      });
      toast.success("Offboarding initiated");
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate offboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-red-500" /> Initiate Offboarding
          </DialogTitle>
          <DialogDescription>Start the offboarding process for an employee.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <EmployeeSelect
                value={form.employeeId}
                onChange={(id) => setForm({ ...form, employeeId: id })}
                employees={employees}
                placeholder="Search employee..."
              />
            </div>

            <div className="space-y-2">
              <Label>Offboarding Type *</Label>
              <Select value={form.offboardingType} onValueChange={(v) => setForm({ ...form, offboardingType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Resignation</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="contract_end">Contract End</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Reason for offboarding..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Notice Period Required</Label>
                <p className="text-xs text-muted-foreground">
                  If enabled, employee remains active until exit date.
                </p>
              </div>
              <Switch
                checked={form.noticeRequired}
                onCheckedChange={(v) => setForm({ ...form, noticeRequired: v })}
              />
            </div>

            {form.noticeRequired && (
              <div className="space-y-2">
                <Label>Notice Period (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.noticePeriodDays}
                  onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Exit Date Override (optional)</Label>
              <Input
                type="date"
                value={form.exitDateOverride}
                onChange={(e) => setForm({ ...form, exitDateOverride: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-calculate.
              </p>
            </div>

            {/* Exit date preview */}
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Calculated Exit Date: {formatDate(computedExitDate)}
                </span>
              </div>
              {!form.noticeRequired && (
                <p className="text-xs text-amber-600 mt-1">
                  No notice — offboarding will complete immediately.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
            {loading ? "Initiating..." : "Initiate Offboarding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DETAIL DIALOG ====================

function DetailDialog({
  open,
  onClose,
  employeeId,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string | null;
  employees: EmpOption[];
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tasks");
  const [exitDateEdit, setExitDateEdit] = useState("");
  const [exitDateReason, setExitDateReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: detail, isLoading } = useQuery<OffboardingDetail>({
    queryKey: ["/api/offboarding", employeeId, "details"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/offboarding/${employeeId}/details`);
      return res.json();
    },
    enabled: !!employeeId && open,
  });

  useEffect(() => {
    if (detail) {
      setExitDateEdit(detail.exit_date);
    }
  }, [detail]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/offboarding/${detail!.id}/complete`);
    },
    onSuccess: () => {
      toast.success("Offboarding completed");
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to complete"),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/offboarding/${detail!.id}/cancel`, { reason: cancelReason || null });
    },
    onSuccess: () => {
      toast.success("Offboarding cancelled");
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to cancel"),
  });

  const exitDateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/offboarding/${detail!.id}/exit-date`, {
        exitDate: exitDateEdit,
        reason: exitDateReason || null,
      });
    },
    onSuccess: () => {
      toast.success("Exit date updated");
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
      setExitDateReason("");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update exit date"),
  });

  const taskMutation = useMutation({
    mutationFn: async ({ taskId, status, notes }: { taskId: string; status: string; notes?: string }) => {
      await apiRequest("PATCH", `/api/offboarding/tasks/${taskId}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/offboarding"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update task"),
  });

  if (!open) return null;

  const days = detail ? daysUntil(detail.exit_date) : 0;
  const isActive = detail && (detail.status === "initiated" || detail.status === "in_notice");
  const canComplete = isActive && days <= 0;
  const taskProgress = detail && detail.total_tasks > 0
    ? Math.round((detail.done_tasks / detail.total_tasks) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] p-0">
        {isLoading || !detail ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-sm font-semibold">
                      {detail.first_name[0]}{detail.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-semibold">{detail.first_name} {detail.last_name}</h2>
                    <p className="text-sm text-muted-foreground">{detail.job_title} &middot; {detail.department}</p>
                    <p className="text-xs text-muted-foreground">{detail.emp_id} &middot; {detail.work_email}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Badge className={statusBadge[detail.status]?.className || ""}>
                    {statusBadge[detail.status]?.label || detail.status}
                  </Badge>
                  <Badge variant="outline" className={typeBadge[detail.offboarding_type]?.className || ""}>
                    {typeBadge[detail.offboarding_type]?.label || detail.offboarding_type}
                  </Badge>
                </div>
              </div>

              {/* Countdown & progress */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Exit Date</p>
                  <p className="text-sm font-semibold">{formatDate(detail.exit_date)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Days Remaining</p>
                  <p className={`text-sm font-semibold ${days <= 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : ""}`}>
                    {days <= 0 ? "Past due" : `${days} day${days === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="text-sm font-semibold">{detail.done_tasks}/{detail.total_tasks}</p>
                </div>
              </div>
              <Progress value={taskProgress} className="mt-3 h-1.5" />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pb-4">
              <TabsList className="w-full grid grid-cols-4 mb-4">
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="assets">Assets</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>

              {/* TASKS TAB */}
              <TabsContent value="tasks">
                <ScrollArea className="max-h-[38vh]">
                  <div className="space-y-2">
                    {detail.tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No tasks generated.</p>
                    ) : (
                      detail.tasks.map((task) => {
                        const Icon = taskTypeIcon[task.task_type] || ClipboardList;
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              task.status === "completed"
                                ? "bg-green-50/50 border-green-200"
                                : task.status === "waived"
                                ? "bg-slate-50 border-slate-200 opacity-60"
                                : "bg-card border-border hover:bg-muted/40"
                            }`}
                          >
                            <div className={`shrink-0 ${
                              task.status === "completed" ? "text-green-600" :
                              task.status === "waived" ? "text-slate-400" : "text-muted-foreground"
                            }`}>
                              {task.status === "completed" ? <CheckCircle className="h-5 w-5" /> :
                               task.status === "waived" ? <Ban className="h-5 w-5" /> :
                               <Icon className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${task.status !== "pending" ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {taskTypeLabel[task.task_type] || task.task_type}
                                {task.assignee_first_name && ` · Assigned to ${task.assignee_first_name} ${task.assignee_last_name}`}
                                {task.completed_at && ` · Done ${formatDate(task.completed_at)}`}
                              </p>
                              {task.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{task.notes}</p>}
                            </div>
                            {isActive && task.status === "pending" && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                                  onClick={() => taskMutation.mutate({ taskId: task.id, status: "completed" })}
                                >
                                  Done
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-slate-500 hover:text-slate-700"
                                  onClick={() => taskMutation.mutate({ taskId: task.id, status: "waived", notes: "Waived by HR" })}
                                >
                                  Waive
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* ASSETS TAB */}
              <TabsContent value="assets">
                <ScrollArea className="max-h-[38vh]">
                  {detail.assets.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No assets assigned to this employee.</p>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Asset ID</TableHead>
                            <TableHead>Specs</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.assets.map((a) => (
                            <TableRow key={a.id}>
                              <TableCell className="font-medium text-sm">{a.asset_id}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {[a.processor, a.ram, a.storage].filter(Boolean).join(" · ") || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  a.status === "assigned" || a.status === "home"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : a.status === "available"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : ""
                                }>
                                  {a.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* SETTINGS TAB */}
              <TabsContent value="settings">
                <ScrollArea className="max-h-[38vh]">
                  <div className="space-y-4">
                    {/* Exit date override */}
                    {isActive && (
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm">Override Exit Date</CardTitle>
                          <CardDescription className="text-xs">Changes are fully audited.</CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">New Exit Date</Label>
                              <Input
                                type="date"
                                value={exitDateEdit}
                                onChange={(e) => setExitDateEdit(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Reason for Change</Label>
                              <Input
                                value={exitDateReason}
                                onChange={(e) => setExitDateReason(e.target.value)}
                                placeholder="e.g. extended notice"
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => exitDateMutation.mutate()}
                            disabled={exitDateMutation.isPending || exitDateEdit === detail.exit_date}
                          >
                            Update Exit Date
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Info card */}
                    <Card>
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm">Offboarding Info</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Initiated At</span><span>{formatDateTime(detail.initiated_at)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Initiated By</span><span>{detail.initiator_first_name} {detail.initiator_last_name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{detail.offboarding_type.replace("_", " ")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Notice</span><span>{detail.notice_required ? `${detail.notice_period_days} days` : "None"}</span></div>
                        {detail.reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span>{detail.reason}</span></div>}
                        {detail.remarks && <div className="flex justify-between"><span className="text-muted-foreground">Remarks</span><span>{detail.remarks}</span></div>}
                        {detail.completed_at && <div className="flex justify-between"><span className="text-muted-foreground">Completed At</span><span>{formatDateTime(detail.completed_at)}</span></div>}
                      </CardContent>
                    </Card>

                    {/* Cancel offboarding */}
                    {isActive && (
                      <Card className="border-red-200">
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm text-red-700">Danger Zone</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          {!showCancelConfirm ? (
                            <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(true)}>
                              <XCircle className="h-4 w-4 mr-1" /> Cancel Offboarding
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              <Textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Reason for cancellation..."
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                                  Confirm Cancel
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)}>
                                  Back
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* AUDIT TAB */}
              <TabsContent value="audit">
                <ScrollArea className="max-h-[38vh]">
                  {detail.audit_log.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No audit entries.</p>
                  ) : (
                    <div className="relative border-l-2 border-muted ml-3 space-y-4">
                      {detail.audit_log.map((entry) => (
                        <div key={entry.id} className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-muted" />
                          <p className="text-sm font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{entry.details}</p>
                          {entry.previous_value && (
                            <p className="text-xs text-muted-foreground">
                              Changed: {entry.previous_value} &rarr; {entry.new_value}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDateTime(entry.created_at)} &middot; by {entry.performed_by === "system" ? "System" : entry.performed_by}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Footer actions */}
            {isActive && (
              <div className="border-t px-6 py-3 flex justify-end">
                <Button
                  variant="destructive"
                  disabled={!canComplete || completeMutation.isPending}
                  onClick={() => completeMutation.mutate()}
                >
                  {completeMutation.isPending ? "Completing..." : "Complete Offboarding"}
                  {!canComplete && <span className="ml-2 text-xs opacity-70">({days} days left)</span>}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN PAGE ====================

export default function Offboarding() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);

  // Fetch offboarding records
  const { data: records = [], isLoading } = useQuery<OffboardingRecord[]>({
    queryKey: ["/api/offboarding"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/offboarding");
      return res.json();
    },
  });

  // Fetch employees for initiate dialog
  const { data: employees = [] } = useQuery<EmpOption[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          r.first_name.toLowerCase().includes(s) ||
          r.last_name.toLowerCase().includes(s) ||
          r.emp_id.toLowerCase().includes(s) ||
          r.department.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [records, statusFilter, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const all = records;
    return {
      total: all.length,
      inNotice: all.filter((r) => r.status === "in_notice").length,
      initiated: all.filter((r) => r.status === "initiated").length,
      completed: all.filter((r) => r.status === "completed").length,
      dueSoon: all.filter((r) => {
        if (r.status !== "in_notice" && r.status !== "initiated") return false;
        return daysUntil(r.exit_date) <= 7 && daysUntil(r.exit_date) >= 0;
      }).length,
    };
  }, [records]);

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Offboarding</h1>
          <p className="text-sm text-muted-foreground">Manage employee exits, notice periods, and handovers.</p>
        </div>
        <Button variant="destructive" onClick={() => setInitiateOpen(true)}>
          <LogOut className="h-4 w-4 mr-2" /> Initiate Offboarding
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Timer className="h-5 w-5 text-yellow-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inNotice + stats.initiated}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.dueSoon}</p>
              <p className="text-xs text-muted-foreground">Due in 7 days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, ID, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="initiated">Initiated</SelectItem>
            <SelectItem value="in_notice">In Notice</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <LogOut className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">No offboarding records</p>
            <p className="text-sm">
              {records.length === 0 ? "Initiate an offboarding to get started." : "No records match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Exit Date</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const days = daysUntil(r.exit_date);
                const progress = r.total_tasks > 0 ? Math.round((r.done_tasks / r.total_tasks) * 100) : 0;
                const isActive = r.status === "initiated" || r.status === "in_notice";

                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailEmployeeId(r.employee_id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{r.first_name[0]}{r.last_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                          <p className="text-xs text-muted-foreground">{r.emp_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.department}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeBadge[r.offboarding_type]?.className || ""}>
                        {typeBadge[r.offboarding_type]?.label || r.offboarding_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(r.exit_date)}</TableCell>
                    <TableCell>
                      {isActive ? (
                        <span className={`text-sm font-medium ${
                          days <= 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : ""
                        }`}>
                          {days <= 0 ? "Past due" : `${days}d`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{r.done_tasks}/{r.total_tasks}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge[r.status]?.className || ""}>
                        {statusBadge[r.status]?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailEmployeeId(r.employee_id)}
                      >
                        View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <InitiateDialog
        open={initiateOpen}
        onClose={() => setInitiateOpen(false)}
        employees={employees}
      />
      <DetailDialog
        open={!!detailEmployeeId}
        onClose={() => setDetailEmployeeId(null)}
        employeeId={detailEmployeeId}
        employees={employees}
      />
    </Layout>
  );
}
