import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Download, CheckCircle, AlertCircle, Clock, TrendingUp, FileText, CreditCard, RefreshCw, Calendar, ArrowRight, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStore } from "@/store/useStore";
import { Link } from "wouter";

const costData = [
  { name: 'Engineering', amount: 850000 },
  { name: 'Sales', amount: 620000 },
  { name: 'Product', amount: 450000 },
  { name: 'Marketing', amount: 320000 },
  { name: 'Ops', amount: 180000 },
  { name: 'HR', amount: 120000 },
];

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export default function Payroll() {
  const { employees, payrollRecords } = useStore();

  const currentRecords = payrollRecords.filter(r => r.month === "2024-11");
  const totalDisbursed = currentRecords.reduce((acc, curr) => acc + curr.netSalary, 0);

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground text-sm">Automated salary calculation based on attendance and leave data.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/payslips">
            <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
              <FileText className="h-4 w-4 mr-2" /> View Payslips
            </Button>
          </Link>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
            <CreditCard className="h-4 w-4 mr-2" /> Run Payroll
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-600 dark:bg-blue-700 rounded-xl p-6 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Next Payout</p>
              <h3 className="text-3xl font-bold">Nov 30</h3>
            </div>
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-blue-100">
              <span>Estimated Amount</span>
              <span className="font-bold text-white">${totalDisbursed.toLocaleString()}</span>
            </div>
            <Progress value={65} className="h-2 bg-blue-900/30" />
            <p className="text-xs text-blue-200">Approvals pending: 3 departments</p>
          </div>
        </div>

        {/* Data Sync Status Card - NEW */}
        <div className="bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-foreground">Data Synchronization</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><RefreshCw className="h-3 w-3 text-muted-foreground" /></Button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground">Time & Attendance</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">Synced 2m ago</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground">Leave Management</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">Synced 5m ago</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-foreground">Employee Records</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">Synced 1m ago</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-muted-foreground font-medium">Total Disbursed (YTD)</span>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-1">$28.4M</h3>
          <p className="text-green-600 text-xs font-bold flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" /> +12% from last year
          </p>
        </div>
      </div>

      <Tabs defaultValue="run" className="w-full">
        <TabsList className="mb-8 bg-muted p-1">
          <TabsTrigger value="run">Current Pay Run</TabsTrigger>
          <TabsTrigger value="history">History & Reports</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="mt-0">
           <Card className="border border-border shadow-sm mb-6 bg-card">
             <CardHeader>
               <CardTitle>Payroll Worksheet: Nov 2024</CardTitle>
               <CardDescription>Review calculated salaries before processing.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-1">
                 <div className="grid grid-cols-12 text-xs font-bold text-muted-foreground uppercase px-4 py-3 bg-muted/50 rounded-t-lg border-b border-border">
                   <div className="col-span-3">Employee</div>
                   <div className="col-span-2">Base Pay</div>
                   <div className="col-span-2">Additions</div>
                   <div className="col-span-2">Deductions</div>
                   <div className="col-span-2 text-right">Net Pay</div>
                   <div className="col-span-1 text-center">Status</div>
                 </div>
                 
                 {currentRecords.map((record) => {
                   const emp = employees.find(e => e.id === record.employeeId);
                   if (!emp) return null;
                   
                   return (
                     <div key={record.id} className="grid grid-cols-12 text-sm px-4 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors items-center group cursor-pointer">
                       <div className="col-span-3 flex items-center gap-3">
                         <Avatar className="h-8 w-8">
                           <AvatarImage src={emp.avatar} />
                           <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                         </Avatar>
                         <div>
                           <p className="font-bold text-foreground">{emp.name}</p>
                           <p className="text-xs text-muted-foreground">{emp.role}</p>
                         </div>
                       </div>
                       <div className="col-span-2 font-mono text-muted-foreground">${record.baseSalary.toLocaleString()}</div>
                       <div className="col-span-2">
                         <p className="font-mono text-green-600">+${record.additions}</p>
                         {record.additions > 0 && <p className="text-[10px] text-muted-foreground">Overtime / Bonus</p>}
                       </div>
                       <div className="col-span-2">
                         <p className="font-mono text-red-600">-${record.deductions}</p>
                         {record.deductions > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-red-400">
                              <AlertCircle className="h-3 w-3" /> {record.unpaidLeaves} Unpaid Leaves
                            </div>
                         )}
                       </div>
                       <div className="col-span-2 text-right font-mono font-bold text-foreground text-base">
                         ${record.netSalary.toLocaleString()}
                       </div>
                       <div className="col-span-1 flex justify-center">
                         <Badge variant="outline" className={
                           record.status === 'Paid' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                         }>
                           {record.status}
                         </Badge>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-foreground mb-6">Cost Distribution by Department</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={12} width={80} stroke="var(--muted-foreground)" />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} 
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={32}>
                      {costData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
              <h3 className="font-semibold text-foreground mb-4">Recent Runs</h3>
              <div className="space-y-4">
                {[
                  { id: "PR-2024-001", date: "Oct 31, 2024", employees: 1242, amount: "2,450,000", status: "Completed" },
                  { id: "PR-2024-002", date: "Nov 15, 2024", employees: 1245, amount: "2,480,000", status: "Completed" },
                  { id: "PR-2024-003", date: "Nov 30, 2024", employees: 1248, amount: "2,510,000", status: "Processing" },
                ].map((run) => (
                  <div key={run.id} className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-foreground text-sm">{run.date}</p>
                        <p className="text-xs text-muted-foreground">ID: {run.id}</p>
                      </div>
                      <Badge variant="secondary" className={`
                        ${run.status === 'Completed' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'}
                      `}>
                        {run.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{run.employees} Employees</span>
                      <span className="font-mono font-medium text-foreground">${run.amount}</span>
                    </div>
                    {run.status === 'Completed' && (
                      <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-xs text-muted-foreground hover:text-primary">
                        <Download className="h-3 w-3 mr-2" /> Download Report
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
