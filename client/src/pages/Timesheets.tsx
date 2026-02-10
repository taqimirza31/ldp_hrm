import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmployeeSelect } from "@/components/EmployeeSelect";
import {
  Clock, Calendar, Download, Play, Square, AlertCircle, Users,
  CheckCircle, XCircle, BarChart3, Search, FileText, Plus, Timer,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// ==================== TYPES ====================

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  source: string;
  status: string;
  remarks: string | null;
  shift_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  grace_minutes?: number;
  first_name?: string;
  last_name?: string;
  emp_code?: string;
  department?: string;
  hours_worked?: number;
  overtime?: number;
}

interface AttendanceStats {
  today: string;
  present: number;
  late: number;
  absent: number;
  totalEmployees: number;
}

// ==================== HELPERS ====================

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatHours(h: number | undefined): string {
  if (!h || h === 0) return "—";
  return `${h.toFixed(1)}h`;
}

function statusBadge(status: string) {
  const cfg: Record<string, { label: string; className: string }> = {
    present: { label: "Present", className: "bg-green-100 text-green-700 border-green-200" },
    late: { label: "Late", className: "bg-amber-100 text-amber-700 border-amber-200" },
    half_day: { label: "Half Day", className: "bg-orange-100 text-orange-700 border-orange-200" },
    absent: { label: "Absent", className: "bg-red-100 text-red-700 border-red-200" },
  };
  const c = cfg[status] || { label: status, className: "" };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function sourceBadge(source: string) {
  const cfg: Record<string, string> = { web: "Web", manual: "Manual", mobile: "Mobile", biometric: "Biometric" };
  return <Badge variant="secondary" className="text-xs">{cfg[source] || source}</Badge>;
}

// ==================== MAIN COMPONENT ====================

export default function Timesheets() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isHR } = useAuth();
  const canManage = isAdmin || isHR;

  // Employee clock state
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [manualDialog, setManualDialog] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportDept, setReportDept] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    employeeId: "", date: new Date().toISOString().split("T")[0],
    checkInTime: "", checkOutTime: "", remarks: "",
  });

  // ==================== QUERIES ====================

  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/attendance/today"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/attendance/today"); return r.json(); },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ["/api/attendance/stats"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/attendance/stats"); return r.json(); },
    refetchInterval: 60000,
  });

  const { data: myRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/employee", user?.employeeId],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const r = await apiRequest("GET", `/api/attendance/employee/${user.employeeId}?from=${reportFrom}&to=${reportTo}`);
      return r.json();
    },
    enabled: !!user?.employeeId,
  });

  const { data: reportData = [], isLoading: reportLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/report", reportFrom, reportTo, reportDept],
    queryFn: async () => {
      let url = `/api/attendance/report?from=${reportFrom}&to=${reportTo}`;
      if (reportDept) url += `&department=${encodeURIComponent(reportDept)}`;
      const r = await apiRequest("GET", url);
      return r.json();
    },
    enabled: canManage,
  });

  // ==================== MUTATIONS ====================

  const checkInMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/attendance/check-in"); return r.json(); },
    onSuccess: () => {
      toast.success("Checked in successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/stats"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to check in"),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/attendance/check-out"); return r.json(); },
    onSuccess: () => {
      toast.success("Checked out successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/stats"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to check out"),
  });

  const manualMutation = useMutation({
    mutationFn: async (data: typeof manualForm) => {
      const r = await apiRequest("POST", "/api/attendance/manual", {
        employeeId: data.employeeId,
        date: data.date,
        checkInTime: data.checkInTime ? new Date(`${data.date}T${data.checkInTime}`).toISOString() : null,
        checkOutTime: data.checkOutTime ? new Date(`${data.date}T${data.checkOutTime}`).toISOString() : null,
        remarks: data.remarks || null,
        source: "manual",
      });
      return r.json();
    },
    onSuccess: () => {
      toast.success("Manual record saved");
      setManualDialog(false);
      setManualForm({ employeeId: "", date: new Date().toISOString().split("T")[0], checkInTime: "", checkOutTime: "", remarks: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/stats"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save"),
  });

  // ==================== ELAPSED TIME TIMER ====================

  const isClockedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time;
  const isClockedOut = !!todayRecord?.check_out_time;

  useEffect(() => {
    if (!isClockedIn || !todayRecord?.check_in_time) {
      if (isClockedOut && todayRecord?.check_in_time && todayRecord?.check_out_time) {
        const diff = new Date(todayRecord.check_out_time).getTime() - new Date(todayRecord.check_in_time).getTime();
        const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        setElapsedTime(`${h}:${m}:${s}`);
      } else {
        setElapsedTime("00:00:00");
      }
      return;
    }
    const interval = setInterval(() => {
      const diff = Date.now() - new Date(todayRecord.check_in_time!).getTime();
      const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn, isClockedOut, todayRecord]);

  // ==================== EXPORT ====================

  const handleExport = () => {
    const data = canManage ? reportData : myRecords;
    if (data.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Date", "Employee", "Emp ID", "Department", "Check In", "Check Out", "Hours", "Status", "Source", "Shift"];
    const rows = data.map((r) => [
      r.date, `${r.first_name || ""} ${r.last_name || ""}`.trim(), r.emp_code || "", r.department || "",
      r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "", r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : "",
      (r.hours_worked ?? 0).toFixed(1), r.status, r.source, r.shift_name || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_report_${reportFrom}_${reportTo}.csv`;
    link.click();
    toast.success("Report exported");
  };

  // ==================== REPORT AGGREGATES ====================

  const filteredReport = reportData.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
      (r.emp_code || "").toLowerCase().includes(term) ||
      (r.department || "").toLowerCase().includes(term);
  });

  const lateCount = reportData.filter((r) => r.status === "late").length;
  const totalHours = reportData.reduce((sum, r) => sum + (r.hours_worked ?? 0), 0);
  const totalOvertime = reportData.reduce((sum, r) => sum + (r.overtime ?? 0), 0);

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Time & Attendance</h1>
          <p className="text-muted-foreground text-sm">Track attendance, shifts, and generate reports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          {canManage && (
            <Button onClick={() => setManualDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Manual Entry
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-xs text-muted-foreground">Present Today</p><p className="text-2xl font-bold">{stats.present}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30"><AlertCircle className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-xs text-muted-foreground">Late Today</p><p className="text-2xl font-bold">{stats.late}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-xs text-muted-foreground">Absent Today</p><p className="text-2xl font-bold">{stats.absent}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Users className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xs text-muted-foreground">Total Employees</p><p className="text-2xl font-bold">{stats.totalEmployees}</p></div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="my-attendance" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="my-attendance">My Attendance</TabsTrigger>
          {canManage && <TabsTrigger value="report">Attendance Report</TabsTrigger>}
        </TabsList>

        {/* ==================== MY ATTENDANCE TAB ==================== */}
        <TabsContent value="my-attendance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clock Card */}
            <Card className="bg-slate-900 text-white border-none shadow-lg overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Clock className="h-32 w-32" />
              </div>
              <CardContent className="p-6 text-center relative z-10">
                <p className="text-slate-400 text-xs font-bold uppercase mb-4 tracking-widest">Today's Status</p>
                <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 mb-4 transition-all ${isClockedIn ? "border-green-500 bg-green-500/10" : isClockedOut ? "border-blue-500 bg-blue-500/10" : "border-slate-600 bg-slate-800"}`}>
                  <span className={`text-xs font-bold ${isClockedIn ? "text-green-400" : isClockedOut ? "text-blue-400" : "text-slate-500"}`}>
                    {isClockedIn ? "CLOCKED IN" : isClockedOut ? "DONE" : "NOT IN"}
                  </span>
                </div>
                <p className="text-3xl font-mono font-bold mb-2 tracking-tighter">{elapsedTime}</p>
                <p className="text-xs text-slate-500 mb-4">
                  {todayRecord?.check_in_time ? `In: ${formatTime(todayRecord.check_in_time)}` : "Ready to start"}
                  {todayRecord?.check_out_time ? ` · Out: ${formatTime(todayRecord.check_out_time)}` : ""}
                </p>
                {todayRecord?.shift_name && (
                  <Badge variant="outline" className="text-slate-300 border-slate-600 mb-4">{todayRecord.shift_name}</Badge>
                )}
                <div className="flex justify-center gap-3">
                  {!isClockedIn && !isClockedOut && (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
                      <Play className="h-4 w-4 mr-2" /> Clock In
                    </Button>
                  )}
                  {isClockedIn && (
                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending}>
                      <Square className="h-4 w-4 mr-2" /> Clock Out
                    </Button>
                  )}
                  {isClockedOut && (
                    <p className="text-xs text-slate-500">All done for today</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* My Records */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> My Attendance Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Date</TableHead>
                          <TableHead>Check In</TableHead>
                          <TableHead>Check Out</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Shift</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myRecords.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No attendance records found</TableCell></TableRow>
                        ) : myRecords.map((r) => {
                          const hrs = r.check_in_time && r.check_out_time
                            ? (new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 3600000
                            : 0;
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{formatDate(r.date)}</TableCell>
                              <TableCell className="font-mono text-sm">{formatTime(r.check_in_time)}</TableCell>
                              <TableCell className="font-mono text-sm">{formatTime(r.check_out_time)}</TableCell>
                              <TableCell className="font-mono">{formatHours(hrs)}</TableCell>
                              <TableCell>{statusBadge(r.status)}</TableCell>
                              <TableCell>{sourceBadge(r.source)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.shift_name || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ==================== REPORT TAB (HR/Admin) ==================== */}
        {canManage && (
          <TabsContent value="report">
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Department</Label>
                    <Input placeholder="All departments" value={reportDept} onChange={(e) => setReportDept(e.target.value)} className="w-44" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <Label className="text-xs">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Name, ID, dept..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Records</p><p className="text-xl font-bold">{reportData.length}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Late Arrivals</p><p className="text-xl font-bold text-amber-600">{lateCount}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Hours</p><p className="text-xl font-bold">{totalHours.toFixed(0)}h</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Overtime</p><p className="text-xl font-bold text-purple-600">{totalOvertime.toFixed(1)}h</p></CardContent></Card>
            </div>

            <Card>
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Shift</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportLoading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : filteredReport.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
                    ) : filteredReport.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{formatDate(r.date)}</TableCell>
                        <TableCell>
                          <div><p className="font-medium text-sm">{r.first_name} {r.last_name}</p><p className="text-xs text-muted-foreground">{r.emp_code}</p></div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.department || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(r.check_in_time)}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(r.check_out_time)}</TableCell>
                        <TableCell className="text-right font-mono">{formatHours(r.hours_worked)}</TableCell>
                        <TableCell className="text-right font-mono text-purple-600">{r.overtime && r.overtime > 0 ? `${r.overtime.toFixed(1)}h` : "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell>{sourceBadge(r.source)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.shift_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ==================== MANUAL ENTRY DIALOG ==================== */}
      <Dialog open={manualDialog} onOpenChange={setManualDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Manual Attendance Entry</DialogTitle>
            <DialogDescription>Create or override an attendance record. An audit trail will be kept.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Employee *</Label>
              <EmployeeSelect value={manualForm.employeeId} onChange={(id) => setManualForm({ ...manualForm, employeeId: id })} placeholder="Select employee..." />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check In Time</Label>
                <Input type="time" value={manualForm.checkInTime} onChange={(e) => setManualForm({ ...manualForm, checkInTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Check Out Time</Label>
                <Input type="time" value={manualForm.checkOutTime} onChange={(e) => setManualForm({ ...manualForm, checkOutTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason / Remarks</Label>
              <Textarea value={manualForm.remarks} onChange={(e) => setManualForm({ ...manualForm, remarks: e.target.value })} rows={2} placeholder="e.g., Forgot to check in, worked from home..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(false)}>Cancel</Button>
            <Button onClick={() => manualMutation.mutate(manualForm)} disabled={!manualForm.employeeId || !manualForm.date || manualMutation.isPending}>
              {manualMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
