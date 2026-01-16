import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, DollarSign, TrendingUp, UserPlus, Clock, ArrowUpRight, 
  ArrowDownRight, Activity, MoreHorizontal, Briefcase, ShieldAlert,
  Globe, Heart
} from "lucide-react";
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

const StatsCard = ({ title, value, trend, icon: Icon, colorClass, subtext }: any) => {
  const isPositive = trend > 0;
  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200 bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-card-foreground tracking-tight mb-1">{value}</h3>
          <p className="text-sm text-muted-foreground font-medium mb-3">{title}</p>
          <div className="flex items-center gap-2">
            <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-muted-foreground text-xs">{subtext || "vs last month"}</span>
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
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Overview of HR operations, finance, and company health.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
            Download Report
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Employees" 
          value="1,248" 
          trend={12} 
          icon={Users} 
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
        />
        <StatsCard 
          title="Payroll Status" 
          value="Pending" 
          trend={0} 
          icon={DollarSign} 
          colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400" 
          subtext="Run Due in 2d"
        />
        <StatsCard 
          title="Interviews Today" 
          value="5" 
          trend={2} 
          icon={Briefcase} 
          colorClass="bg-orange-500/10 text-orange-600 dark:text-orange-400" 
          subtext="2 Technical, 3 HR"
        />
        <StatsCard 
          title="Open Tickets" 
          value="12" 
          trend={-5} 
          icon={ShieldAlert} 
          colorClass="bg-red-500/10 text-red-600 dark:text-red-400" 
          subtext="3 High Priority"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-card-foreground">Analytics Overview</h3>
              <p className="text-sm text-muted-foreground">Employee retention vs payroll costs</p>
            </div>
            <select className="text-sm border-none bg-muted rounded-md px-3 py-1.5 text-muted-foreground focus:ring-0 cursor-pointer">
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                />
                <Area type="monotone" dataKey="retention" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRetention)" />
                <Area type="monotone" dataKey="payroll" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorPayroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-card-foreground mb-4">Live Activity Feed</h3>
          <div className="space-y-6 relative">
             {/* Vertical line connector */}
            <div className="absolute left-[19px] top-2 bottom-4 w-px bg-muted -z-10" />
            
            {[
              { user: "Anonymous", action: "Submitted Ethics Report", time: "2m ago", initial: "WB", colorClass: "bg-red-500/10 text-red-600 dark:text-red-400", icon: ShieldAlert },
              { user: "Sarah Connor", action: "Approved Payroll Run", time: "1h ago", initial: "SC", colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: DollarSign },
              { user: "System", action: "Daily Backup Completed", time: "3h ago", initial: "SY", colorClass: "bg-green-500/10 text-green-600 dark:text-green-400", icon: Activity },
              { user: "Neo Anderson", action: "Clocked In (Remote)", time: "5h ago", initial: "NA", colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Clock },
              { user: "Jane Smith", action: "Requested Leave", time: "1d ago", initial: "JS", colorClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400", icon: UserPlus }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-4 ring-card ${item.colorClass}`}>
                  {item.icon ? <item.icon className="h-4 w-4" /> : <span className="text-xs font-bold">{item.initial}</span>}
                </div>
                <div className="pt-1">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.user} • {item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground">
            View Audit Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-blue-500/50 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg"><Globe className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Diversity Score</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">8.4/10</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-500/10 px-2 py-1 rounded-full">+0.2</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-pink-500/50 transition-colors cursor-pointer group">
           <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-lg"><Heart className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">Employee Pulse</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">78%</span>
            <span className="text-xs text-pink-600 dark:text-pink-400 font-medium bg-pink-500/10 px-2 py-1 rounded-full">Positive</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-orange-500/50 transition-colors cursor-pointer group">
           <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg"><ShieldAlert className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Compliance</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">3</span>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium bg-orange-500/10 px-2 py-1 rounded-full">Actions Needed</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
