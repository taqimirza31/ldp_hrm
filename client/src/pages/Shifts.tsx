import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, MoreHorizontal, User } from "lucide-react";
import { useStore } from "@/store/useStore";

const shifts = [
  { id: 1, name: "Morning Shift", time: "08:00 - 16:00", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  { id: 2, name: "Evening Shift", time: "16:00 - 00:00", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  { id: 3, name: "Night Shift", time: "00:00 - 08:00", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800" },
];

export default function Shifts() {
  const { employees } = useStore();

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Shift Scheduling</h1>
          <p className="text-muted-foreground text-sm">Manage team rosters and coverage.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">Publish Schedule</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Shift
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-200px)]">
        {/* Employees Sidebar (Draggable Source) */}
        <Card className="w-full lg:w-64 border border-border shadow-sm h-full bg-card flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto flex-1 pr-2">
            {employees.map((emp, i) => (
              <div key={i} className="p-2 flex items-center gap-3 hover:bg-muted rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-border transition-all">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={emp.avatar} />
                  <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card className="flex-1 border border-border shadow-sm overflow-hidden flex flex-col bg-card">
          <div className="grid grid-cols-8 border-b border-border bg-muted/30">
            <div className="p-4 text-xs font-bold text-muted-foreground uppercase">Shift</div>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="p-4 text-center text-xs font-bold text-foreground uppercase border-l border-border">
                {day}
              </div>
            ))}
          </div>
          
          <div className="divide-y divide-border overflow-y-auto flex-1">
            {shifts.map((shift) => (
              <div key={shift.id} className="grid grid-cols-8 min-h-[120px]">
                <div className="p-4 bg-muted/10 border-r border-border flex flex-col justify-center">
                  <Badge variant="outline" className={`mb-2 ${shift.color} whitespace-nowrap self-start`}>
                    {shift.name}
                  </Badge>
                  <p className="text-xs text-muted-foreground flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> {shift.time}
                  </p>
                </div>
                
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="border-l border-border p-2 hover:bg-muted/20 transition-colors group relative cursor-pointer" title="Click to assign shift">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                      <Plus className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    {/* Mocked assigned shifts */}
                    {i === 1 && shift.id === 1 && (
                      <div className="bg-background p-2 rounded border border-border shadow-sm flex items-center gap-2 mb-1 group-hover:border-primary/50 transition-colors cursor-pointer hover:shadow-md z-10 relative">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={employees[0].avatar} />
                          <AvatarFallback>E1</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold text-foreground truncate max-w-[60px]">{employees[0].firstName}</span>
                        <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="h-3 w-3 bg-red-500 rounded-full border border-white" />
                        </div>
                      </div>
                    )}
                    {i === 3 && shift.id === 2 && (
                      <div className="bg-background p-2 rounded border border-border shadow-sm flex items-center gap-2 mb-1 group-hover:border-primary/50 transition-colors cursor-pointer hover:shadow-md z-10 relative">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={employees[1].avatar} />
                          <AvatarFallback>E2</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold text-foreground truncate max-w-[60px]">{employees[1].firstName}</span>
                      </div>
                    )}
                     {i === 5 && shift.id === 3 && (
                      <div className="bg-background p-2 rounded border border-border shadow-sm flex items-center gap-2 mb-1 group-hover:border-primary/50 transition-colors cursor-pointer hover:shadow-md z-10 relative">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={employees[2].avatar} />
                          <AvatarFallback>E3</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold text-foreground truncate max-w-[60px]">{employees[2].firstName}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
