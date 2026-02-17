import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  User, Lock, Bell, Globe, Shield, CreditCard, 
  Building, Mail, Smartphone, Slack, Key, LogOut,
  Palette, Users, Link as LinkIcon, Database, UserCog, Plus
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

const ROLES = ["admin", "hr", "manager", "employee", "it"] as const;

/** Module keys and labels for access control. Must match Layout sidebar hrefs (path without leading slash). */
const MODULE_GROUPS: { title: string; modules: { key: string; label: string }[] }[] = [
  { title: "Overview", modules: [{ key: "dashboard", label: "Dashboard" }, { key: "news", label: "Company Feed" }, { key: "tasks", label: "Tasks" }, { key: "documents", label: "Documents" }] },
  { title: "People", modules: [{ key: "employees", label: "Employees" }, { key: "change-requests", label: "Change requests" }, { key: "org-chart", label: "Org Chart" }, { key: "recruitment", label: "Recruitment" }, { key: "onboarding", label: "Onboarding" }, { key: "offboarding", label: "Offboarding" }] },
  { title: "Operations", modules: [{ key: "shifts", label: "Shifts" }, { key: "timesheets", label: "Timesheets" }, { key: "leave", label: "Leave Calendar" }, { key: "service-desk", label: "Service Desk" }, { key: "it-support", label: "IT Support" }, { key: "rooms", label: "Rooms" }, { key: "assets", label: "Asset Management" }, { key: "visitors", label: "Visitors" }, { key: "timezones", label: "Timezones" }, { key: "emergency", label: "Emergency" }] },
  { title: "Finance & Legal", modules: [{ key: "payroll", label: "Payroll" }, { key: "loans", label: "Loans & Advances" }, { key: "expenses", label: "Expenses" }, { key: "benefits", label: "Benefits" }, { key: "salary", label: "Salary Benchmark" }, { key: "compliance", label: "Compliance" }, { key: "whistleblower", label: "Whistleblower" }, { key: "audit", label: "Audit Logs" }] },
  { title: "Growth & Culture", modules: [{ key: "performance", label: "Performance" }, { key: "goals", label: "Goals & OKRs" }, { key: "surveys", label: "Surveys" }, { key: "kudos", label: "Kudos" }, { key: "training", label: "Training LMS" }, { key: "diversity", label: "Diversity" }, { key: "succession", label: "Succession" }] },
  { title: "System", modules: [{ key: "health", label: "System Health" }, { key: "project-tracking", label: "Project Tracking" }, { key: "settings", label: "Settings" }] },
];

