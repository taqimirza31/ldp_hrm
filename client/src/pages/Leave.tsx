import Layout from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Clock, LayoutDashboard, List, Plus, Settings, Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ───────────────────────── types ─────────────────────────
interface LeaveTypeRow {
  id: string; policy_id: string; name: string; paid: boolean;
  accrual_type: string; accrual_rate: string | null; max_balance: number;
  carry_forward_allowed: boolean; requires_document: boolean;
  requires_approval: boolean; auto_approve_rules: any;
  hr_approval_required: boolean; min_days: number | null;
  max_days_per_request: number | null; blocked_during_notice: boolean;
  color: string; balance?: string; used?: string;
}
interface LeaveBalance {
  id: string; employee_id: string; leave_type_id: string;
  balance: string; used: string; type_name: string; paid: boolean;
  max_balance: number; color: string; accrual_type: string; policy_name: string;
}
interface MyRequest {
  id: string; leave_type_id: string; start_date: string; end_date: string;
  day_type: string; total_days: string; reason: string | null; status: string;
  applied_at: string; decided_at: string | null; rejection_reason: string | null;
  type_name: string; color: string; paid: boolean;
}
interface CalendarEvent {
  id: string; employee_id: string; start_date: string; end_date: string;
  day_type: string; total_days: string; status: string; type_name: string;
  color: string; first_name: string; last_name: string; department: string;
  avatar: string | null;
}
interface Stats {
  pendingRequests: number; onLeaveToday: number;
  approvedThisMonth: number; activePolicies: number;
}

