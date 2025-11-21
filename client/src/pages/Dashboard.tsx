import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, UserPlus, Clock, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from "framer-motion";

const data = [
  { name: 'Jan', retention: 95, payroll: 120 },
  { name: 'Feb', retention: 93, payroll: 130 },
  { name: 'Mar', retention: 96, payroll: 125 },
  { name: 'Apr', retention: 94, payroll: 140 },
  { name: 'May', retention: 98, payroll: 135 },
  { name: 'Jun', retention: 97, payroll: 150 },
  { name: 'Jul', retention: 99, payroll: 160 },
];

const StatsCard = ({ title, value, trend, icon: Icon, color }: any) => (
  <Card className="glass-panel border-t border-t-white/10 bg-gradient-to-br from-white/5 to-transparent overflow-hidden relative group">
    <div className={`absolute top-0 left-0 w-full h-1 bg-${color}`} />
    <div className={`absolute -right-6 -top-6 w-24 h-24 bg-${color}/10 rounded-full blur-2xl group-hover:bg-${color}/20 transition-all duration-500`} />
    
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-muted-foreground font-tech uppercase tracking-wider text-xs mb-1">{title}</p>
          <h3 className="text-3xl font-display font-bold text-white tracking-wide">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg bg-${color}/10 text-${color} border border-${color}/20 shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={`flex items-center text-xs font-bold ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
          {Math.abs(trend)}%
        </span>
        <span className="text-muted-foreground/60 text-xs font-tech">vs last month</span>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">
            Welcome Back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Sarah</span>
          </h1>
          <p className="text-muted-foreground font-tech text-lg">Here's what's happening at Admani Holdings today.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-sm font-tech uppercase tracking-widest text-white transition-all">
            Download Report
          </button>
          <button className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-md text-sm font-tech uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all">
            Add Employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title="Total Employees" value="1,248" trend={12} icon={Users} color="primary" />
        <StatsCard title="Monthly Payroll" value="$2.4M" trend={5.2} icon={DollarSign} color="accent" />
        <StatsCard title="Retention Rate" value="98.2%" trend={-0.4} icon={Activity} color="green-500" />
        <StatsCard title="Open Positions" value="24" trend={15} icon={UserPlus} color="yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display text-lg text-white">Analytics Overview</h3>
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-tech uppercase">Live Data</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(3, 7, 18, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="retention" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRetention)" />
                <Area type="monotone" dataKey="payroll" stroke="hsl(var(--accent))" strokeWidth={3} fillOpacity={1} fill="url(#colorPayroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <h3 className="font-display text-lg text-white mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {[
              { user: "Alex Morgan", action: "Applied for Senior Dev", time: "2m ago", color: "primary" },
              { user: "Sarah Connor", action: "Approved Payroll Run", time: "1h ago", color: "accent" },
              { user: "System", action: "Backup Completed", time: "3h ago", color: "green-500" },
              { user: "John Doe", action: "Updated Profile", time: "5h ago", color: "primary" },
              { user: "Jane Smith", action: "Requested Leave", time: "1d ago", color: "yellow-500" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
                <div className={`w-2 h-2 rounded-full bg-${item.color} shadow-[0_0_8px_var(--color-${item.color})]`} />
                <div className="flex-1">
                  <p className="text-sm text-white font-medium group-hover:text-primary transition-colors">{item.action}</p>
                  <p className="text-xs text-muted-foreground font-tech">{item.user}</p>
                </div>
                <span className="text-xs text-muted-foreground/50 font-tech">{item.time}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 border border-white/10 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all font-tech uppercase tracking-wider">
            View All Logs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["Performance Reviews Due", "Upcoming Birthdays", "Training Compliance"].map((title, i) => (
          <div key={i} className="glass-panel p-5 rounded-lg border-l-4 border-l-primary hover:border-l-accent transition-colors duration-300">
            <h4 className="font-display text-sm text-white mb-2">{title}</h4>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold font-tech text-white">12</span>
              <span className="text-xs text-primary cursor-pointer hover:underline">View Details &rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