const sidebarNavItems = [
  { title: "General", icon: Building, id: "general" },
  { title: "Profile", icon: User, id: "profile" },
  { title: "Appearance", icon: Palette, id: "appearance" },
  { title: "Notifications", icon: Bell, id: "notifications" },
  { title: "Security", icon: Shield, id: "security" },
  { title: "Billing", icon: CreditCard, id: "billing" },
  { title: "Integrations", icon: Database, id: "integrations" },
  { title: "User access", icon: UserCog, id: "user-access", adminOnly: true },
];

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const visibleNavItems = sidebarNavItems.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || user?.role === "admin"
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row gap-8 min-h-[calc(100vh-100px)]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-6">
            <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">Settings</h1>
            <p className="text-slate-500 text-sm mb-6">Manage your workspace.</p>
            
            <nav className="space-y-1">
              {visibleNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    activeTab === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </nav>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
               <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <LogOut className="h-4 w-4" />
                  Sign Out
               </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          {activeTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-lg font-bold text-slate-900">General Settings</h2>
                <p className="text-sm text-slate-500">Manage your company information and preferences.</p>
              </div>
              <Separator />
              
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" defaultValue="Admani Holdings" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="domain">Primary Domain</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                        https://
                      </span>
                      <Input id="domain" defaultValue="admani.com" className="rounded-l-none" />
                    </div>
                  </div>
                   <div className="grid gap-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="Pacific Time (US & Canada)" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="about">About Company</Label>
                  <Input id="about" defaultValue="Leading logistics and supply chain solutions provider." />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                <h2 className="text-lg font-bold text-slate-900">Appearance</h2>
                <p className="text-sm text-slate-500">Customize the look and feel of the dashboard.</p>
              </div>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Dark Mode</Label>
                    <p className="text-sm text-slate-500">Switch between light and dark themes.</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Compact Density</Label>
                    <p className="text-sm text-slate-500">Show more content on the screen.</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === "user-access" && <UserAccessSection />}

          {activeTab === "integrations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                <h2 className="text-lg font-bold text-slate-900">Integrations</h2>
                <p className="text-sm text-slate-500">Connect with third-party tools and services.</p>
              </div>
              <Separator />
              
              <div className="grid gap-4">
                {[
                  { name: "Slack", desc: "Receive notifications and alerts in your channels.", icon: Slack, connected: true },
                  { name: "Google Workspace", desc: "Sync calendar and contacts.", icon: Globe, connected: true },
                  { name: "Zoom", desc: "Schedule meetings directly from calendar.", icon: Globe, connected: false },
                  { name: "JIRA", desc: "Link issues to project tasks.", icon: LinkIcon, connected: false },
                  { name: "Microsoft 365", desc: "Sync Outlook calendar and documents.", icon: Globe, connected: false },
                  { name: "Microsoft Teams", desc: "Collaborate and schedule meetings.", icon: Users, connected: false },
                ].map((app) => (
                  <div key={app.name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-blue-200 transition-colors bg-white">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <app.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{app.name}</h4>
                        <p className="text-xs text-slate-500">{app.desc}</p>
                      </div>
                    </div>
                    <Button variant={app.connected ? "outline" : "default"} size="sm">
                      {app.connected ? "Configure" : "Connect"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder for other tabs */}
          {["profile", "notifications", "security", "billing"].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <SettingsIcon className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Work in Progress</h3>
              <p className="text-slate-500 max-w-sm mt-2">This settings section is currently being developed. Check back later for updates.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

/** Admin-only: list users, add user (register), edit role & link to employee */
function UserAccessSection() {
  const queryClient = useQueryClient();
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<string>("employee");
  const [addEmployeeId, setAddEmployeeId] = useState<string>("");
  const [addUseMicrosoft, setAddUseMicrosoft] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [editEmployeeId, setEditEmployeeId] = useState<string>("");
  const [editActive, setEditActive] = useState(true);
  const [editUseRoleBased, setEditUseRoleBased] = useState(true);
  const [editAllowedModules, setEditAllowedModules] = useState<string[]>([]);
  const [modulesOpen, setModulesOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<Array<{
    id: string; email: string; role: string; employeeId: string | null; isActive: boolean; allowedModules: string[];
    employeeName: string | null; jobTitle: string | null; department: string | null;
  }>>({
    queryKey: ["/api/auth/users"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/auth/users");
      return r.json();
    },
  });

  const { data: employees = [] } = useQuery<Array<{ id: string; first_name: string; last_name: string; job_title: string; department: string; work_email?: string }>>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/employees");
      return r.json();
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (body: { email: string; password: string; role: string; employeeId?: string | null; authProvider?: "local" | "microsoft" }) => {
      const r = await apiRequest("POST", "/api/auth/register", body);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Registration failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast.success("User created");
      setAddEmail(""); setAddPassword(""); setAddRole("employee"); setAddEmployeeId(""); setAddUseMicrosoft(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, role, employeeId, isActive, allowedModules }: { id: string; role?: string; employeeId?: string | null; isActive?: boolean; allowedModules?: string[] }) => {
      const r = await apiRequest("PATCH", `/api/auth/users/${id}`, { role, employeeId, isActive, allowedModules });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setEditingId(null);
      toast.success("User updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (u: (typeof users)[0]) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditEmployeeId(u.employeeId || "");
    setEditActive(u.isActive);
    const mods = u.allowedModules ?? [];
    setEditAllowedModules(mods);
    setEditUseRoleBased(mods.length === 0);
    setModulesOpen(false);
  };

  const toggleModule = (key: string, checked: boolean) => {
    setEditAllowedModules((prev) => checked ? [...prev, key] : prev.filter((k) => k !== key));
  };

  // Guard: find employees linked to multiple users
  const linkedEmployeeIds = users.filter((u) => u.employeeId).map((u) => u.employeeId!);
  const duplicateEmployeeIds = new Set(linkedEmployeeIds.filter((eid, i) => linkedEmployeeIds.indexOf(eid) !== i));
  // Employees with no user account
  const linkedSet = new Set(linkedEmployeeIds);
  const unlinkedEmployees = employees.filter((e) => !linkedSet.has(e.id));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">User access</h2>
        <p className="text-sm text-slate-500">Create users and assign roles (Admin, HR, Manager, Employee, IT) or link them to an employee record.</p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add user
          </CardTitle>
          <CardDescription>Create a new login. They can sign in with email and password (or SSO if configured).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder={addUseMicrosoft ? "Leave blank for SSO only" : "Min 8 characters"}
              />
              {addEmployeeId && (
                <p className="text-xs text-muted-foreground">Work emails use Microsoft sign-in. They can use <strong>Sign in with Microsoft</strong> or the password above.</p>
              )}
            </div>
            {addEmployeeId && (
              <div className="space-y-2 flex items-center gap-2">
                <Checkbox id="add-use-microsoft" checked={addUseMicrosoft} onCheckedChange={(c) => setAddUseMicrosoft(!!c)} />
                <Label htmlFor="add-use-microsoft" className="text-sm font-normal cursor-pointer">Use Microsoft sign-in (no password needed)</Label>
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link to employee (optional)</Label>
              <Select
                value={addEmployeeId || "__none__"}
                onValueChange={(v) => {
                  const empId = v === "__none__" ? "" : v;
                  setAddEmployeeId(empId);
                  if (empId) {
                    const emp = employees.find((e) => e.id === empId);
                    if (emp?.work_email) setAddEmail(emp.work_email);
                  } else {
                    setAddUseMicrosoft(false);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} {e.job_title ? ` · ${e.job_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
            <Button
            disabled={!addEmail || (!addUseMicrosoft && addPassword.length < 8) || registerMutation.isPending}
            onClick={() => registerMutation.mutate({
              email: addEmail.trim(),
              password: addPassword,
              role: addRole,
              employeeId: addEmployeeId || null,
              authProvider: addUseMicrosoft ? "microsoft" : "local",
            })}
          >
            {registerMutation.isPending ? "Creating…" : "Create user"}
          </Button>
        </CardContent>
      </Card>

      {/* Warnings */}
      {duplicateEmployeeIds.size > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">Warning: {duplicateEmployeeIds.size} employee(s) linked to multiple user accounts. Each employee should have only one login.</p>
          </CardContent>
        </Card>
      )}
      {unlinkedEmployees.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">{unlinkedEmployees.length} employee(s) have no user account and cannot log in.</p>
            <p className="text-xs text-muted-foreground mt-1">{unlinkedEmployees.slice(0, 5).map((e) => `${e.first_name} ${e.last_name}`).join(", ")}{unlinkedEmployees.length > 5 ? ` and ${unlinkedEmployees.length - 5} more` : ""}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
          <CardDescription>Change role or link to an employee. Deactivate to revoke access.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.employeeName || "Not linked"} {u.jobTitle ? ` · ${u.jobTitle}` : ""}
                    </p>
                  </div>
                  {editingId === u.id ? (
                    <>
                      <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editEmployeeId || "__none__"} onValueChange={(v) => setEditEmployeeId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Employee" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Active</Label>
                        <Switch checked={editActive} onCheckedChange={setEditActive} />
                      </div>
                      <Collapsible open={modulesOpen} onOpenChange={setModulesOpen} className="w-full">
                        <CollapsibleTrigger asChild>
                          <Button size="sm" variant="outline">Modules ({editUseRoleBased ? "role-based" : editAllowedModules.length})</Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="use-role-based"
                              checked={editUseRoleBased}
                              onCheckedChange={(v) => { setEditUseRoleBased(!!v); if (v) setEditAllowedModules([]); }}
                            />
                            <Label htmlFor="use-role-based" className="text-sm font-normal cursor-pointer">Use role-based access (default for their role)</Label>
                          </div>
                          {!editUseRoleBased && MODULE_GROUPS.map((grp) => (
                            <div key={grp.title} className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">{grp.title}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {grp.modules.map((m) => (
                                  <div key={m.key} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`mod-${u.id}-${m.key}`}
                                      checked={editAllowedModules.includes(m.key)}
                                      onCheckedChange={(v) => toggleModule(m.key, !!v)}
                                    />
                                    <Label htmlFor={`mod-${u.id}-${m.key}`} className="text-xs font-normal cursor-pointer">{m.label}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                      <Button size="sm" onClick={() => updateMutation.mutate({ id: u.id, role: editRole, employeeId: editEmployeeId || null, isActive: editActive, allowedModules: editUseRoleBased ? [] : editAllowedModules })} disabled={updateMutation.isPending}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      {!u.isActive && <Badge variant="secondary">Inactive</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => startEdit(u)}>Edit</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
