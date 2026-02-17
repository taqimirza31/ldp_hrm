import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, Laptop,
  ArrowRight, UserPlus, LogIn, LogOut, Calendar, Shield,
  TrendingUp, TrendingDown, Building2, Briefcase, UserCheck, FileText,
  Activity, Bell, Info, AlertCircle, ChevronRight, RefreshCw,
  ClipboardList, Eye, BarChart3,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
// Auth context available if needed; role comes from /api/dashboard response

// ==================== TYPES ====================

interface DashboardData {
  role: string;
  error?: string;
  // Employee
  employee?: { id: string; first_name: string; last_name: string; employment_status: string; employee_id: string; job_title: string; department: string; avatar: string | null; join_date: string };
  attendance?: { checkedIn: boolean; checkedOut: boolean; status: string | null; checkInTime: string | null; checkOutTime: string | null };
  leaveBalances?: { balance: string; used: string; type_name: string; max_balance: number; color: string }[];
  pendingLeaveRequests?: { id: string; start_date: string; end_date: string; total_days: string; status: string; type_name: string; color: string }[];
  assets?: { id: string; system_type: string; system_name: string; serial_number: string; status: string }[];
  onboarding?: { id: string; taskCount: number; completedCount: number } | null;
  // Manager
  teamSize?: number;
  teamOnLeave?: { id: string; first_name: string; last_name: string; avatar: string | null; type_name: string; color: string }[];
  pendingApprovals?: any[];
  absentToday?: { id: string; first_name: string; last_name: string; avatar: string | null; department: string }[];
  inNotice?: { id: string; first_name: string; last_name: string; avatar: string | null; offboarding_type: string; last_working_date: string }[];
  // HR
  headcount?: number;
  joinersToday?: number;
  leaversToday?: number;
  pendingOnboarding?: any[];
  tentativePending?: any[];
  offboardingPending?: any[];
  interviewStage?: any[];
  risks?: { noManager: number; noLeavePolicy: number; stuckTentative: number; offboardingNoAssetReturn: number };
  myData?: DashboardData | null;
  // Admin
  attritionThisMonth?: number;
  joinersThisMonth?: number;
  leaversThisMonth?: number;
  departmentBreakdown?: { department: string; count: number }[];
  attendanceToday?: { present: number; total: number; percentage: number };
  // assets for admin
  hr?: Partial<DashboardData>;
  // Shared
  activityFeed?: { type: string; message: string; timestamp: string; severity: string; color?: string; link?: string }[];
}

export interface ProbationAlert {
  id: string;
  name: string;
  probation_end_date: string | null;
  days_left: number;
}

// ==================== SHARED COMPONENTS ====================