// ───────────────────────── helpers ───────────────────────
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
/** Display balance as .5 or whole only: floor to nearest 0.5 (e.g. 1.29 → 1, 1.67 → 1.5). */
function displayBalance(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n * 2) / 2;
}
function formatBalanceDisplay(n: number): string {
  const x = displayBalance(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

type Section = "overview" | "my-requests" | "calendar";

// ───────────────────────── Apply dialog ──────────────────
function ApplyLeaveDialog({ open, onClose, employeeId }: {
  open: boolean; onClose: () => void; employeeId: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", dayType: "full", reason: "" });
  const [loading, setLoading] = useState(false);

  const { data: leaveTypes = [], isError } = useQuery<LeaveTypeRow[]>({
    queryKey: ["/api/leave/types-for-employee", employeeId],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/leave/types-for-employee/${employeeId}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!employeeId && open,
  });

  useEffect(() => {
    if (open) setForm({ leaveTypeId: "", startDate: "", endDate: "", dayType: "full", reason: "" });
  }, [open]);

  const dayCount = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate + "T00:00:00");
    const e = new Date(form.endDate + "T00:00:00");
    if (e < s) return 0;
    let c = 0;
    const cur = new Date(s);
    while (cur <= e) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) c++;
      cur.setDate(cur.getDate() + 1);
    }
    return form.dayType === "half" ? c * 0.5 : c;
  }, [form.startDate, form.endDate, form.dayType]);

  const selected = leaveTypes.find(t => t.id === form.leaveTypeId);

  const handleSubmit = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) { toast.error("Fill all required fields"); return; }
    if (form.endDate < form.startDate) { toast.error("End date cannot be before start date"); return; }
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/leave/request", { ...form, totalDays: dayCount });
      const data = await result.json();
      toast.success(data.autoApproved ? "Leave auto-approved!" : "Leave request submitted for approval");
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" /> Apply for Leave
          </DialogTitle>
          <DialogDescription>Submit a leave request for approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            {!employeeId ? (
              <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Your account is not linked to an employee record. Contact HR.
                </p>
              </div>
            ) : isError ? (
              <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Failed to load leave types. Please try again or contact HR.
                </p>
              </div>
            ) : leaveTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  No leave types available. HR needs to set up a policy for your role/department.
                </p>
              </div>
            ) : (
              <Select value={form.leaveTypeId} onValueChange={v => setForm({ ...form, leaveTypeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select leave type..." /></SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(t => {
                    const isUnpaid = t.paid === false;
                    const balRaw = parseFloat(t.balance || "0");
                    const bal = Number.isFinite(balRaw) ? Math.round(balRaw * 2) / 2 : 0;
                    const balStr = Number.isInteger(bal) ? String(bal) : bal.toFixed(1);
                    const label = isUnpaid ? "Unlimited" : `Bal: ${balStr}${t.max_balance != null ? ` / ${t.max_balance}` : ""}`;
                    return (
                      <SelectItem key={t.id} value={t.id}>
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
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} min={form.startDate || undefined} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Day Type</Label>
            <Select value={form.dayType} onValueChange={v => setForm({ ...form, dayType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Day</SelectItem>
                <SelectItem value="half">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dayCount > 0 && (
            <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-700">Total: {dayCount} day{dayCount !== 1 ? "s" : ""}</p>
              {selected && selected.paid && (() => { const b = parseFloat(selected.balance || "0"); const r = Number.isFinite(b) ? Math.round(b * 2) / 2 : 0; return r < dayCount; })() && (
                <p className="text-xs text-red-600 mt-1">Insufficient balance ({(() => { const b = parseFloat(selected.balance || "0"); const r = Number.isFinite(b) ? Math.round(b * 2) / 2 : 0; return Number.isInteger(r) ? r : r.toFixed(1); })()} available)</p>
              )}
              {selected && !selected.paid && (
                <p className="text-xs text-muted-foreground mt-1">Unpaid leave (LWOP) — no balance deduction</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." rows={2} />
          </div>
          {selected?.requires_document && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> This leave type requires a supporting document.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || dayCount <= 0 || !form.leaveTypeId}>
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── main page ─────────────────────
export default function Leave() {
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("overview");
  const [applyOpen, setApplyOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const qc = useQueryClient();

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try { const r = await apiRequest("GET", "/api/auth/me"); return r.json(); } catch { return null; }
    },
  });
  const employeeId: string | null = me?.employeeId || me?.employee_id || null;
  const role: string = (me?.role || "employee").toString().toLowerCase();
  const roles: string[] = Array.isArray(me?.roles) ? me.roles.map((r: unknown) => String(r).toLowerCase()) : [];
  const isAdminUser = role === "hr" || role === "admin" || role === "manager" || roles.includes("hr") || roles.includes("admin") || roles.includes("manager");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/leave/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/stats")).json(),
  });

  const { data: myBalances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave/balances", employeeId],
    queryFn: async () => (await apiRequest("GET", `/api/leave/balances/${employeeId}`)).json(),
    enabled: !!employeeId,
  });

  const { data: myRequests = [] } = useQuery<MyRequest[]>({
    queryKey: ["/api/leave/my-requests"],
    queryFn: async () => (await apiRequest("GET", "/api/leave/my-requests")).json(),
    enabled: !!employeeId,
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
    enabled: section === "calendar",
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/leave/request/${id}/cancel`); },
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries({ queryKey: ["/api/leave"] }); },
    onError: (err: any) => toast.error(err?.message || "Failed to cancel"),
  });

  const filteredRequests = useMemo(() =>
    myRequests.filter(r => statusFilter === "all" || r.status === statusFilter),
    [myRequests, statusFilter],
  );

  // ── nav items ──
  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "overview",    label: "Overview",    icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "my-requests", label: "My Requests", icon: <List className="h-4 w-4" /> },
    { id: "calendar",    label: "Calendar",    icon: <Calendar className="h-4 w-4" /> },
  ];

  // ── section: overview ──
  const overviewSection = (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Overview</h2>
        <p className="text-sm text-muted-foreground">Your leave balances and summary.</p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-yellow-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.pendingRequests ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.approvedThisMonth ?? 0}</p>
              <p className="text-xs text-muted-foreground">Approved this month</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.onLeaveToday ?? 0}</p>
              <p className="text-xs text-muted-foreground">On leave today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* balance cards */}
      {myBalances.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Balances</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBalances.map(b => {
              const isUnpaid = b.paid === false;
              const roundHalf = (n: number) => Number.isFinite(n) ? Math.round(n * 2) / 2 : 0;
              const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
              const bal = roundHalf(parseFloat(b.balance ?? "0"));
              const used = roundHalf(parseFloat(b.used ?? "0"));
              const max = b.max_balance ?? 0;
              const pct = !isUnpaid && max > 0 ? Math.round(((max - bal) / max) * 100) : 0;
              return (
                <Card key={b.id} className="overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: b.color }} />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{b.type_name}</p>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    </div>
                    {isUnpaid ? (
                      <>
                        <p className="text-2xl font-bold text-muted-foreground">∞</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Unpaid (LWOP)</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold">{fmt(bal)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Used: {fmt(used)}{max > 0 ? ` / ${max}` : ""}
                        </p>
                        {max > 0 && <Progress value={pct} className="h-1.5 mt-2" />}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* recent requests */}
      {myRequests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Requests</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSection("my-requests")}>View all</Button>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.slice(0, 5).map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs" style={{ borderColor: r.color, color: r.color }}>{r.type_name}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.start_date)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(r.end_date)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.total_days}{r.day_type === "half" ? " (H)" : ""}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs border", statusStyle[r.status] || "")}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );

  // ── section: my requests ──
  const myRequestsSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">My Requests</h2>
        <p className="text-sm text-muted-foreground">All your leave requests and their status.</p>
      </div>
      <div className="flex items-center gap-3">
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
          <Calendar className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">No leave requests</p>
          <p className="text-sm mt-1">Apply for leave to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map(r => (
                <TableRow key={r.id}>
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
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <Button
                        variant="ghost" size="sm" className="text-red-600 h-7 text-xs"
                        onClick={() => cancelMutation.mutate(r.id)}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    {r.status === "rejected" && r.rejection_reason && (
                      <span className="text-xs text-red-600 max-w-[120px] block truncate" title={r.rejection_reason}>
                        {r.rejection_reason}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ── section: calendar ──
  const calendarSection = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Team Calendar</h2>
        <p className="text-sm text-muted-foreground">Approved leave for all employees.</p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold min-w-[160px] text-center">
          {calendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <Button
          variant="outline" size="icon" className="h-8 w-8"
          onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
            ))}
            {(() => {
              const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
              const first = new Date(y, m, 1);
              const last = new Date(y, m + 1, 0);
              const startPad = (first.getDay() + 6) % 7;
              const daysInMonth = last.getDate();
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < 42; i++) {
                if (i < startPad || i >= startPad + daysInMonth) {
                  cells.push(<div key={`e-${i}`} className="min-h-[72px] bg-muted/20 p-1.5" />);
                } else {
                  const d = i - startPad + 1;
                  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const evs = calendarEvents.filter(ev => ev.start_date <= dateStr && ev.end_date >= dateStr);
                  cells.push(
                    <div key={`d-${i}`} className="min-h-[72px] bg-background p-1.5 border-b border-r border-border/40">
                      <span className="text-xs font-medium text-muted-foreground">{d}</span>
                      <div className="mt-1 space-y-0.5">
                        {evs.map(ev => (
                          <div
                            key={ev.id}
                            className="text-[10px] truncate rounded px-1 py-0.5"
                            style={{ backgroundColor: `${ev.color}20`, color: ev.color, borderLeft: `2px solid ${ev.color}` }}
                            title={`${ev.first_name} ${ev.last_name} — ${ev.type_name}`}
                          >
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
    </div>
  );

  const sectionContent: Record<Section, React.ReactNode> = {
    "overview":    overviewSection,
    "my-requests": myRequestsSection,
    "calendar":    calendarSection,
  };

  return (
    <Layout>
      <div className="flex h-full min-h-[calc(100vh-80px)] gap-0">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Leave</p>
            <Button className="w-full gap-2" size="sm" onClick={() => setApplyOpen(true)}>
              <Plus className="h-4 w-4" /> Apply Leave
            </Button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  section === item.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {isAdminUser && (
            <div className="p-3 border-t">
              <Button
                variant="outline" size="sm" className="w-full gap-2 text-xs"
                onClick={() => setLocation("/leave/admin")}
              >
                <Settings className="h-3.5 w-3.5" /> Admin View
              </Button>
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto p-6">
          {sectionContent[section]}
        </main>
      </div>

      <ApplyLeaveDialog open={applyOpen} onClose={() => setApplyOpen(false)} employeeId={employeeId} />
    </Layout>
  );
}
