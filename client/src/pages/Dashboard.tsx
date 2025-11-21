import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, UserPlus, Clock, ArrowUpRight, ArrowDownRight, Activity, MoreHorizontal, Briefcase } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from "@/components/ui/button";

const data = [
  { name: 'Jan', retention: 95, payroll: 120 },
  { name: 'Feb', retention: 93, payroll: 130 },
  { name: 'Mar', retention: 96, payroll: 125 },
  { name: 'Apr', retention: 94, payroll: 140 },
  { name: 'May', retention: 98, payroll: 135 },
  { name: 'Jun', retention: 97, payroll: 150 },
  { name: 'Jul', retention: 99, payroll: 160 },
];

const StatsCard = ({ title, value, trend, icon: Icon, color }: any) => {
  const isPositive = trend > 0;
  return (
    <Card className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${color === 'primary' ? 'bg-blue-50 text-blue-600' : color === 'accent' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-600'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">{value}</h3>
          <p className="text-sm text-slate-500 font-medium mb-3">{title}</p>
          <div className="flex items-center gap-2">
            <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-slate-400 text-xs">vs last month</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">
            Dashboard Overview
          </h1>
          <p className="text-slate-500 text-sm">Welcome back, Sarah. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
            Download Report
          </Button>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Total Employees" value="1,248" trend={12} icon={Users} color="primary" />
        <StatsCard title="Monthly Payroll" value="$2.4M" trend={5.2} icon={DollarSign} color="accent" />
        <StatsCard title="Retention Rate" value="98.2%" trend={-0.4} icon={Activity} color="green" />
        <StatsCard title="Open Positions" value="24" trend={15} icon={Briefcase} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-slate-900">Analytics Overview</h3>
              <p className="text-sm text-slate-500">Employee retention vs payroll costs</p>
            </div>
            <select className="text-sm border-none bg-slate-50 rounded-md px-3 py-1.5 text-slate-600 focus:ring-0 cursor-pointer">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b' }}
                />
                <Area type="monotone" dataKey="retention" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRetention)" />
                <Area type="monotone" dataKey="payroll" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorPayroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-6 relative">
             {/* Vertical line connector */}
            <div className="absolute left-[19px] top-2 bottom-4 w-px bg-slate-100 -z-10" />
            
            {[
              { user: "Alex Morgan", action: "Applied for Senior Dev", time: "2m ago", initial: "AM", color: "bg-blue-100 text-blue-600" },
              { user: "Sarah Connor", action: "Approved Payroll Run", time: "1h ago", initial: "SC", color: "bg-purple-100 text-purple-600" },
              { user: "System", action: "Backup Completed", time: "3h ago", initial: "SY", color: "bg-green-100 text-green-600" },
              { user: "John Doe", action: "Updated Profile", time: "5h ago", initial: "JD", color: "bg-orange-100 text-orange-600" },
              { user: "Jane Smith", action: "Requested Leave", time: "1d ago", initial: "JS", color: "bg-pink-100 text-pink-600" }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-white ${item.color}`}>
                  {item.initial}
                </div>
                <div className="pt-1">
                  <p className="text-sm font-medium text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.user} • {item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-4 text-sm text-slate-500 hover:text-slate-900">
            View All Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["Performance Reviews Due", "Upcoming Birthdays", "Training Compliance"].map((title, i) => (
          <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-200 transition-colors cursor-pointer group">
            <h4 className="font-medium text-slate-700 mb-2 group-hover:text-blue-600 transition-colors">{title}</h4>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-slate-900">12</span>
              <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full">Action Required</span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