function StatCard({ title, value, icon: Icon, color, subtext, link }: {
  title: string; value: string | number; icon: any; color: string; subtext?: string; link?: string;
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          {subtext && <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>}
        </div>
        {link && <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}

function ActionButton({ label, icon: Icon, href, onClick, variant = "outline" }: {
  label: string; icon: any; href?: string; onClick?: () => void; variant?: "outline" | "default";
}) {
  const btn = (
    <Button variant={variant} size="sm" className="gap-2 h-9" onClick={onClick}>
      <Icon className="h-4 w-4" /> {label}
    </Button>
  );
  return href ? <Link href={href}>{btn}</Link> : btn;
}

function PersonChip({ name, subtitle, avatar, link }: { name: string; subtitle?: string; avatar?: string | null; link?: string }) {
  const content = (
    <div className="flex items-center gap-2 py-1.5">
      <Avatar className="h-7 w-7">
        <AvatarFallback className="text-[10px]">{name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </div>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}

function RiskBadge({ count, label, severity = "warning" }: { count: number; label: string; severity?: "warning" | "critical" }) {
  if (count === 0) return null;
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${severity === "critical" ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900" : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900"}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${severity === "critical" ? "text-red-600" : "text-yellow-600"}`} />
        <span className="text-sm">{label}</span>
      </div>
      <Badge variant="outline" className={`font-mono ${severity === "critical" ? "border-red-300 text-red-700" : "border-yellow-300 text-yellow-700"}`}>{count}</Badge>
    </div>
  );
}

function formatProbationDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ProbationAlertsCard({ alerts }: { alerts: ProbationAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Probation Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" /> No upcoming probation endings
          </p>
        </CardContent>
      </Card>
    );
  }
  const severityStyle = (daysLeft: number) => {
    if (daysLeft <= 1) return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200";
    if (daysLeft <= 3) return "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200";
    return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200";
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Probation Ending Soon
        </CardTitle>
        <CardDescription>Employees whose probation ends in the next 7 days</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <Link key={a.id} href={`/employees/${a.id}`}>
            <div
              className={`flex items-center justify-between p-2.5 rounded-lg border ${severityStyle(a.days_left)} hover:opacity-90 transition-opacity`}
            >
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs opacity-90">
                  Ends {formatProbationDate(a.probation_end_date)} · {a.days_left} day{a.days_left !== 1 ? "s" : ""} left
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ events }: { events: DashboardData["activityFeed"] }) {
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Activity</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p></CardContent>
      </Card>
    );
  }
  const severityIcon: Record<string, any> = { info: Info, warning: AlertTriangle, critical: AlertCircle };
  const severityColor: Record<string, string> = { info: "text-blue-500", warning: "text-yellow-600", critical: "text-red-600" };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
      <CardContent className="space-y-0">
        {events.map((ev, i) => {
          const SevIcon = severityIcon[ev.severity] || Info;
          return (
            <div key={i}>
              {i > 0 && <Separator className="my-1.5" />}
              <div className="flex items-start gap-2.5 py-1.5">
                <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[ev.severity] || "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug">{ev.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(ev.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} &middot; {new Date(ev.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {ev.link && <Link href={ev.link}><ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" /></Link>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ==================== EMPLOYEE DASHBOARD ====================

function EmployeeDashboard({ data }: { data: DashboardData }) {
  const queryClient = useQueryClient();
  const [checkingIn, setCheckingIn] = useState(false);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await apiRequest("POST", "/api/attendance/check-in");
      toast.success("Checked in!");
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch (err: any) { toast.error(err?.message || "Check-in failed"); }
    finally { setCheckingIn(false); }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      await apiRequest("POST", "/api/attendance/check-out");
      toast.success("Checked out!");
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch (err: any) { toast.error(err?.message || "Check-out failed"); }
    finally { setCheckingIn(false); }
  };

  const emp = data.employee;
  const att = data.attendance;
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200" },
    onboarding: { label: "Onboarding", color: "bg-blue-100 text-blue-700 border-blue-200" },
    on_leave: { label: "On Leave", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  };
  const empStatus = statusMap[emp?.employment_status || ""] || { label: emp?.employment_status || "Unknown", color: "" };

  return (
    <div className="space-y-6">
      {/* Greeting + status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {emp?.first_name || "there"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">{emp?.job_title} &middot; {emp?.department}</p>
            <Badge variant="outline" className={empStatus.color}>{empStatus.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!att?.checkedIn && <Button onClick={handleCheckIn} disabled={checkingIn} className="gap-2"><LogIn className="h-4 w-4" /> Check In</Button>}
          {att?.checkedIn && !att.checkedOut && <Button onClick={handleCheckOut} disabled={checkingIn} variant="outline" className="gap-2"><LogOut className="h-4 w-4" /> Check Out</Button>}
          {att?.checkedIn && att.checkedOut && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-9 px-3"><CheckCircle className="h-4 w-4 mr-1.5" /> Day complete</Badge>}
          <ActionButton label="Apply Leave" icon={Calendar} href="/leave" />
          <ActionButton label="My Profile" icon={Eye} href={`/employees/${emp?.id}`} />
        </div>
      </div>

      {/* Attendance card */}
      {att && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Today&apos;s Attendance</p>
                <p className="text-xs text-muted-foreground">
                  {att.checkedIn ? `In: ${formatTime(att.checkInTime)}` : "Not checked in yet"}
                  {att.checkedOut ? ` &middot; Out: ${formatTime(att.checkOutTime)}` : ""}
                  {att.status ? ` &middot; ${att.status}` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leave balances */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Leave Balances</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(data.leaveBalances || []).length === 0 ? (
              <Card className="col-span-full"><CardContent className="p-4 text-center text-sm text-muted-foreground">No leave balances. Contact HR to initialize.</CardContent></Card>
            ) : (
              data.leaveBalances!.map((b, i) => {
                const bal = parseFloat(b.balance);
                const max = b.max_balance || 1;
                return (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-1" style={{ backgroundColor: b.color }} />
                    <CardContent className="p-3">
                      <p className="text-xs font-medium truncate">{b.type_name}</p>
                      <p className="text-lg font-bold">{bal}</p>
                      <p className="text-[10px] text-muted-foreground">of {max}</p>
                      <Progress value={Math.min(100, Math.round((bal / max) * 100))} className="h-1 mt-1" />
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Pending leave requests */}
          {(data.pendingLeaveRequests || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Requests</h2>
              <div className="space-y-2">
                {data.pendingLeaveRequests!.map(r => (
                  <Card key={r.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-sm font-medium">{r.type_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.start_date)} – {formatDate(r.end_date)}</span>
                        <span className="text-xs font-medium">{r.total_days}d</span>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Onboarding progress */}
          {data.onboarding && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Onboarding</h2>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Your onboarding is in progress</p>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{data.onboarding.completedCount}/{data.onboarding.taskCount} tasks</Badge>
                  </div>
                  <Progress value={data.onboarding.taskCount > 0 ? Math.round((data.onboarding.completedCount / data.onboarding.taskCount) * 100) : 0} className="h-2" />
                  <Link href="/onboarding">
                    <Button variant="outline" size="sm" className="mt-3 gap-2"><ArrowRight className="h-4 w-4" /> Continue Onboarding</Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Assigned assets */}
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Assets</h2>
          {(data.assets || []).length === 0 ? (
            <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">No assets assigned.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {data.assets!.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Laptop className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.system_name || a.system_type}</p>
                      <p className="text-[10px] text-muted-foreground">{a.serial_number}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <ActivityFeed events={data.activityFeed} />
        </div>
      </div>
    </div>
  );
}

// ==================== MANAGER DASHBOARD ====================

function ManagerDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Overview</h1>
          <p className="text-sm text-muted-foreground">Manage your team and pending actions.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Leave Approvals" icon={CheckCircle} href="/leave" />
          <ActionButton label="Team Attendance" icon={Clock} href="/timesheets" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Team Size" value={data.teamSize || 0} icon={Users} color="bg-blue-100 text-blue-700" />
        <StatCard title="On Leave Today" value={data.teamOnLeave?.length || 0} icon={Calendar} color="bg-yellow-100 text-yellow-700" />
        <StatCard title="Pending Approvals" value={data.pendingApprovals?.length || 0} icon={ClipboardList} color="bg-orange-100 text-orange-700" link="/leave" />
        <StatCard title="Absent (no check-in)" value={data.absentToday?.length || 0} icon={AlertTriangle} color="bg-red-100 text-red-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Pending approvals */}
          {(data.pendingApprovals || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Approvals</h2>
              <div className="space-y-2">
                {data.pendingApprovals!.slice(0, 5).map((a: any) => (
                  <Card key={a.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{a.first_name?.[0]}{a.last_name?.[0]}</AvatarFallback></Avatar>
                        <div>
                          <p className="text-sm font-medium">{a.first_name} {a.last_name}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" style={{ borderColor: a.color, color: a.color }} className="text-[10px]">{a.type_name}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(a.start_date)} – {formatDate(a.end_date)}</span>
                          </div>
                        </div>
                      </div>
                      <Link href="/leave"><Button size="sm" variant="outline" className="gap-1 h-7 text-xs"><Eye className="h-3 w-3" /> Review</Button></Link>
                    </CardContent>
                  </Card>
                ))}
                {data.pendingApprovals!.length > 5 && (
                  <Link href="/leave"><Button variant="ghost" size="sm" className="w-full text-xs">View all {data.pendingApprovals!.length} approvals <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
                )}
              </div>
            </>
          )}

          {/* Team on leave today */}
          {(data.teamOnLeave || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">On Leave Today</h2>
              <Card>
                <CardContent className="p-3 space-y-1">
                  {data.teamOnLeave!.map(m => (
                    <PersonChip key={m.id} name={`${m.first_name} ${m.last_name}`} subtitle={m.type_name} link={`/employees/${m.id}`} />
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          {/* Absent today */}
          {(data.absentToday || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Absent / No Check-in
              </h2>
              <Card>
                <CardContent className="p-3 space-y-1">
                  {data.absentToday!.map(m => (
                    <PersonChip key={m.id} name={`${m.first_name} ${m.last_name}`} subtitle={m.department} link={`/employees/${m.id}`} />
                  ))}
                </CardContent>
              </Card>
            </>
          )}

          {/* In notice */}
          {(data.inNotice || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">In Notice Period</h2>
              <Card>
                <CardContent className="p-3 space-y-1">
                  {data.inNotice!.map(m => (
                    <PersonChip key={m.id} name={`${m.first_name} ${m.last_name}`} subtitle={`${m.offboarding_type} &middot; LWD: ${formatDate(m.last_working_date)}`} link={`/employees/${m.id}`} />
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* My quick stats */}
          {data.attendance && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">My Status</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attendance</span>
                  <Badge variant="outline" className={data.attendance.checkedIn ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
                    {data.attendance.checkedIn ? (data.attendance.checkedOut ? "Complete" : "Checked In") : "Not In"}
                  </Badge>
                </div>
                {(data.leaveBalances || []).slice(0, 2).map((b, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{b.type_name}</span>
                    <span className="font-medium">{parseFloat(b.balance)}d</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <ActivityFeed events={data.activityFeed} />
        </div>
      </div>
    </div>
  );
}

// ==================== HR DASHBOARD ====================

function HRDashboard({ data, probationAlerts = [] }: { data: DashboardData; probationAlerts?: ProbationAlert[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">HR Operations</h1>
          <p className="text-sm text-muted-foreground">Focus on what needs attention.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Recruitment" icon={UserPlus} href="/recruitment" />
          <ActionButton label="Onboarding" icon={ClipboardList} href="/onboarding" />
          <ActionButton label="Offboarding" icon={LogOut} href="/offboarding" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Employees" value={data.headcount || 0} icon={Users} color="bg-blue-100 text-blue-700" subtext={`+${data.joinersToday || 0} today / -${data.leaversToday || 0} today`} link="/employees" />
        <StatCard title="In Interviews" value={data.interviewStage?.length || 0} icon={Briefcase} color="bg-purple-100 text-purple-700" link="/recruitment" />
        <StatCard title="Onboarding" value={data.pendingOnboarding?.length || 0} icon={UserCheck} color="bg-green-100 text-green-700" link="/onboarding" />
        <StatCard title="Tentative Pending" value={data.tentativePending?.length || 0} icon={FileText} color="bg-orange-100 text-orange-700" link="/recruitment" />
        <StatCard title="Offboarding" value={data.offboardingPending?.length || 0} icon={LogOut} color="bg-red-100 text-red-700" link="/offboarding" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Probation alerts */}
          <ProbationAlertsCard alerts={probationAlerts} />

          {/* Risk indicators */}
          {data.risks && (data.risks.noManager > 0 || data.risks.noLeavePolicy > 0 || data.risks.stuckTentative > 0 || data.risks.offboardingNoAssetReturn > 0) && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" /> Risk Indicators
              </h2>
              <div className="space-y-2">
                <RiskBadge count={data.risks.noManager} label="Employees without a manager assigned" severity="warning" />
                <RiskBadge count={data.risks.noLeavePolicy} label="Employees without leave balances initialized" severity="warning" />
                <RiskBadge count={data.risks.stuckTentative} label="Tentative hires stuck > 7 days" severity="critical" />
                <RiskBadge count={data.risks.offboardingNoAssetReturn} label="Offboarding with unreturned assets" severity="critical" />
              </div>
            </>
          )}

          {/* Tentative hires */}
          {(data.tentativePending || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tentative Hires — Document Verification</h2>
              <div className="space-y-2">
                {data.tentativePending!.map((t: any) => (
                  <Card key={t.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.first_name} {t.last_name}</p>
                        <p className="text-xs text-muted-foreground">{t.verified_count}/{t.doc_count} docs verified &middot; Since {formatDate(t.created_at)}</p>
                      </div>
                      <Link href="/recruitment"><Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" /> Review</Button></Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Onboarding in progress */}
          {(data.pendingOnboarding || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Onboarding In Progress</h2>
              <div className="space-y-2">
                {data.pendingOnboarding!.map((o: any) => (
                  <Card key={o.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{o.first_name} {o.last_name}</p>
                        <p className="text-xs text-muted-foreground">{o.department} &middot; {o.completed_count}/{o.task_count} tasks done</p>
                      </div>
                      <Progress value={o.task_count > 0 ? Math.round((o.completed_count / o.task_count) * 100) : 0} className="w-20 h-1.5" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Offboarding pending */}
          {(data.offboardingPending || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Offboarding Pending</h2>
              <div className="space-y-2">
                {data.offboardingPending!.map((o: any) => (
                  <Card key={o.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{o.first_name} {o.last_name}</p>
                        <p className="text-xs text-muted-foreground">{o.department} &middot; {o.offboarding_type} &middot; LWD: {formatDate(o.last_working_date)}</p>
                      </div>
                      <Link href="/offboarding"><Button size="sm" variant="outline" className="h-7 text-xs">View</Button></Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Interviews */}
          {(data.interviewStage || []).length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Candidates in Interview Stage</h2>
              <div className="space-y-2">
                {data.interviewStage!.map((a: any) => (
                  <Card key={a.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.first_name} {a.last_name}</p>
                        <p className="text-xs text-muted-foreground">{a.job_title} — {a.department}</p>
                      </div>
                      <Link href="/recruitment"><Button size="sm" variant="ghost" className="h-7 text-xs">Pipeline <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right */}
        <div className="space-y-4">
          <ActivityFeed events={data.activityFeed} />
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN / EXECUTIVE DASHBOARD ====================

function AdminDashboard({ data, probationAlerts = [] }: { data: DashboardData; probationAlerts?: ProbationAlert[] }) {
  const depts = data.departmentBreakdown || [];
  const maxDept = Math.max(...depts.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">Organization health at a glance.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Employees" icon={Users} href="/employees" />
          <ActionButton label="Recruitment" icon={UserPlus} href="/recruitment" />
          <ActionButton label="Leave Calendar" icon={Calendar} href="/leave" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Headcount" value={data.headcount || 0} icon={Users} color="bg-blue-100 text-blue-700" link="/employees" />
        <StatCard title="Joiners (month)" value={data.joinersThisMonth || 0} icon={TrendingUp} color="bg-green-100 text-green-700" />
        <StatCard title="Leavers (month)" value={data.leaversThisMonth || 0} icon={TrendingDown} color="bg-red-100 text-red-700" />
        <StatCard title="Attrition (month)" value={data.attritionThisMonth || 0} icon={LogOut} color="bg-orange-100 text-orange-700" />
        <StatCard
          title="Attendance Today"
          value={`${data.attendanceToday?.percentage || 0}%`}
          icon={Clock}
          color="bg-purple-100 text-purple-700"
          subtext={`${data.attendanceToday?.present || 0} / ${data.attendanceToday?.total || 0}`}
          link="/timesheets"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Probation alerts */}
          <ProbationAlertsCard alerts={probationAlerts} />

          {/* Department headcount */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Department Headcount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {depts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No department data.</p>
              ) : (
                depts.map(d => (
                  <div key={d.department} className="flex items-center gap-3">
                    <span className="text-sm w-28 truncate">{d.department || "Unassigned"}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{d.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Open risks from HR data */}
          {data.hr?.risks && (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Shield className="h-4 w-4" /> Operational Risks
              </h2>
              <div className="space-y-2">
                <RiskBadge count={data.hr.risks.noManager} label="Employees without manager" severity="warning" />
                <RiskBadge count={data.hr.risks.noLeavePolicy} label="Employees without leave policy" severity="warning" />
                <RiskBadge count={data.hr.risks.stuckTentative} label="Tentative hires stuck > 7 days" severity="critical" />
                <RiskBadge count={data.hr.risks.offboardingNoAssetReturn} label="Offboarding with unreturned assets" severity="critical" />
              </div>
            </>
          )}

          {/* Asset snapshot */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Laptop className="h-4 w-4" /> Asset Snapshot</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{(data as any).assets?.assigned || 0}</p>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(data as any).assets?.stock_items || 0}</p>
                  <p className="text-xs text-muted-foreground">In Stock</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(data as any).assets?.pending_return || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Return</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open operational pipelines */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Open Pipelines</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{(data as any).openRisks?.onboarding || (data.hr?.pendingOnboarding?.length || 0)}</p>
                  <p className="text-xs text-muted-foreground">Onboarding</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(data as any).openRisks?.tentative || (data.hr?.tentativePending?.length || 0)}</p>
                  <p className="text-xs text-muted-foreground">Tentative</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(data as any).openRisks?.offboarding || (data.hr?.offboardingPending?.length || 0)}</p>
                  <p className="text-xs text-muted-foreground">Offboarding</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <ActivityFeed events={data.activityFeed} />
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN DASHBOARD ====================

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
    refetchInterval: 60_000, // Refresh every 60s
    staleTime: 30_000,
  });

  const role = (data?.role ?? "employee").toString().toLowerCase();
  const { data: probationAlerts = [] } = useQuery<ProbationAlert[]>({
    queryKey: ["/api/dashboard/probation-alerts"],
    enabled: (role === "hr" || role === "admin") && !!data && !data.error,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm text-muted-foreground">Failed to load dashboard.</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] })}>Retry</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (data.error) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{data.error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {(role === "employee" || role === "it") && <EmployeeDashboard data={data} />}
      {role === "manager" && <ManagerDashboard data={data} />}
      {role === "hr" && <HRDashboard data={data} probationAlerts={probationAlerts} />}
      {role === "admin" && <AdminDashboard data={data} probationAlerts={probationAlerts} />}
      {!["employee", "it", "manager", "hr", "admin"].includes(role) && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-500 mb-3" />
          <p className="text-sm text-muted-foreground">Unknown role: {data.role}. Dashboard is available for Employee, IT, Manager, HR, and Admin.</p>
        </div>
      )}
    </Layout>
  );
}
