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
import { Progress } from "@/components/ui/progress";
import {
  Calendar, Clock, Plus, Search, CheckCircle, XCircle, AlertTriangle,
  ClipboardList, Users, Shield, Ban, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ==================== TYPES ====================

interface LeaveTypeRow { id: string; policy_id: string; name: string; paid: boolean; accrual_type: string; accrual_rate: string | null; max_balance: number; carry_forward_allowed: boolean; requires_document: boolean; requires_approval: boolean; auto_approve_rules: any; hr_approval_required: boolean; min_days: number | null; max_days_per_request: number | null; blocked_during_notice: boolean; color: string; balance?: string; used?: string; }
interface LeaveBalance { id: string; employee_id: string; leave_type_id: string; balance: string; used: string; type_name: string; paid: boolean; max_balance: number; color: string; accrual_type: string; policy_name: string; }
interface MyRequest { id: string; leave_type_id: string; start_date: string; end_date: string; day_type: string; total_days: string; reason: string | null; status: string; applied_at: string; decided_at: string | null; rejection_reason: string | null; type_name: string; color: string; paid: boolean; }
interface AllRequest extends MyRequest { employee_id: string; first_name: string; last_name: string; emp_code: string; department: string; avatar: string | null; }
interface PendingApproval { id: string; leave_request_id: string; approver_id: string; approver_role: string; status: string; step_order: number; employee_id: string; start_date: string; end_date: string; day_type: string; total_days: string; reason: string | null; request_status: string; applied_at: string; type_name: string; color: string; paid: boolean; first_name: string; last_name: string; emp_code: string; department: string; avatar: string | null; }
interface LeavePolicy { id: string; name: string; applicable_departments: string[]; applicable_employment_types: string[]; effective_from: string; effective_to: string | null; is_active: boolean; type_count: number; }
interface Stats { pendingRequests: number; onLeaveToday: number; approvedThisMonth: number; activePolicies: number; }
interface CalendarEvent { id: string; employee_id: string; start_date: string; end_date: string; day_type: string; total_days: string; status: string; type_name: string; color: string; first_name: string; last_name: string; department: string; avatar: string | null; }

// ==================== HELPERS ====================

const statusBadge: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ==================== APPLY LEAVE DIALOG ====================

function ApplyLeaveDialog({ open, onClose, employeeId }: { open: boolean; onClose: () => void; employeeId: string | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", dayType: "full", reason: "" });
  const [loading, setLoading] = useState(false);

  const { data: leaveTypes = [], isError: typesError } = useQuery<LeaveTypeRow[]>({
    queryKey: ["/api/leave/types-for-employee", employeeId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/leave/types-for-employee/${employeeId}`);
      const data = await r.json();
      // Dev-mode diagnostic: verify data shape
      if (import.meta.env.DEV) {
        if (!Array.isArray(data)) console.warn("[Leave] types-for-employee returned non-array:", data);
        else {
          console.log(`[Leave] Fetched ${data.length} leave types for employee ${employeeId}:`, data.map((t: any) => `${t.name} (bal:${t.balance}, policy:${t.policy_name || t.policy_id})`));
          const withoutBalance = data.filter((t: any) => t.balance === undefined || t.balance === null);
          if (withoutBalance.length > 0) console.warn("[Leave] Types with missing balance:", withoutBalance.map((t: any) => t.name));
        }
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: !!employeeId && open,
  });

  useEffect(() => { if (open) setForm({ leaveTypeId: "", startDate: "", endDate: "", dayType: "full", reason: "" }); }, [open]);

  const selected = leaveTypes.find(t => t.id === form.leaveTypeId);
  const dayCount = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate + "T00:00:00"), e = new Date(form.endDate + "T00:00:00");
    if (e < s) return 0;
    let c = 0; const cur = new Date(s);
    while (cur <= e) { if (cur.getDay() !== 0 && cur.getDay() !== 6) c++; cur.setDate(cur.getDate() + 1); }
    return form.dayType === "half" ? c * 0.5 : c;
  }, [form.startDate, form.endDate, form.dayType]);

  const handleSubmit = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) { toast.error("Fill all required fields"); return; }
    if (form.endDate < form.startDate) { toast.error("End date cannot be before start date"); return; }
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/leave/request", { ...form, totalDays: dayCount });
      const data = await result.json();
      toast.success(data.autoApproved ? "Leave auto-approved!" : "Leave request submitted for approval");
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      onClose();
    } catch (err: any) { toast.error(err?.message || "Failed to submit request"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> Apply for Leave</DialogTitle>
          <DialogDescription>Submit a leave request for approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            {!employeeId ? (
              <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> Your account is not linked to an employee record. Contact HR.</p>
              </div>
            ) : typesError ? (
              <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> Failed to load leave types. Please try again or contact HR.</p>
              </div>
            ) : leaveTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> No leave types available. HR needs to create a policy with leave types for your role/department.</p>
              </div>
            ) : (
              <Select value={form.leaveTypeId} onValueChange={v => setForm({ ...form, leaveTypeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select leave type..." /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(t => {
                    const isUnpaid = t.paid === false;
                    const bal = parseFloat(t.balance || "0");
                    const label = isUnpaid ? "Unlimited" : `Bal: ${bal}${t.max_balance != null ? ` / ${t.max_balance}` : ""}`;
                    return (
                      <SelectItem key={t.id} value={t.id} title={`${t.name} • ${t.paid ? "Paid" : "Unpaid (LWOP)"} • ${isUnpaid ? "Unlimited" : `Balance: ${bal}/${t.max_balance}`}`}>
                        <span className="flex items-center gap-2 truncate">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="truncate">{t.name} {isUnpaid ? "(Unpaid)" : ""} — {label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} min={form.startDate || undefined} /></div>
          </div>
          <div className="space-y-2">
            <Label>Day Type</Label>
            <Select value={form.dayType} onValueChange={v => setForm({ ...form, dayType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="full">Full Day</SelectItem><SelectItem value="half">Half Day</SelectItem></SelectContent>
            </Select>
          </div>
          {dayCount > 0 && (
            <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-700">Total: {dayCount} day{dayCount !== 1 ? "s" : ""}</p>
              {selected && selected.paid && parseFloat(selected.balance || "0") < dayCount && (
                <p className="text-xs text-red-600 mt-1">Insufficient balance ({selected.balance} available)</p>
              )}
              {selected && !selected.paid && (
                <p className="text-xs text-muted-foreground mt-1">Unpaid leave (LWOP) — no balance deduction</p>
              )}
            </div>
          )}
          <div className="space-y-2"><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." rows={2} /></div>
          {selected?.requires_document && (
            <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> This leave type requires a supporting document.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || dayCount <= 0 || !form.leaveTypeId}>{loading ? "Submitting..." : "Submit Request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====================================================================
// MAIN PAGE — Three fixed leave types: Earned Leave, LWOP, Bereavement
// ====================================================================

export default function LeaveCalendar() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("my-requests");
  const [applyOpen, setApplyOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [approvalRemarks, setApprovalRemarks] = useState<Record<string, string>>({});
  const [yearEndYear, setYearEndYear] = useState(() => new Date().getFullYear());
  const [balanceEmployeeId, setBalanceEmployeeId] = useState<string | null>(null);
  const [balanceDialog, setBalanceDialog] = useState<{ open: boolean; mode: "set" | "add"; balance?: LeaveBalance }>({ open: false, mode: "set" });
  const [balanceForm, setBalanceForm] = useState({ value: "", reason: "" });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data: me } = useQuery<any>({ queryKey: ["/api/auth/me"], queryFn: async () => { try { const r = await apiRequest("GET", "/api/auth/me"); return r.json(); } catch { return null; } } });
  const employeeId = me?.employeeId || me?.employee_id || null;
  const role: string = (me?.role || "employee").toString().toLowerCase();
  const roles: string[] = Array.isArray(me?.roles) ? me.roles.map((r: unknown) => String(r).toLowerCase()) : [];
  const isHR = role === "hr" || role === "admin" || roles.includes("hr") || roles.includes("admin");
  const isManager = role === "manager" || roles.includes("manager");

  // ---- Queries scoped by role ----
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/leave/stats"], queryFn: async () => (await apiRequest("GET", "/api/leave/stats")).json() });

  // Employee: own requests only
  const { data: myRequests = [] } = useQuery<MyRequest[]>({
    queryKey: ["/api/leave/my-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/my-requests")).json(),
    enabled: !!employeeId,
  });

  // Employee: own balances
  const { data: myBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances", employeeId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/balances/${employeeId}`)).json(),
    enabled: !!employeeId,
  });

  // Pending approvals assigned to this user (any role — e.g. Neo as reporting manager can approve)
  const { data: pendingApprovals = [] } = useQuery<PendingApproval[]>({
    queryKey: ["/api/leave/pending-approvals"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/pending-approvals")).json(),
    enabled: !!employeeId,
  });
  const hasApprovals = pendingApprovals.length > 0;
  const canSeeApprovals = isManager || isHR || hasApprovals;

  // Manager: team requests; HR/Admin: all requests (or user has manager/hr in roles)
  const { data: allRequests = [] } = useQuery<AllRequest[]>({
    queryKey: ["/api/leave/requests"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/requests")).json(),
    enabled: isManager || isHR,
  });

  // HR: single standard policy (three types: Earned, LWOP, Bereavement)
  const { data: policies = [] } = useQuery<LeavePolicy[]>({
    queryKey: ["/api/leave/policies"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/policies")).json(),
    enabled: isHR,
  });
  const firstPolicyId = policies[0]?.id ?? null;
  const { data: standardPolicyDetail } = useQuery<any>({
    queryKey: ["/api/leave/policies", firstPolicyId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/policies/${firstPolicyId}`)).json(),
    enabled: !!firstPolicyId && isHR,
  });
  const leaveTypesList = standardPolicyDetail?.leave_types ?? [];

  const { data: employeesList = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => (await apiRequest("GET", "/api/employees")).json(),
    enabled: isHR && (activeTab === "balances"),
  });
  const { data: hrBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances", balanceEmployeeId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/balances/${balanceEmployeeId}`)).json(),
    enabled: isHR && !!balanceEmployeeId,
  });

  const calendarFrom = useMemo(() => {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
    return `${y}-${String(m + 1).padStart(2, "0")}-01`;
  }, [calendarMonth]);
  const calendarTo = useMemo(() => {
    const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  }, [calendarMonth]);
  const { data: calendarEvents = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/leave/calendar", calendarFrom, calendarTo],
    queryFn: async () => (await apiRequest("GET", `/api/leave/calendar?from=${calendarFrom}&to=${calendarTo}`)).json(),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, action, remarks }: { approvalId: string; action: "approve" | "reject"; remarks?: string }) => {
      await apiRequest("POST", `/api/leave/${action}/${approvalId}`, { remarks });
    },
    onSuccess: () => { toast.success("Action completed"); queryClient.invalidateQueries({ queryKey: ["/api/leave"] }); },
    onError: (err: any) => toast.error(err?.message || "Action failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => { await apiRequest("POST", `/api/leave/request/${requestId}/cancel`); },
    onSuccess: () => { toast.success("Request cancelled"); queryClient.invalidateQueries({ queryKey: ["/api/leave"] }); },
    onError: (err: any) => toast.error(err?.message || "Failed to cancel"),
  });

  const yearEndMutation = useMutation({
    mutationFn: async (year: number) => {
      const r = await apiRequest("POST", "/api/leave/process-year-end", { year });
      return r.json() as Promise<{ processed: number; skipped: number; bereavementProcessed: number; errors?: string[] }>;
    },
    onSuccess: (data) => {
      const msg = [
        data.processed != null && `EL: ${data.processed} reset to 0`,
        data.bereavementProcessed != null && data.bereavementProcessed > 0 && `Bereavement: ${data.bereavementProcessed} set to 2`,
      ].filter(Boolean).join("; ");
      toast.success(msg ? `Year-end complete. ${msg}` : "Year-end complete.");
      if (data.errors?.length) data.errors.forEach((e: string) => toast.warning(e));
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => toast.error(err?.message || "Year-end processing failed"),
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ balanceId, newBalance, reason }: { balanceId: string; newBalance: number; reason: string }) => {
      await apiRequest("PATCH", `/api/leave/balances/${balanceId}/adjust`, { newBalance, reason });
    },
    onSuccess: () => { toast.success("Balance updated"); queryClient.invalidateQueries({ queryKey: ["/api/leave"] }); queryClient.invalidateQueries({ queryKey: ["/api/leave/balances", balanceEmployeeId] }); setBalanceDialog({ open: false, mode: "set" }); setBalanceForm({ value: "", reason: "" }); },
    onError: (err: any) => toast.error(err?.message || "Failed to update balance"),
  });
  const addBalanceMutation = useMutation({
    mutationFn: async ({ employeeId, leaveTypeId, daysToAdd, reason }: { employeeId: string; leaveTypeId: string; daysToAdd: number; reason: string }) => {
      await apiRequest("POST", "/api/leave/balances/add", { employeeId, leaveTypeId, daysToAdd, reason });
    },
    onSuccess: () => { toast.success("Days added"); queryClient.invalidateQueries({ queryKey: ["/api/leave"] }); queryClient.invalidateQueries({ queryKey: ["/api/leave/balances", balanceEmployeeId] }); setBalanceDialog({ open: false, mode: "add" }); setBalanceForm({ value: "", reason: "" }); },
    onError: (err: any) => toast.error(err?.message || "Failed to add balance"),
  });
  const initializeBalancesMutation = useMutation({
    mutationFn: async (empId: string) => { await apiRequest("POST", `/api/leave/balances/initialize/${empId}`); },
    onSuccess: (empId) => { toast.success("Balances initialized"); queryClient.invalidateQueries({ queryKey: ["/api/leave/balances", empId] }); queryClient.invalidateQueries({ queryKey: ["/api/leave"] }); },
    onError: (err: any) => toast.error(err?.message || "Failed to initialize balances"),
  });

  // Filter for all requests (manager/HR view)
  const filteredAllRequests = useMemo(() => {
    return allRequests.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return r.first_name?.toLowerCase().includes(s) || r.last_name?.toLowerCase().includes(s) || r.type_name?.toLowerCase().includes(s) || r.department?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allRequests, statusFilter, searchTerm]);

  // Filter for my requests (employee view)
  const filteredMyRequests = useMemo(() => {
    return myRequests.filter(r => statusFilter === "all" || r.status === statusFilter);
  }, [myRequests, statusFilter]);

  // Set default tab: if user has pending approvals to act on, show that first
  useEffect(() => {
    if (hasApprovals) setActiveTab("approvals");
    else if (role === "employee") setActiveTab("my-requests");
    else if (isManager) setActiveTab("team-requests");
    else if (isHR) setActiveTab("all-requests");
  }, [role, isManager, isHR, hasApprovals]);

  return (
    <Layout>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-sm text-muted-foreground">
            {isHR ? "Manage all leave requests, approvals, and policies." :
             isManager ? "Review team leave requests and manage approvals." :
             "Apply for leave and track your requests."}
          </p>
        </div>
        <div className="flex gap-2">
          {isHR && (
            <Button
              variant="outline"
              onClick={() => {
                const year = new Date().getFullYear();
                if (window.confirm(`Run year-end leave reset for ${year}? Earned Leave will be set to 0 and Bereavement to 2. Add balances (e.g. carry forward) manually in Balances tab if needed.`)) {
                  yearEndMutation.mutate(year);
                }
              }}
              disabled={yearEndMutation.isPending}
            >
              {yearEndMutation.isPending ? "Processing…" : "Process Year-End"}
            </Button>
          )}
          {employeeId && <Button onClick={() => setApplyOpen(true)}><Plus className="h-4 w-4 mr-2" /> Apply Leave</Button>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Clock className="h-5 w-5 text-yellow-700" /></div><div><p className="text-2xl font-bold">{canSeeApprovals && pendingApprovals.length > 0 ? pendingApprovals.length : (stats?.pendingRequests ?? 0)}</p><p className="text-xs text-muted-foreground">{canSeeApprovals ? "Pending Approvals" : "Pending"}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="h-5 w-5 text-blue-700" /></div><div><p className="text-2xl font-bold">{stats?.onLeaveToday || 0}</p><p className="text-xs text-muted-foreground">On Leave Today</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-700" /></div><div><p className="text-2xl font-bold">{stats?.approvedThisMonth || 0}</p><p className="text-xs text-muted-foreground">This Month</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Shield className="h-5 w-5 text-purple-700" /></div><div><p className="text-2xl font-bold">3</p><p className="text-xs text-muted-foreground">Leave Types</p></div></CardContent></Card>
      </div>

      {/* Employee balance strip — Earned (12, carry 6), LWOP (unlimited), Bereavement (2) */}
      {myBalances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {myBalances.map(b => {
            const isUnpaid = b.paid === false;
            const bal = parseFloat(b.balance ?? "0"), used = parseFloat(b.used ?? "0"), max = b.max_balance ?? 0;
            const pct = !isUnpaid && max > 0 ? Math.round(((max - bal) / max) * 100) : 0;
            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: b.color }} />
                <CardContent className="p-3">
                  <p className="text-xs font-medium truncate">{b.type_name}</p>
                  {isUnpaid ? (
                    <>
                      <p className="text-lg font-bold text-muted-foreground">Unlimited</p>
                      <p className="text-[10px] text-muted-foreground">Unpaid (LWOP)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold">{bal}</p>
                      <p className="text-[10px] text-muted-foreground">Used: {used}{max > 0 ? ` / ${max}` : ""}</p>
                      {max > 0 && <Progress value={pct} className="h-1 mt-1" />}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {/* Calendar: all employees' time off (synced with leave system) */}
          <TabsTrigger value="calendar"><Calendar className="h-4 w-4 mr-1.5" /> Calendar</TabsTrigger>
          {/* EMPLOYEE: My Requests tab (always visible) */}
          <TabsTrigger value="my-requests">My Requests</TabsTrigger>

          {/* MANAGER / HR: Approvals tab */}
          {canSeeApprovals && (
            <TabsTrigger value="approvals">
              Approvals {pendingApprovals.length > 0 && <Badge variant="destructive" className="ml-1.5 h-5 text-[10px] px-1.5">{pendingApprovals.length}</Badge>}
            </TabsTrigger>
          )}

          {/* MANAGER: Team Requests */}
          {isManager && <TabsTrigger value="team-requests">Team Requests</TabsTrigger>}

          {/* HR/ADMIN: All Requests */}
          {isHR && <TabsTrigger value="all-requests">All Requests</TabsTrigger>}

          {/* HR/ADMIN: Leave Types (read-only) */}
          {isHR && <TabsTrigger value="leave-types">Leave Types</TabsTrigger>}
          {/* HR/ADMIN: Year-end reset + Balance management */}
          {isHR && <TabsTrigger value="year-end">Year-End</TabsTrigger>}
          {isHR && <TabsTrigger value="balances">Balances</TabsTrigger>}
        </TabsList>

        {/* ============ CALENDAR — All employees' approved time off (synced with leave) ============ */}
        <TabsContent value="calendar" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[160px] text-center">
                {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Approved leave for all employees. Synced with Leave Management.</p>
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                  <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                ))}
                {(() => {
                  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
                  const first = new Date(y, m, 1);
                  const last = new Date(y, m + 1, 0);
                  const startPad = (first.getDay() + 6) % 7;
                  const daysInMonth = last.getDate();
                  const totalSlots = 42;
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < totalSlots; i++) {
                    if (i < startPad || i >= startPad + daysInMonth) {
                      cells.push(<div key={`cell-${i}`} className="min-h-[80px] bg-muted/30 p-1.5" />);
                    } else {
                      const d = i - startPad + 1;
                      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const dayEvents = calendarEvents.filter((ev: CalendarEvent) => ev.start_date <= dateStr && ev.end_date >= dateStr);
                      cells.push(
                        <div key={`cell-${i}`} className="min-h-[80px] bg-background p-1.5 border-b border-r border-border/50">
                          <span className="text-xs font-medium text-muted-foreground">{d}</span>
                          <div className="mt-1 space-y-0.5">
                            {dayEvents.map(ev => (
                              <div key={ev.id} className="text-[10px] truncate rounded px-1 py-0.5" style={{ backgroundColor: `${ev.color}20`, color: ev.color, borderLeft: `2px solid ${ev.color}` }} title={`${ev.first_name} ${ev.last_name} — ${ev.type_name}`}>
                                {ev.first_name} {ev.last_name?.charAt(0)}. — {ev.type_name}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  return cells;
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ MY REQUESTS (Employee view — own requests, status only, no approval controls) ============ */}
        <TabsContent value="my-requests">
          <div className="flex gap-3 mb-4 mt-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
          </div>
          {filteredMyRequests.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Calendar className="h-12 w-12 mb-3 opacity-40" /><p className="font-medium">No leave requests</p><p className="text-sm">Apply for leave to get started.</p></CardContent></Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>Applied</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredMyRequests.map(r => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>{r.type_name}</Badge></TableCell>
                      <TableCell className="text-sm">{formatDate(r.start_date)}</TableCell>
                      <TableCell className="text-sm">{formatDate(r.end_date)}</TableCell>
                      <TableCell className="text-sm font-medium">{r.total_days}{r.day_type === "half" ? " (H)" : ""}</TableCell>
                      <TableCell><Badge className={statusBadge[r.status]?.className || ""}>{statusBadge[r.status]?.label || r.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(r.applied_at)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <Button variant="ghost" size="sm" className="text-red-600 h-7 text-xs" onClick={() => cancelMutation.mutate(r.id)}>Cancel</Button>
                        )}
                        {r.status === "rejected" && r.rejection_reason && (
                          <span className="text-xs text-red-600 truncate max-w-[120px] block">{r.rejection_reason}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ============ APPROVALS (Manager/HR or anyone with pending items assigned to them) ============ */}
        {canSeeApprovals && (
          <TabsContent value="approvals">
            <div className="space-y-3 mt-2">
              {pendingApprovals.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><CheckCircle className="h-12 w-12 mb-3 opacity-40" /><p className="font-medium">No pending approvals</p></CardContent></Card>
              ) : (
                pendingApprovals.map(a => (
                  <Card key={a.id} className="overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: a.color }} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10"><AvatarFallback className="text-sm">{a.first_name?.[0]}{a.last_name?.[0]}</AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium">{a.first_name} {a.last_name}</p>
                            <p className="text-xs text-muted-foreground">{a.department} &middot; {a.emp_code}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" style={{ borderColor: a.color, color: a.color }} className="text-xs">{a.type_name}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(a.start_date)} - {formatDate(a.end_date)}</span>
                              <span className="text-xs font-medium">{a.total_days}d ({a.day_type})</span>
                            </div>
                            {a.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{a.reason}"</p>}
                          </div>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0">
                          {a.approver_role === "manager" ? "Manager" : "HR"} Step {a.step_order}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Input className="flex-1 h-8 text-xs" placeholder="Remarks (optional)..." value={approvalRemarks[a.id] || ""} onChange={e => setApprovalRemarks(prev => ({ ...prev, [a.id]: e.target.value }))} />
                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ approvalId: a.id, action: "approve", remarks: approvalRemarks[a.id] })}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ approvalId: a.id, action: "reject", remarks: approvalRemarks[a.id] })}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        {/* ============ TEAM REQUESTS (Manager: direct reports only) ============ */}
        {isManager && (
          <TabsContent value="team-requests">
            <div className="flex flex-col sm:flex-row gap-3 mb-4 mt-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search team member, type..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
            </div>
            {filteredAllRequests.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Users className="h-12 w-12 mb-3 opacity-40" /><p>No team leave requests found.</p></CardContent></Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>Applied</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredAllRequests.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{r.first_name?.[0]}{r.last_name?.[0]}</AvatarFallback></Avatar>
                            <div><p className="text-sm font-medium">{r.first_name} {r.last_name}</p><p className="text-[10px] text-muted-foreground">{r.department}</p></div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>{r.type_name}</Badge></TableCell>
                        <TableCell className="text-sm">{formatDate(r.start_date)}</TableCell>
                        <TableCell className="text-sm">{formatDate(r.end_date)}</TableCell>
                        <TableCell className="text-sm font-medium">{r.total_days}{r.day_type === "half" ? " (H)" : ""}</TableCell>
                        <TableCell><Badge className={statusBadge[r.status]?.className || ""}>{statusBadge[r.status]?.label || r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(r.applied_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ============ ALL REQUESTS (HR/Admin: full dashboard) ============ */}
        {isHR && (
          <TabsContent value="all-requests">
            <div className="flex flex-col sm:flex-row gap-3 mb-4 mt-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search by name, type, department..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
            </div>
            {filteredAllRequests.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Calendar className="h-12 w-12 mb-3 opacity-40" /><p>No leave requests found.</p></CardContent></Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>Applied</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredAllRequests.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{r.first_name?.[0]}{r.last_name?.[0]}</AvatarFallback></Avatar>
                            <div><p className="text-sm font-medium">{r.first_name} {r.last_name}</p><p className="text-[10px] text-muted-foreground">{r.department}</p></div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>{r.type_name}</Badge></TableCell>
                        <TableCell className="text-sm">{formatDate(r.start_date)}</TableCell>
                        <TableCell className="text-sm">{formatDate(r.end_date)}</TableCell>
                        <TableCell className="text-sm font-medium">{r.total_days}{r.day_type === "half" ? " (H)" : ""}</TableCell>
                        <TableCell><Badge className={statusBadge[r.status]?.className || ""}>{statusBadge[r.status]?.label || r.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(r.applied_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ============ LEAVE TYPES (HR read-only: Earned Leave, LWOP, Bereavement) ============ */}
        {isHR && (
          <TabsContent value="leave-types" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Standard Leave Types</CardTitle>
                <CardDescription>Three fixed types. Run migration 0021_standard_leave_policy.sql if missing.</CardDescription>
              </CardHeader>
              <CardContent>
                {leaveTypesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No leave types found. Run migration 0021_standard_leave_policy.sql to create Earned Leave, LWOP, and Bereavement.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Type</TableHead><TableHead>Paid</TableHead><TableHead>Accrual</TableHead><TableHead>Max / Carry</TableHead><TableHead>Approval</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {leaveTypesList.map((lt: any) => (
                          <TableRow key={lt.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: lt.color || "#3b82f6" }} />
                                <span className="text-sm font-medium">{lt.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{lt.paid ? <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Paid</Badge> : <Badge variant="outline" className="text-[10px]">Unpaid (LWOP)</Badge>}</TableCell>
                            <TableCell className="text-xs capitalize">{lt.accrual_type === "none" ? "—" : lt.accrual_type}</TableCell>
                            <TableCell className="text-sm">{lt.paid ? `${lt.max_balance}${lt.carry_forward_allowed ? `, carry ${lt.max_carry_forward ?? 6}` : ""}` : "Unlimited"}</TableCell>
                            <TableCell className="text-xs">{!lt.requires_approval ? "Auto" : lt.hr_approval_required ? "Mgr + HR" : "Manager"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ YEAR-END (HR: reset EL to 0, Bereavement to 2) ============ */}
        {isHR && (
          <TabsContent value="year-end" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Year-End Leave Reset</CardTitle>
                <CardDescription>Resets Earned Leave to 0 and Bereavement to 2 for the selected year. Add balances (e.g. carry forward or encash adjustments) manually in the Balances tab.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Label className="text-sm font-medium">Year</Label>
                <Select value={String(yearEndYear)} onValueChange={v => setYearEndYear(parseInt(v, 10))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  onClick={() => {
                    if (window.confirm(`Run year-end leave reset for ${yearEndYear}? Earned Leave will be set to 0 and Bereavement to 2. Add balances manually in Balances tab if needed.`)) {
                      yearEndMutation.mutate(yearEndYear);
                    }
                  }}
                  disabled={yearEndMutation.isPending}
                >
                  {yearEndMutation.isPending ? "Processing…" : "Process Year-End"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ BALANCES (HR: set balance / add days) ============ */}
        {isHR && (
          <TabsContent value="balances" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employee Leave Balances</CardTitle>
                <CardDescription>Select an employee to view leave balances. Set balance and Add days are for Earned Leave only (carry forward, encashment). Bereavement and LWOP are read-only—no additions or edits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-medium">Employee</Label>
                  <Select value={balanceEmployeeId ?? ""} onValueChange={v => setBalanceEmployeeId(v || null)}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} {emp.emp_code ? `(${emp.emp_code})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {balanceEmployeeId && (
                  hrBalances.length === 0 ? (
                    <div className="space-y-2 py-4">
                      <p className="text-sm text-muted-foreground">No leave types found. Run migration 0021 to create the standard policy.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {hrBalances.some((b: LeaveBalance) => !b.id) && (
                        <p className="text-sm text-muted-foreground">Some balance rows are missing. Initialize to create them, then use &quot;Set balance&quot; or &quot;Add days&quot; for Earned Leave.</p>
                      )}
                      {hrBalances.some((b: LeaveBalance) => !b.id) && (
                        <Button size="sm" onClick={() => initializeBalancesMutation.mutate(balanceEmployeeId)} disabled={initializeBalancesMutation.isPending}>{initializeBalancesMutation.isPending ? "Initializing…" : "Initialize balances"}</Button>
                      )}
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Leave type</TableHead><TableHead>Current balance</TableHead><TableHead>Used</TableHead><TableHead className="w-[200px]">Actions</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {hrBalances.map((b: LeaveBalance) => {
                              const isEarnedLeave = (b.type_name ?? "").toLowerCase().includes("earned");
                              const balanceNum = typeof b.balance === "number" ? b.balance : parseFloat(String(b.balance ?? 0));
                              const usedNum = typeof b.used === "number" ? b.used : parseFloat(String(b.used ?? 0));
                              const showBalance = b.paid === false ? "Unlimited" : balanceNum;
                              return (
                                <TableRow key={b.id ?? b.leave_type_id}>
                                  <TableCell className="font-medium">{b.type_name ?? b.leave_type_id}</TableCell>
                                  <TableCell>{showBalance}</TableCell>
                                  <TableCell>{b.paid === false ? "—" : usedNum}</TableCell>
                                  <TableCell className="flex gap-2">
                                    {isEarnedLeave ? (
                                      <>
                                        <Button size="sm" variant="outline" disabled={!b.id} onClick={() => { setBalanceDialog({ open: true, mode: "set", balance: b }); setBalanceForm({ value: String(balanceNum), reason: "" }); }} title={!b.id ? "Initialize balances first" : undefined}>Set balance</Button>
                                        <Button size="sm" variant="outline" onClick={() => { setBalanceDialog({ open: true, mode: "add", balance: b }); setBalanceForm({ value: "", reason: "" }); }}>Add days</Button>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Balance adjust / add dialog — Earned Leave only */}
      <Dialog open={balanceDialog.open} onOpenChange={open => !open && setBalanceDialog({ open: false, mode: "set" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{balanceDialog.mode === "set" ? "Set balance (Earned Leave)" : "Add days (Earned Leave)"}</DialogTitle>
            <DialogDescription>
              {balanceDialog.mode === "set"
                ? "Set the new total Earned Leave balance. Use a reason for audit (e.g. carry forward, correction)."
                : "Add days to the current Earned Leave balance. Use a reason (e.g. carry forward, manual adjustment)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{balanceDialog.mode === "set" ? "New balance (days)" : "Days to add"}</Label>
              <Input type="number" min={balanceDialog.mode === "set" ? 0 : 0.5} step={balanceDialog.mode === "set" ? 1 : 0.5} value={balanceForm.value} onChange={e => setBalanceForm(f => ({ ...f, value: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={balanceForm.reason} onChange={e => setBalanceForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Carry forward, encash adjustment" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialog({ open: false, mode: "set" })}>Cancel</Button>
            {balanceDialog.mode === "set" && balanceDialog.balance && (
              <Button onClick={() => { const n = parseFloat(balanceForm.value); if (!Number.isNaN(n) && n >= 0 && balanceForm.reason.trim()) adjustBalanceMutation.mutate({ balanceId: balanceDialog.balance!.id, newBalance: n, reason: balanceForm.reason.trim() }); else toast.error("Enter valid balance and reason."); }} disabled={adjustBalanceMutation.isPending}>Save</Button>
            )}
            {balanceDialog.mode === "add" && balanceDialog.balance && balanceEmployeeId && (
              <Button onClick={() => { const n = parseFloat(balanceForm.value); if (!Number.isNaN(n) && n > 0 && balanceForm.reason.trim()) addBalanceMutation.mutate({ employeeId: balanceEmployeeId, leaveTypeId: balanceDialog.balance!.leave_type_id, daysToAdd: n, reason: balanceForm.reason.trim() }); else toast.error("Enter days to add and reason."); }} disabled={addBalanceMutation.isPending}>Add</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplyLeaveDialog open={applyOpen} onClose={() => setApplyOpen(false)} employeeId={employeeId} />
    </Layout>
  );
}
