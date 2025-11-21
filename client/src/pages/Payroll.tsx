import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, Download, CheckCircle, AlertCircle, Clock, TrendingUp, FileText, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const payrollHistory = [
  { id: "PR-2024-001", date: "Oct 31, 2024", employees: 1242, amount: "2,450,000", status: "Completed" },
  { id: "PR-2024-002", date: "Nov 15, 2024", employees: 1245, amount: "2,480,000", status: "Completed" },
  { id: "PR-2024-003", date: "Nov 30, 2024", employees: 1248, amount: "2,510,000", status: "Processing" },
];

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
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Payroll Management</h1>
          <p className="text-slate-500 text-sm">Manage salaries, tax deductions, and payment schedules.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700">
            <FileText className="h-4 w-4 mr-2" /> Tax Reports
          </Button>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <CreditCard className="h-4 w-4 mr-2" /> Run Payroll
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Next Payout</p>
              <h3 className="text-3xl font-bold">Nov 30</h3>
            </div>
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-blue-100">
              <span>Estimated Amount</span>
              <span className="font-bold text-white">$2,510,000</span>
            </div>
            <Progress value={65} className="h-2 bg-blue-900/30" indicatorClassName="bg-white" />
            <p className="text-xs text-blue-200">Approvals pending: 3 departments</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-slate-500 font-medium">Total Disbursed (YTD)</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">$28.4M</h3>
          <p className="text-green-600 text-xs font-bold flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" /> +12% from last year
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-slate-500 font-medium">Avg. Processing Time</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">1.2 Days</h3>
          <p className="text-slate-400 text-xs">Faster than industry avg (2.5 days)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-6">Cost Distribution by Department</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={12} width={80} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Runs</h3>
          <div className="space-y-4">
            {payrollHistory.map((run) => (
              <div key={run.id} className="p-4 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors bg-slate-50/50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{run.date}</p>
                    <p className="text-xs text-slate-500">ID: {run.id}</p>
                  </div>
                  <Badge variant="secondary" className={`
                    ${run.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}
                  `}>
                    {run.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{run.employees} Employees</span>
                  <span className="font-mono font-medium text-slate-900">${run.amount}</span>
                </div>
                {run.status === 'Completed' && (
                  <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-xs text-slate-500 hover:text-blue-600">
                    <Download className="h-3 w-3 mr-2" /> Download Report
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function CalendarIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}
