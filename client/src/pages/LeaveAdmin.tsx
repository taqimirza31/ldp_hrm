import Layout from "@/components/layout/Layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Ban, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  ClipboardList, Download, LayoutDashboard, Settings, Shield, Trash2, Users, XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─────────────────────────── types ───────────────────────────
interface Stats { pendingRequests: number; onLeaveToday: number; approvedThisMonth: number; activePolicies: number; }
interface LeaveBalance { id: string; employee_id: string; leave_type_id: string; balance: string; used: string; type_name: string; paid: boolean; max_balance: number; color: string; accrual_type: string; policy_name: string; }
interface AllRequest { id: string; leave_type_id: string; start_date: string; end_date: string; day_type: string; total_days: string; reason: string | null; status: string; applied_at: string; type_name: string; color: string; employee_id: string; first_name: string; last_name: string; emp_code: string; department: string; avatar: string | null; }
interface PendingApproval { id: string; leave_request_id: string; approver_id: string; approver_role: string; status: string; step_order: number; employee_id: string; start_date: string; end_date: string; day_type: string; total_days: string; reason: string | null; request_status: string; applied_at: string; type_name: string; color: string; paid: boolean; first_name: string; last_name: string; emp_code: string; department: string; avatar: string | null; }
interface LeavePolicy { id: string; name: string; applicable_departments: string[]; applicable_employment_types: string[]; effective_from: string; effective_to: string | null; is_active: boolean; type_count: number; }
interface LeaveHoliday { id: string; date: string; name: string | null; }

type Section =
  | "overview" | "approvals" | "requests" | "balances"
  | "holidays" | "year-end" | "leave-types" | "freshteam";

// ─────────────────────────── helpers ─────────────────────────
const statusStyle: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved:  "bg-green-100 text-green-700 border-green-200",
  rejected:  "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
/** Leave balances use half-day or full-day only (.5 or 1). Round to nearest 0.5 when saving. */
function roundToHalfDay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 2) / 2;
}
/** Display balance as .5 or whole only: floor to nearest 0.5 (e.g. 1.29 → 1, 1.67 → 1.5). */
function displayBalance(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n * 2) / 2;
}
function formatBalanceDays(n: number): string {
  const x = displayBalance(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

// ─────────────────────────── main page ───────────────────────
export default function LeaveAdmin() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  // ── auth ──
  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try { const r = await apiRequest("GET", "/api/auth/me"); return r.json(); } catch { return null; }
    },
  });
  const employeeId: string | null = me?.employeeId || me?.employee_id || null;
  const role: string = (me?.role || "employee").toString().toLowerCase();
  const roles: string[] = Array.isArray(me?.roles) ? me.roles.map((r: unknown) => String(r).toLowerCase()) : [];
  const isHR    = role === "hr"      || role === "admin"   || roles.includes("hr")      || roles.includes("admin");
  const isManager = role === "manager" || roles.includes("manager");

  // ── state ──
  const [section, setSection]         = useState<Section>("overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm]   = useState("");
  const [yearEndYear, setYearEndYear] = useState(() => new Date().getFullYear());
  const [balanceEmployeeId, setBalanceEmployeeId] = useState<string | null>(null);
  const [balanceDialog, setBalanceDialog] = useState<{ open: boolean; mode: "set" | "add"; balance?: LeaveBalance }>({ open: false, mode: "set" });
  const [balanceForm, setBalanceForm] = useState({ value: "", reason: "" });
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "" });
  const [approvalRemarks, setApprovalRemarks] = useState<Record<string, string>>({});
  const [approvalOnBehalf, setApprovalOnBehalf] = useState<Record<string, boolean>>({});
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({ effectiveFrom: "", effectiveTo: "" });
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  // Year-end wizard
  const [yearEndWizard, setYearEndWizard] = useState<{
    open: boolean;
    step: 1 | 2 | 3;
    option: "continue" | "modify" | "new" | null;
    newPolicyName: string;
    newPolicyFrom: string;
    newPolicyTo: string;
    createdPolicyName: string | null;
    createdPolicyId: string | null;
  }>({ open: false, step: 1, option: null, newPolicyName: "", newPolicyFrom: "", newPolicyTo: "", createdPolicyName: null, createdPolicyId: null });
  const [wizardNewTypeForm, setWizardNewTypeForm] = useState({ name: "", paid: true, accrualType: "none" as "none" | "monthly" | "yearly", maxBalance: "12" });
  const [leaveTypeEdit, setLeaveTypeEdit] = useState<{ open: boolean; mode: "create" | "edit"; type: any }>({ open: false, mode: "edit", type: null });
  const emptyTypeForm = () => ({
    name: "", paid: true, accrualType: "none" as "none" | "monthly" | "yearly",
    accrualRate: "", maxBalance: "21", carryForwardAllowed: false, maxCarryForward: "",
    requiresDocument: false, requiresApproval: true, autoApproveEnabled: false, autoApproveMaxDays: "",
    hrApprovalRequired: false, minDays: "", maxDaysPerRequest: "", blockedDuringNotice: false, color: "#3b82f6",
  });
  const [leaveTypeForm, setLeaveTypeForm] = useState(emptyTypeForm());

  // ── queries ──
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/leave/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/stats")).json(),
  });

  const { data: pendingApprovals = [] } = useQuery<PendingApproval[]>({
    queryKey: ["/api/leave/pending-approvals"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/pending-approvals")).json(),
    enabled: !!employeeId,
  });

  const { data: allRequests = [] } = useQuery<AllRequest[]>({
    queryKey: ["/api/leave/requests"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/requests")).json(),
    enabled: isManager || isHR,
  });

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
  const createdPolicyId = yearEndWizard.createdPolicyId;
  const { data: createdPolicyDetail } = useQuery<any>({
    queryKey: ["/api/leave/policies", createdPolicyId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/policies/${createdPolicyId}`)).json(),
    enabled: !!createdPolicyId && yearEndWizard.open && isHR,
  });
  const createdPolicyTypes = createdPolicyDetail?.leave_types ?? [];

  const { data: employeesList = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => (await apiRequest("GET", "/api/employees")).json(),
    enabled: isHR,
  });

  const { data: hrBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances", balanceEmployeeId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/balances/${balanceEmployeeId}`)).json(),
    enabled: isHR && !!balanceEmployeeId,
  });

  const { data: allBalancesRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/leave/all-balances"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/all-balances")).json(),
    enabled: isHR && section === "balances",
  });

  const { data: holidays = [] } = useQuery<LeaveHoliday[]>({
    queryKey: ["/api/leave/holidays"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/holidays")).json(),
    enabled: isHR,
  });

  // ── mutations ──
  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, action, remarks, hrOverride }: { approvalId: string; action: "approve" | "reject"; remarks?: string; hrOverride?: boolean }) => {
      await apiRequest("POST", `/api/leave/${action}/${approvalId}`, { remarks, hrOverride: hrOverride === true ? true : undefined });
    },
    onSuccess: () => { toast.success("Action completed"); qc.invalidateQueries({ queryKey: ["/api/leave"] }); },
    onError: (err: any) => toast.error(err?.message || "Action failed"),
  });

  const yearEndMutation = useMutation({
    mutationFn: async ({ year, policyId }: { year: number; policyId?: string | null }) => {
      const r = await apiRequest("POST", "/api/leave/process-year-end", { year, policyId: policyId ?? undefined });
      return r.json() as Promise<{ processed: number; skipped: number; bereavementProcessed: number; errors?: string[] }>;
    },
    onSuccess: (data) => {
      const msg = [
        data.processed != null && `EL: ${data.processed} reset to 0`,
        data.bereavementProcessed != null && data.bereavementProcessed > 0 && `Bereavement: ${data.bereavementProcessed} set to 2`,
      ].filter(Boolean).join("; ");
      toast.success(msg ? `Year-end complete. ${msg}` : "Year-end complete.");
      if (data.errors?.length) data.errors.forEach((e: string) => toast.warning(e));
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => toast.error(err?.message || "Year-end processing failed"),
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ balanceId, newBalance, reason }: { balanceId: string; newBalance: number; reason: string }) => {
      await apiRequest("PATCH", `/api/leave/balances/${balanceId}/adjust`, { newBalance, reason });
    },
    onSuccess: () => {
      toast.success("Balance updated");
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/balances", balanceEmployeeId] });
      qc.invalidateQueries({ queryKey: ["/api/leave/all-balances"] });
      setBalanceDialog({ open: false, mode: "set" });
      setBalanceForm({ value: "", reason: "" });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update balance"),
  });

  const addBalanceMutation = useMutation({
    mutationFn: async ({ employeeId, leaveTypeId, daysToAdd, reason }: { employeeId: string; leaveTypeId: string; daysToAdd: number; reason: string }) => {
      await apiRequest("POST", "/api/leave/balances/add", { employeeId, leaveTypeId, daysToAdd, reason });
    },
    onSuccess: () => {
      toast.success("Days added");
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/balances", balanceEmployeeId] });
      qc.invalidateQueries({ queryKey: ["/api/leave/all-balances"] });
      setBalanceDialog({ open: false, mode: "add" });
      setBalanceForm({ value: "", reason: "" });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to add balance"),
  });

  const initializeBalancesMutation = useMutation({
    mutationFn: async (empId: string) => { await apiRequest("POST", `/api/leave/balances/initialize/${empId}`); },
    onSuccess: () => {
      toast.success("Balances initialized");
      qc.invalidateQueries({ queryKey: ["/api/leave/balances", balanceEmployeeId] });
      qc.invalidateQueries({ queryKey: ["/api/leave/all-balances"] });
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to initialize balances"),
  });

  const addHolidayMutation = useMutation({
    mutationFn: async ({ date, name }: { date: string; name: string }) => {
      const r = await apiRequest("POST", "/api/leave/holidays", { date, name: name || undefined });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error || "Failed to add holiday"); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Holiday added");
      qc.invalidateQueries({ queryKey: ["/api/leave/holidays"] });
      setHolidayForm({ date: "", name: "" });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to add holiday"),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/leave/holidays/${id}`); },
    onSuccess: () => { toast.success("Holiday removed"); qc.invalidateQueries({ queryKey: ["/api/leave/holidays"] }); },
    onError: (err: any) => toast.error(err?.message || "Failed to delete holiday"),
  });

  const migrateFromFreshTeamMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/leave/migrate-from-freshteam");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${r.status}`);
      }
      return r.json() as Promise<{ success: boolean; total: number; created: number; updated: number; skipped: number; failed: number; employeeNotFound: number; leaveTypeNotFound: number; message?: string }>;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Migrated: ${data?.created ?? 0} created, ${data?.updated ?? 0} updated.`);
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("503") || err?.message?.toLowerCase().includes("not configured")) {
        toast.error("FreshTeam is not configured. Set FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY.");
      } else {
        toast.error(err?.message || "Migration failed");
      }
    },
  });

  const syncBalancesFromFreshTeamMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/leave/sync-balances-from-freshteam");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${r.status}`);
      }
      return r.json() as Promise<{ success: boolean; employeesProcessed: number; balancesUpdated: number; skipped: number; failed: number; message?: string }>;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Synced: ${data?.balancesUpdated ?? 0} balance rows for ${data?.employeesProcessed ?? 0} employees.`);
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("503") || err?.message?.toLowerCase().includes("not configured")) {
        toast.error("FreshTeam is not configured. Set FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY.");
      } else {
        toast.error(err?.message || "Sync failed");
      }
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { effectiveFrom?: string; effectiveTo?: string } }) => {
      const r = await apiRequest("PATCH", `/api/leave/policies/${id}`, body);
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error || "Failed to update policy");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Policy dates updated");
      qc.invalidateQueries({ queryKey: ["/api/leave/policies"] });
      setPolicyDialogOpen(false);
      setEditingPolicyId(null);
    },
    onError: (err: any) => toast.error(err?.message || "Update failed"),
  });

  const updateLeaveTypeMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await apiRequest("PATCH", `/api/leave/types/${id}`, body);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error || "Failed to update leave type"); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Leave type updated");
      qc.invalidateQueries({ queryKey: ["/api/leave/policies"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/policies", firstPolicyId] });
      setLeaveTypeEdit({ open: false, mode: "edit", type: null });
    },
    onError: (err: any) => toast.error(err?.message || "Update failed"),
  });

  const createLeaveTypeMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("POST", "/api/leave/types", body);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error || "Failed to create leave type"); }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Leave type "${data.name}" created and initialized for all active employees`);
      qc.invalidateQueries({ queryKey: ["/api/leave/policies"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/policies", firstPolicyId] });
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
      setLeaveTypeEdit({ open: false, mode: "create", type: null });
    },
    onError: (err: any) => toast.error(err?.message || "Create failed"),
  });

  const deleteLeaveTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("DELETE", `/api/leave/types/${id}`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error || "Failed to delete leave type"); }
    },
    onSuccess: () => {
      toast.success("Leave type removed");
      qc.invalidateQueries({ queryKey: ["/api/leave/policies"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/policies", firstPolicyId] });
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => toast.error(err?.message || "Delete failed"),
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("POST", "/api/leave/policies", body);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.error || "Failed to create policy"); }
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`Policy "${data.name}" created`);
      qc.invalidateQueries({ queryKey: ["/api/leave/policies"] });
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
    },
    onError: (err: any) => toast.error(err?.message || "Create failed"),
  });

  // ── derived ──
  const filteredRequests = useMemo(() => {
    return allRequests.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (
          r.first_name?.toLowerCase().includes(s) ||
          r.last_name?.toLowerCase().includes(s) ||
          r.type_name?.toLowerCase().includes(s) ||
          r.department?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [allRequests, statusFilter, searchTerm]);

  const allBalancesByEmployee = useMemo(() => {
    const m = new Map<string, { employee_id: string; first_name: string; last_name: string; emp_code: string; department: string; byType: Record<string, LeaveBalance> }>();
    for (const r of allBalancesRaw) {
      if (!m.has(r.employee_id)) {
        m.set(r.employee_id, {
          employee_id: r.employee_id,
          first_name: r.first_name ?? "",
          last_name: r.last_name ?? "",
          emp_code: r.emp_code ?? "",
          department: r.department ?? "",
          byType: {},
        });
      }
      const rec = m.get(r.employee_id)!;
      rec.byType[r.leave_type_id] = {
        id: r.id,
        employee_id: r.employee_id,
        leave_type_id: r.leave_type_id,
        balance: r.balance,
        used: r.used,
        type_name: r.type_name,
        paid: r.paid,
        max_balance: 0,
        color: r.color ?? "",
        accrual_type: "",
        policy_name: "",
      };
    }
    return Array.from(m.values()).sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name));
  }, [allBalancesRaw]);

  const elTypeId = useMemo(() => leaveTypesList.find((lt: any) => /earned|annual|^el$/i.test(String(lt.name ?? "").trim()))?.id ?? null, [leaveTypesList]);

  // ── nav ──
  type NavItem = { id: Section; label: string; icon: React.ReactNode; badge?: number; hrOnly?: boolean };
  const navItems: NavItem[] = [
    { id: "overview",    label: "Overview",    icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "approvals",   label: "Approvals",   icon: <CheckCircle className="h-4 w-4" />, badge: pendingApprovals.length },
    { id: "requests",    label: "Requests",    icon: <ClipboardList className="h-4 w-4" /> },
    { id: "balances",    label: "Balances",    icon: <Users className="h-4 w-4" />, hrOnly: true },
    { id: "holidays",    label: "Holidays",    icon: <Calendar className="h-4 w-4" />, hrOnly: true },
    { id: "year-end",    label: "Year-End",    icon: <Settings className="h-4 w-4" />, hrOnly: true },
    { id: "leave-types", label: "Leave Types", icon: <Shield className="h-4 w-4" />, hrOnly: true },
    { id: "freshteam",   label: "FreshTeam",   icon: <Download className="h-4 w-4" />, hrOnly: true },
  ];
  const visibleNav = navItems.filter(n => !n.hrOnly || isHR);

  // ── section: overview ──
  const overviewSection = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Overview</h2>
        <p className="text-sm text-muted-foreground">Leave management summary.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending Approvals", value: pendingApprovals.length || stats?.pendingRequests || 0, color: "bg-yellow-100", iconColor: "text-yellow-700", icon: <CheckCircle className="h-5 w-5 text-yellow-700" /> },
          { label: "On Leave Today",    value: stats?.onLeaveToday || 0,        color: "bg-blue-100",  iconColor: "text-blue-700",   icon: <Users className="h-5 w-5 text-blue-700" /> },
          { label: "Approved This Month", value: stats?.approvedThisMonth || 0, color: "bg-green-100", iconColor: "text-green-700",  icon: <CheckCircle className="h-5 w-5 text-green-700" /> },
          { label: "Leave Types",       value: 3,                               color: "bg-purple-100", iconColor: "text-purple-700", icon: <Shield className="h-5 w-5 text-purple-700" /> },
        ].map(c => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", c.color)}>
                {c.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingApprovals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pending Approvals</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSection("approvals")}>
                View all ({pendingApprovals.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pendingApprovals.slice(0, 3).map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{a.first_name?.[0]}{a.last_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{a.first_name} {a.last_name}</p>
                    <p className="text-xs text-muted-foreground">{a.department} · {fmtDate(a.start_date)} – {fmtDate(a.end_date)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs" style={{ borderColor: a.color, color: a.color }}>{a.type_name}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── section: approvals ──
  const approvalsSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Approvals</h2>
        <p className="text-sm text-muted-foreground">Pending leave requests assigned to you for action.</p>
      </div>
      {pendingApprovals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-muted-foreground">
          <CheckCircle className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No pending approvals</p>
          <p className="text-sm mt-1">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingApprovals.map(a => (
            <Card key={a.id} className="overflow-hidden">
              <div className="h-1" style={{ backgroundColor: a.color }} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="text-sm">{a.first_name?.[0]}{a.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{a.first_name} {a.last_name}</p>
                      <p className="text-xs text-muted-foreground">{a.department} · {a.emp_code}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline" style={{ borderColor: a.color, color: a.color }} className="text-xs">
                          {a.type_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(a.start_date)} – {fmtDate(a.end_date)}
                        </span>
                        <span className="text-xs font-medium">{a.total_days}d ({a.day_type})</span>
                      </div>
                      {a.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{a.reason}"</p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 shrink-0 text-xs">
                    {a.approver_role === "manager" ? "Manager" : "HR"} Step {a.step_order}
                  </Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {isHR && a.approver_id !== employeeId && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalOnBehalf[a.id] === true}
                        onChange={e => setApprovalOnBehalf(prev => ({ ...prev, [a.id]: e.target.checked }))}
                      />
                      Record as HR override (acting on behalf of assignee)
                    </label>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1 h-8 text-xs"
                      placeholder="Remarks (optional)..."
                      value={approvalRemarks[a.id] || ""}
                      onChange={e => setApprovalRemarks(prev => ({ ...prev, [a.id]: e.target.value }))}
                    />
                    <Button
                      size="sm" className="h-8 bg-green-600 hover:bg-green-700 gap-1 text-xs"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({
                        approvalId: a.id, action: "approve",
                        remarks: approvalRemarks[a.id],
                        hrOverride: isHR && a.approver_id !== employeeId ? approvalOnBehalf[a.id] : undefined,
                      })}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm" variant="destructive" className="h-8 gap-1 text-xs"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({
                        approvalId: a.id, action: "reject",
                        remarks: approvalRemarks[a.id],
                        hrOverride: isHR && a.approver_id !== employeeId ? approvalOnBehalf[a.id] : undefined,
                      })}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ── section: requests ──
  const requestsSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">{isHR ? "All Requests" : "Team Requests"}</h2>
        <p className="text-sm text-muted-foreground">
          {isHR ? "All leave requests across the organization." : "Leave requests from your direct reports."}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search by name, type, department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-4"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No requests found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">{r.first_name?.[0]}{r.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.department}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>{r.type_name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(r.start_date)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(r.end_date)}</TableCell>
                  <TableCell className="text-sm font-medium">{r.total_days}{r.day_type === "half" ? " (H)" : ""}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs border", statusStyle[r.status] || "")}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(r.applied_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ── section: balances ──
  const balancesSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">All Employee Balances</h2>
        <p className="text-sm text-muted-foreground">
          View and adjust leave balances for all active employees. Numbers show <strong>available / used</strong> days. Set balance and Add days apply to Earned Leave only.
        </p>
      </div>
      <Card>
        <CardContent className="p-4">
          {leaveTypesList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No leave types found. Run migration 0021 to create the standard policy.
            </p>
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Employee</TableHead>
                    {leaveTypesList.map((lt: any) => (
                      <TableHead key={lt.id} className="whitespace-nowrap">
                        <span>{lt.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">avail. / used</span>
                      </TableHead>
                    ))}
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBalancesByEmployee.map((emp) => {
                    const hasMissingType = leaveTypesList.some((lt: any) => !emp.byType[lt.id]);
                    const elBalance = elTypeId ? emp.byType[elTypeId] : null;
                    const isEL = elBalance && (String(elBalance.type_name ?? "").toLowerCase().includes("earned"));
                    const balNum = elBalance && typeof elBalance.balance !== "undefined" ? displayBalance(typeof elBalance.balance === "number" ? elBalance.balance : parseFloat(String(elBalance.balance ?? 0))) : 0;
                    return (
                      <TableRow key={emp.employee_id}>
                        <TableCell className="font-medium">
                          <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                          {emp.emp_code && <span className="text-muted-foreground text-xs ml-1">({emp.emp_code})</span>}
                          {emp.department && <span className="text-muted-foreground text-xs block">{emp.department}</span>}
                        </TableCell>
                        {leaveTypesList.map((lt: any) => {
                          const b = emp.byType[lt.id];
                          if (!b) return <TableCell key={lt.id} className="text-muted-foreground">—</TableCell>;
                          if (b.paid === false) return <TableCell key={lt.id} className="whitespace-nowrap">Unlimited</TableCell>;
                          const bal = typeof b.balance === "number" ? b.balance : parseFloat(String(b.balance ?? 0));
                          const used = typeof b.used === "number" ? b.used : parseFloat(String(b.used ?? 0));
                          return (
                            <TableCell key={lt.id} className="whitespace-nowrap">
                              {formatBalanceDays(bal)} / {formatBalanceDays(used)}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {hasMissingType && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs"
                                disabled={initializeBalancesMutation.isPending}
                                onClick={() => { setBalanceEmployeeId(emp.employee_id); initializeBalancesMutation.mutate(emp.employee_id); }}
                              >
                                {initializeBalancesMutation.isPending ? "…" : "Init"}
                              </Button>
                            )}
                            {isEL && elBalance && (
                              <>
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  disabled={!elBalance.id}
                                  title={!elBalance.id ? "Initialize balances first" : undefined}
                                  onClick={() => { setBalanceEmployeeId(emp.employee_id); setBalanceDialog({ open: true, mode: "set", balance: elBalance }); setBalanceForm({ value: String(balNum), reason: "" }); }}
                                >
                                  Set
                                </Button>
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => { setBalanceEmployeeId(emp.employee_id); setBalanceDialog({ open: true, mode: "add", balance: elBalance }); setBalanceForm({ value: "", reason: "" }); }}
                                >
                                  Add days
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── section: holidays ──
  const holidaysSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Company Holidays</h2>
        <p className="text-sm text-muted-foreground">
          Dates excluded from leave business-day calculation.
        </p>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={holidayForm.date}
                onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name (optional)</Label>
              <Input
                placeholder="e.g. Eid"
                value={holidayForm.name}
                onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))}
                className="w-[160px]"
              />
            </div>
            <Button
              size="sm"
              disabled={!holidayForm.date || addHolidayMutation.isPending}
              onClick={() => { if (holidayForm.date) addHolidayMutation.mutate({ date: holidayForm.date, name: holidayForm.name }); }}
            >
              Add holiday
            </Button>
          </div>

          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No holidays added yet.</p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.date}</TableCell>
                      <TableCell className="text-muted-foreground">{h.name || "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                          disabled={deleteHolidayMutation.isPending}
                          onClick={() => window.confirm("Remove this holiday?") && deleteHolidayMutation.mutate(h.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── section: year-end ──
  const yearEndSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Year-End Reset</h2>
        <p className="text-sm text-muted-foreground">
          Reset Earned Leave to 0 and Bereavement to 2 at the end of the year. Use the guided wizard to choose your policy approach first.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Process Year-End</CardTitle>
          <CardDescription>
            Choose the year, then click the wizard to select a policy option before running the reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/40 rounded-lg p-4 text-sm text-muted-foreground space-y-2 border">
            <p className="font-medium text-foreground">What happens during year-end reset:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>All Earned Leave balances → 0 (carry-forward can be added manually in Balances tab)</li>
              <li>All Bereavement balances → 2 days</li>
              <li>LWOP is unlimited, not reset</li>
            </ul>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-sm font-medium">Year</Label>
            <Select value={String(yearEndYear)} onValueChange={v => setYearEndYear(parseInt(v, 10))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                const p = policies[0] as any;
                setPolicyForm(f => ({ ...f, effectiveFrom: p?.effective_from?.toString().slice(0, 10) ?? "", effectiveTo: p?.effective_to?.toString().slice(0, 10) ?? "" }));
                setYearEndWizard({ open: true, step: 1, option: null, newPolicyName: "", newPolicyFrom: `${yearEndYear + 1}-01-01`, newPolicyTo: `${yearEndYear + 1}-12-31`, createdPolicyName: null, createdPolicyId: null });
              }}
              disabled={yearEndMutation.isPending}
            >
              {yearEndMutation.isPending ? "Processing…" : "Process Year-End…"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── section: leave types ──
  const leaveTypesSection = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Leave Types</h2>
          <p className="text-sm text-muted-foreground">Add, edit or remove leave types. Changes apply to new requests immediately; accrual rate changes apply from the next accrual run.</p>
        </div>
        {firstPolicyId && (
          <Button size="sm" onClick={() => { setLeaveTypeEdit({ open: true, mode: "create", type: null }); setLeaveTypeForm(emptyTypeForm()); }}>
            + Add Leave Type
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-4">
          {leaveTypesList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No leave types found. Run migration 0021_standard_leave_policy.sql to create the standard policy.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Accrual</TableHead>
                    <TableHead>Max / Carry</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveTypesList.map((lt: any) => (
                    <TableRow key={lt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: lt.color || "#3b82f6" }} />
                          <span className="text-sm font-medium">{lt.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lt.paid
                          ? <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Paid</Badge>
                          : <Badge variant="outline" className="text-[10px]">Unpaid</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {lt.accrual_type === "none" ? "—" : `${lt.accrual_type}${lt.accrual_rate ? ` (${lt.accrual_rate}/period)` : ""}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lt.paid ? `${lt.max_balance}${lt.carry_forward_allowed ? `, carry ${lt.max_carry_forward ?? "∞"}` : ""}` : "Unlimited"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {!lt.requires_approval ? "Auto" : lt.hr_approval_required ? "Mgr + HR" : "Manager"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="sm" className="h-7 text-xs"
                            onClick={() => {
                              setLeaveTypeEdit({ open: true, mode: "edit", type: lt });
                              setLeaveTypeForm({
                                name: lt.name || "",
                                paid: lt.paid !== false,
                                accrualType: lt.accrual_type || "none",
                                accrualRate: lt.accrual_rate != null ? String(lt.accrual_rate) : "",
                                maxBalance: String(lt.max_balance ?? "21"),
                                carryForwardAllowed: !!lt.carry_forward_allowed,
                                maxCarryForward: lt.max_carry_forward != null ? String(lt.max_carry_forward) : "",
                                requiresDocument: !!lt.requires_document,
                                requiresApproval: lt.requires_approval !== false,
                                autoApproveEnabled: !!(lt.auto_approve_rules?.maxDays),
                                autoApproveMaxDays: lt.auto_approve_rules?.maxDays != null ? String(lt.auto_approve_rules.maxDays) : "",
                                hrApprovalRequired: !!lt.hr_approval_required,
                                minDays: lt.min_days != null ? String(lt.min_days) : "",
                                maxDaysPerRequest: lt.max_days_per_request != null ? String(lt.max_days_per_request) : "",
                                blockedDuringNotice: !!lt.blocked_during_notice,
                                color: lt.color || "#3b82f6",
                              });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                            disabled={deleteLeaveTypeMutation.isPending}
                            title={lt.has_requests ? "Cannot remove: leave requests reference this type" : "Remove leave type"}
                            onClick={() => {
                              if (window.confirm(`Remove leave type "${lt.name}"? This cannot be undone. Existing leave requests will keep their reference.`)) {
                                deleteLeaveTypeMutation.mutate(lt.id);
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── section: freshteam ──
  const freshteamSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">FreshTeam Sync</h2>
        <p className="text-sm text-muted-foreground">
          Import and sync leave data from FreshTeam. Requires FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY to be configured.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> Migrate Leave Requests
            </CardTitle>
            <CardDescription>
              Pull all time-offs from FreshTeam and create/update leave requests for existing employees matched by work email.
              Leave types are matched by name (Earned, LWOP, Bereavement, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={migrateFromFreshTeamMutation.isPending}
              onClick={() => {
                if (window.confirm("Pull all time-offs from FreshTeam and create/update leave requests for existing employees? Continue?")) {
                  migrateFromFreshTeamMutation.mutate();
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {migrateFromFreshTeamMutation.isPending ? "Migrating…" : "Migrate from FreshTeam"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> Sync Leave Balances
            </CardTitle>
            <CardDescription>
              Sync leave balances from FreshTeam for existing employees. Balance and used days will be set from FreshTeam's
              leave_credits and leaves_availed per leave type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={syncBalancesFromFreshTeamMutation.isPending}
              onClick={() => {
                if (window.confirm("Sync leave balances from FreshTeam for existing employees? Continue?")) {
                  syncBalancesFromFreshTeamMutation.mutate();
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {syncBalancesFromFreshTeamMutation.isPending ? "Syncing…" : "Sync Balances from FreshTeam"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const sectionContent: Record<Section, React.ReactNode> = {
    "overview":    overviewSection,
    "approvals":   approvalsSection,
    "requests":    requestsSection,
    "balances":    balancesSection,
    "holidays":    holidaysSection,
    "year-end":    yearEndSection,
    "leave-types": leaveTypesSection,
    "freshteam":   freshteamSection,
  };

  return (
    <Layout>
      <div className="flex h-full min-h-[calc(100vh-80px)] gap-0">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Leave Admin</p>
            <Button
              variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs px-0 text-muted-foreground hover:text-foreground"
              onClick={() => setLocation("/leave/employee")}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Employee View
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {visibleNav.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  section === item.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-5 min-w-[20px] text-[10px] px-1.5"
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto p-6">
          {sectionContent[section]}
        </main>
      </div>

      {/* Year-end wizard */}
      <Dialog open={yearEndWizard.open} onOpenChange={open => !open && setYearEndWizard(w => ({ ...w, open: false, step: 1, option: null, createdPolicyName: null, createdPolicyId: null }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Year-End Reset — {yearEndYear}</DialogTitle>
            <DialogDescription>
              {yearEndWizard.step === 1 && "Step 1: Choose policy approach for next year."}
              {yearEndWizard.step === 2 && yearEndWizard.option === "modify" && "Step 2: Set policy effective dates and change existing leave types."}
              {yearEndWizard.step === 2 && yearEndWizard.option === "new" && !yearEndWizard.createdPolicyId && "Step 2: Set policy effective dates and create policy."}
              {yearEndWizard.step === 2 && yearEndWizard.option === "new" && yearEndWizard.createdPolicyId && "Step 2: Add leave types to the new policy (multiple allowed)."}
              {yearEndWizard.step === 3 && "Step 3: Review and confirm reset."}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: choose option */}
          {yearEndWizard.step === 1 && (
            <div className="space-y-3 py-2">
              {[
                { id: "continue" as const, label: "Continue current policy as-is", desc: "Just run the reset. No changes to leave types or policy rules." },
                { id: "modify" as const, label: "Modify the current policy first", desc: "Change policy dates, accrual rules, or leave type settings before resetting." },
                { id: "new" as const, label: "Create a new policy for next year", desc: "Start fresh with a new policy. Leave types can be added after creation." },
              ].map(o => (
                <button
                  key={o.id}
                  onClick={() => setYearEndWizard(w => ({ ...w, option: o.id }))}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-colors",
                    yearEndWizard.option === o.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2a: modify — policy effective dates + change existing leave types */}
          {yearEndWizard.step === 2 && yearEndWizard.option === "modify" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Set policy effective dates for next year, then change existing leave types if needed.</p>
              {policies.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Policy effective from</Label>
                      <Input type="date" className="mt-1" value={policyForm.effectiveFrom} onChange={e => setPolicyForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Effective to (optional)</Label>
                      <Input type="date" className="mt-1" value={policyForm.effectiveTo} onChange={e => setPolicyForm(f => ({ ...f, effectiveTo: e.target.value }))} />
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    disabled={!policyForm.effectiveFrom || updatePolicyMutation.isPending}
                    onClick={() => { const p = policies[0]; if (p) updatePolicyMutation.mutate({ id: p.id, body: { effectiveFrom: policyForm.effectiveFrom, effectiveTo: policyForm.effectiveTo || undefined } }); }}
                  >
                    {updatePolicyMutation.isPending ? "Saving…" : "Save policy dates"}
                  </Button>
                </>
              )}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Change existing leave types</p>
                <p className="text-xs text-muted-foreground mb-2">Edit accrual, max balance, or other rules. Click Edit to open the full form.</p>
                {leaveTypesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No leave types in this policy.</p>
                ) : (
                  <div className="space-y-1">
                    {leaveTypesList.map((lt: any) => (
                      <div key={lt.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                        <span className="font-medium">{lt.name}</span>
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => {
                            setLeaveTypeEdit({ open: true, mode: "edit", type: lt });
                            setLeaveTypeForm({
                              name: lt.name || "", paid: lt.paid !== false, accrualType: lt.accrual_type || "none",
                              accrualRate: lt.accrual_rate != null ? String(lt.accrual_rate) : "", maxBalance: String(lt.max_balance ?? "21"),
                              carryForwardAllowed: !!lt.carry_forward_allowed, maxCarryForward: lt.max_carry_forward != null ? String(lt.max_carry_forward) : "",
                              requiresDocument: !!lt.requires_document, requiresApproval: lt.requires_approval !== false,
                              autoApproveEnabled: !!(lt.auto_approve_rules?.maxDays), autoApproveMaxDays: lt.auto_approve_rules?.maxDays != null ? String(lt.auto_approve_rules.maxDays) : "",
                              hrApprovalRequired: !!lt.hr_approval_required, minDays: lt.min_days != null ? String(lt.min_days) : "", maxDaysPerRequest: lt.max_days_per_request != null ? String(lt.max_days_per_request) : "",
                              blockedDuringNotice: !!lt.blocked_during_notice, color: lt.color || "#3b82f6",
                            });
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2b: new policy — effective dates, then create, then add leave types */}
          {yearEndWizard.step === 2 && yearEndWizard.option === "new" && (
            <div className="space-y-4 py-2">
              {!yearEndWizard.createdPolicyId ? (
                <>
                  <p className="text-sm text-muted-foreground">Enter policy effective dates and create the policy. Then add leave types on the next screen.</p>
                  <div>
                    <Label>Policy name</Label>
                    <Input className="mt-1" value={yearEndWizard.newPolicyName} onChange={e => setYearEndWizard(w => ({ ...w, newPolicyName: e.target.value }))} placeholder={`Leave Policy ${yearEndYear + 1}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Effective from</Label>
                      <Input type="date" className="mt-1" value={yearEndWizard.newPolicyFrom} onChange={e => setYearEndWizard(w => ({ ...w, newPolicyFrom: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Effective to (optional)</Label>
                      <Input type="date" className="mt-1" value={yearEndWizard.newPolicyTo} onChange={e => setYearEndWizard(w => ({ ...w, newPolicyTo: e.target.value }))} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    disabled={createPolicyMutation.isPending || !yearEndWizard.newPolicyFrom}
                    onClick={() => createPolicyMutation.mutate(
                      {
                        name: yearEndWizard.newPolicyName || `Leave Policy ${yearEndYear + 1}`,
                        effectiveFrom: yearEndWizard.newPolicyFrom,
                        effectiveTo: yearEndWizard.newPolicyTo || null,
                        policyYear: yearEndYear + 1,
                      },
                      {
                        onSuccess: (data: { name?: string; id?: string }) => setYearEndWizard(w => ({ ...w, createdPolicyName: (data?.name ?? w.newPolicyName) ?? null, createdPolicyId: data?.id ?? null })),
                      }
                    )}
                  >
                    {createPolicyMutation.isPending ? "Creating…" : "Create Policy"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Policy <strong>{yearEndWizard.createdPolicyName}</strong> created. Add leave types (e.g. Earned Leave, LWOP, Bereavement). You can add multiple.</p>
                  <div className="rounded border p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium">Add a leave type</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-[120px]">
                        <Label className="text-xs">Name</Label>
                        <Input className="mt-0.5 h-8" placeholder="e.g. Earned Leave" value={wizardNewTypeForm.name} onChange={e => setWizardNewTypeForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Max days</Label>
                        <Input type="number" className="mt-0.5 h-8" min={0} value={wizardNewTypeForm.maxBalance} onChange={e => setWizardNewTypeForm(f => ({ ...f, maxBalance: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-1">
                        <input type="checkbox" id="wiz-paid" checked={wizardNewTypeForm.paid} onChange={e => setWizardNewTypeForm(f => ({ ...f, paid: e.target.checked }))} className="h-3 w-3" />
                        <Label htmlFor="wiz-paid" className="text-xs">Paid</Label>
                      </div>
                      <Select value={wizardNewTypeForm.accrualType} onValueChange={(v: "none" | "monthly" | "yearly") => setWizardNewTypeForm(f => ({ ...f, accrualType: v }))}>
                        <SelectTrigger className="h-8 w-[100px]"><SelectValue placeholder="Accrual" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm" className="h-8"
                        disabled={!wizardNewTypeForm.name.trim() || createLeaveTypeMutation.isPending}
                        onClick={() => {
                          if (!yearEndWizard.createdPolicyId) return;
                          createLeaveTypeMutation.mutate(
                            {
                              policyId: yearEndWizard.createdPolicyId,
                              name: wizardNewTypeForm.name.trim(),
                              paid: wizardNewTypeForm.paid,
                              accrualType: wizardNewTypeForm.accrualType,
                              maxBalance: parseFloat(wizardNewTypeForm.maxBalance) || 12,
                              accrualRate: wizardNewTypeForm.accrualType !== "none" ? "0.5" : null,
                            },
                            {
                              onSuccess: () => {
                                setWizardNewTypeForm({ name: "", paid: true, accrualType: "none", maxBalance: "12" });
                                qc.invalidateQueries({ queryKey: ["/api/leave/policies", yearEndWizard.createdPolicyId] });
                              },
                            }
                          );
                        }}
                      >
                        {createLeaveTypeMutation.isPending ? "…" : "Add"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Leave types in this policy: {createdPolicyTypes.length === 0 ? "None yet" : createdPolicyTypes.map((t: any) => t.name).join(", ")}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: review & confirm — policy is already decided by path */}
          {yearEndWizard.step === 3 && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Policy for reset: <strong className="text-foreground">{yearEndWizard.option === "new" ? (yearEndWizard.createdPolicyName ?? "New policy") : (policies[0]?.name ?? "Current policy")}</strong> · Year: <strong className="text-foreground">{yearEndYear}</strong>
              </p>
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
                <p className="font-medium">What will happen:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Earned Leave balances for all employees → <strong className="text-foreground">0</strong></li>
                  <li>Bereavement balances for all employees → <strong className="text-foreground">2 days</strong></li>
                  <li>LWOP is unlimited, not affected</li>
                  <li>Current balances are snapshotted before reset</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">Carry-forward amounts can be added manually in the Balances section afterwards.</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            {yearEndWizard.step > 1 && (
              <Button variant="outline" onClick={() => setYearEndWizard(w => ({ ...w, step: (w.step - 1) as 1 | 2 | 3 }))}>Back</Button>
            )}
            <Button variant="outline" onClick={() => setYearEndWizard(w => ({ ...w, open: false, step: 1, option: null, createdPolicyName: null, createdPolicyId: null }))}>Cancel</Button>
            {yearEndWizard.step < 3 && (
              <Button
                disabled={
                  (yearEndWizard.step === 1 && !yearEndWizard.option) ||
                  (yearEndWizard.step === 2 && yearEndWizard.option === "new" && !yearEndWizard.createdPolicyId)
                }
                onClick={() => setYearEndWizard(w => {
                  const nextStep = w.step === 2 ? 3 : (w.option === "continue" ? 3 : 2);
                  return { ...w, step: nextStep as 1 | 2 | 3 };
                })}
              >
                {yearEndWizard.step === 1 && yearEndWizard.option === "continue" ? "Review Reset" : yearEndWizard.step === 2 ? "Next → Review" : "Next"}
              </Button>
            )}
            {yearEndWizard.step === 3 && (
              <Button
                disabled={yearEndMutation.isPending || !(yearEndWizard.option === "new" ? yearEndWizard.createdPolicyId : policies[0]?.id)}
                onClick={() => {
                  const policyId = yearEndWizard.option === "new" ? yearEndWizard.createdPolicyId : policies[0]?.id;
                  yearEndMutation.mutate({ year: yearEndYear, policyId: policyId ?? undefined });
                  setYearEndWizard(w => ({ ...w, open: false, step: 1, option: null, createdPolicyId: null }));
                }}
              >
                {yearEndMutation.isPending ? "Processing…" : "Confirm Reset"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy dates dialog (Continue same policy) */}
      <Dialog open={policyDialogOpen} onOpenChange={open => !open && (setPolicyDialogOpen(false), setEditingPolicyId(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit policy dates</DialogTitle>
            <DialogDescription>Set effective from/to so the policy covers the next year. Leave &quot;Effective to&quot; empty for no end date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Effective from</Label>
              <Input type="date" value={policyForm.effectiveFrom} onChange={e => setPolicyForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Effective to (optional)</Label>
              <Input type="date" value={policyForm.effectiveTo} onChange={e => setPolicyForm(f => ({ ...f, effectiveTo: e.target.value }))} className="mt-1" placeholder="Leave empty for no end" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDialogOpen(false)}>Cancel</Button>
            <Button disabled={!policyForm.effectiveFrom || updatePolicyMutation.isPending} onClick={() => editingPolicyId && updatePolicyMutation.mutate({ id: editingPolicyId, body: { effectiveFrom: policyForm.effectiveFrom, effectiveTo: policyForm.effectiveTo || undefined } })}>
              {updatePolicyMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave type create / edit dialog */}
      <Dialog open={leaveTypeEdit.open} onOpenChange={open => !open && setLeaveTypeEdit({ open: false, mode: "edit", type: null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{leaveTypeEdit.mode === "create" ? "Add Leave Type" : `Edit: ${leaveTypeEdit.type?.name}`}</DialogTitle>
            <DialogDescription>
              {leaveTypeEdit.mode === "create"
                ? "New type will be auto-initialized for all active employees."
                : "Changes apply immediately. Accrual rate change applies from the next accrual run."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Name */}
            <div>
              <Label>Name</Label>
              <Input value={leaveTypeForm.name} onChange={e => setLeaveTypeForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Paternity Leave" />
            </div>
            {/* Paid toggle */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-paid" checked={leaveTypeForm.paid} onChange={e => setLeaveTypeForm(f => ({ ...f, paid: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-paid">Paid leave</Label>
            </div>
            {/* Accrual type */}
            <div>
              <Label>Accrual type</Label>
              <Select value={leaveTypeForm.accrualType} onValueChange={(v: any) => setLeaveTypeForm(f => ({ ...f, accrualType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (fixed balance)</SelectItem>
                  <SelectItem value="monthly">Monthly accrual</SelectItem>
                  <SelectItem value="yearly">Yearly grant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Accrual rate */}
            {(leaveTypeForm.accrualType === "monthly" || leaveTypeForm.accrualType === "yearly") && (
              <div>
                <Label>Accrual rate (days per period)</Label>
                <Input type="number" min={0} step={0.25} value={leaveTypeForm.accrualRate} onChange={e => setLeaveTypeForm(f => ({ ...f, accrualRate: e.target.value }))} className="mt-1" placeholder="0.5" />
              </div>
            )}
            {/* Max balance */}
            <div>
              <Label>Max balance (days)</Label>
              <Input type="number" min={0} step={0.5} value={leaveTypeForm.maxBalance} onChange={e => setLeaveTypeForm(f => ({ ...f, maxBalance: e.target.value }))} className="mt-1" />
            </div>
            {/* Carry forward */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-cf" checked={leaveTypeForm.carryForwardAllowed} onChange={e => setLeaveTypeForm(f => ({ ...f, carryForwardAllowed: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-cf">Carry forward allowed</Label>
            </div>
            {leaveTypeForm.carryForwardAllowed && (
              <div>
                <Label>Max carry forward (days)</Label>
                <Input type="number" min={0} step={0.5} value={leaveTypeForm.maxCarryForward} onChange={e => setLeaveTypeForm(f => ({ ...f, maxCarryForward: e.target.value }))} className="mt-1" placeholder="Unlimited if blank" />
              </div>
            )}
            {/* Approval */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-req-approval" checked={leaveTypeForm.requiresApproval} onChange={e => setLeaveTypeForm(f => ({ ...f, requiresApproval: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-req-approval">Requires approval</Label>
            </div>
            {leaveTypeForm.requiresApproval && (
              <div className="flex items-center gap-3 pl-6">
                <input type="checkbox" id="ltf-hr-approval" checked={leaveTypeForm.hrApprovalRequired} onChange={e => setLeaveTypeForm(f => ({ ...f, hrApprovalRequired: e.target.checked }))} className="h-4 w-4" />
                <Label htmlFor="ltf-hr-approval">HR approval required (in addition to manager)</Label>
              </div>
            )}
            {/* Auto-approve */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-auto" checked={leaveTypeForm.autoApproveEnabled} onChange={e => setLeaveTypeForm(f => ({ ...f, autoApproveEnabled: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-auto">Auto-approve short requests</Label>
            </div>
            {leaveTypeForm.autoApproveEnabled && (
              <div className="pl-6">
                <Label>Max days for auto-approve</Label>
                <Input type="number" min={1} step={1} value={leaveTypeForm.autoApproveMaxDays} onChange={e => setLeaveTypeForm(f => ({ ...f, autoApproveMaxDays: e.target.value }))} className="mt-1" placeholder="1" />
              </div>
            )}
            {/* Document */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-doc" checked={leaveTypeForm.requiresDocument} onChange={e => setLeaveTypeForm(f => ({ ...f, requiresDocument: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-doc">Requires supporting document</Label>
            </div>
            {/* Min / max days per request */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min days per request</Label>
                <Input type="number" min={0} step={0.5} value={leaveTypeForm.minDays} onChange={e => setLeaveTypeForm(f => ({ ...f, minDays: e.target.value }))} className="mt-1" placeholder="0.5" />
              </div>
              <div>
                <Label>Max days per request</Label>
                <Input type="number" min={0} step={1} value={leaveTypeForm.maxDaysPerRequest} onChange={e => setLeaveTypeForm(f => ({ ...f, maxDaysPerRequest: e.target.value }))} className="mt-1" placeholder="No limit" />
              </div>
            </div>
            {/* Blocked during notice */}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ltf-notice" checked={leaveTypeForm.blockedDuringNotice} onChange={e => setLeaveTypeForm(f => ({ ...f, blockedDuringNotice: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="ltf-notice">Blocked during notice period</Label>
            </div>
            {/* Color */}
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1 items-center">
                <input type="color" value={leaveTypeForm.color} onChange={e => setLeaveTypeForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer p-0.5" />
                <Input value={leaveTypeForm.color} onChange={e => setLeaveTypeForm(f => ({ ...f, color: e.target.value }))} placeholder="#3b82f6" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveTypeEdit({ open: false, mode: "edit", type: null })}>Cancel</Button>
            <Button
              disabled={updateLeaveTypeMutation.isPending || createLeaveTypeMutation.isPending}
              onClick={() => {
                const body: Record<string, unknown> = {
                  name: leaveTypeForm.name,
                  paid: leaveTypeForm.paid,
                  accrualType: leaveTypeForm.accrualType,
                  accrualRate: leaveTypeForm.accrualRate !== "" ? parseFloat(leaveTypeForm.accrualRate) : null,
                  maxBalance: leaveTypeForm.maxBalance !== "" ? parseFloat(leaveTypeForm.maxBalance) : 21,
                  carryForwardAllowed: leaveTypeForm.carryForwardAllowed,
                  maxCarryForward: leaveTypeForm.carryForwardAllowed && leaveTypeForm.maxCarryForward !== "" ? parseFloat(leaveTypeForm.maxCarryForward) : null,
                  requiresDocument: leaveTypeForm.requiresDocument,
                  requiresApproval: leaveTypeForm.requiresApproval,
                  hrApprovalRequired: leaveTypeForm.hrApprovalRequired,
                  autoApproveRules: leaveTypeForm.autoApproveEnabled && leaveTypeForm.autoApproveMaxDays !== ""
                    ? { maxDays: parseInt(leaveTypeForm.autoApproveMaxDays, 10) }
                    : null,
                  minDays: leaveTypeForm.minDays !== "" ? parseFloat(leaveTypeForm.minDays) : null,
                  maxDaysPerRequest: leaveTypeForm.maxDaysPerRequest !== "" ? parseFloat(leaveTypeForm.maxDaysPerRequest) : null,
                  blockedDuringNotice: leaveTypeForm.blockedDuringNotice,
                  color: leaveTypeForm.color,
                };
                if (leaveTypeEdit.mode === "create") {
                  if (!firstPolicyId) { toast.error("No policy found"); return; }
                  createLeaveTypeMutation.mutate({ ...body, policyId: firstPolicyId });
                } else {
                  if (!leaveTypeEdit.type?.id) return;
                  updateLeaveTypeMutation.mutate({ id: leaveTypeEdit.type.id, body });
                }
              }}
            >
              {(updateLeaveTypeMutation.isPending || createLeaveTypeMutation.isPending) ? "Saving…" : leaveTypeEdit.mode === "create" ? "Create & Initialize" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance adjust / add dialog */}
      <Dialog open={balanceDialog.open} onOpenChange={open => !open && setBalanceDialog({ open: false, mode: "set" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {balanceDialog.mode === "set" ? "Set balance (Earned Leave)" : "Add days (Earned Leave)"}
            </DialogTitle>
            <DialogDescription>
              {balanceDialog.mode === "set"
                ? "Set the new total Earned Leave balance. Provide a reason for audit."
                : "Add days to the current Earned Leave balance. Provide a reason for audit."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{balanceDialog.mode === "set" ? "New balance (days)" : "Days to add"}</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={balanceForm.value}
                onChange={e => setBalanceForm(f => ({ ...f, value: e.target.value }))}
                placeholder="0.5 or 1, 1.5, 2..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={balanceForm.reason}
                onChange={e => setBalanceForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Carry forward, encash adjustment"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialog({ open: false, mode: "set" })}>Cancel</Button>
            {balanceDialog.mode === "set" && balanceDialog.balance && (
              <Button
                disabled={adjustBalanceMutation.isPending}
                onClick={() => {
                  const n = roundToHalfDay(parseFloat(balanceForm.value));
                  if (!Number.isNaN(n) && n >= 0 && balanceForm.reason.trim()) {
                    adjustBalanceMutation.mutate({ balanceId: balanceDialog.balance!.id, newBalance: n, reason: balanceForm.reason.trim() });
                  } else {
                    toast.error("Enter valid balance (0.5 or whole days) and reason.");
                  }
                }}
              >
                Save
              </Button>
            )}
            {balanceDialog.mode === "add" && balanceDialog.balance && balanceEmployeeId && (
              <Button
                disabled={addBalanceMutation.isPending}
                onClick={() => {
                  const n = roundToHalfDay(parseFloat(balanceForm.value));
                  if (!Number.isNaN(n) && n > 0 && balanceForm.reason.trim()) {
                    addBalanceMutation.mutate({ employeeId: balanceEmployeeId, leaveTypeId: balanceDialog.balance!.leave_type_id, daysToAdd: n, reason: balanceForm.reason.trim() });
                  } else {
                    toast.error("Enter days to add (0.5 or whole days) and reason.");
                  }
                }}
              >
                Add
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
