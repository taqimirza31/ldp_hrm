import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Plus, MoreHorizontal } from "lucide-react";

const shifts = [
  { id: 1, name: "Morning Shift", time: "08:00 - 16:00", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: 2, name: "Evening Shift", time: "16:00 - 00:00", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: 3, name: "Night Shift", time: "00:00 - 08:00", color: "bg-slate-800 text-slate-300 border-slate-700" },
];

const employees = [
  { name: "John Wick", role: "Security", avatar: "https://github.com/shadcn.png" },
  { name: "Sarah Connor", role: "Manager", avatar: "https://github.com/shadcn.png" },
  { name: "Neo Anderson", role: "Tech Lead", avatar: "https://github.com/shadcn.png" },
];

export default function Shifts() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Shift Scheduling</h1>
          <p className="text-slate-500 text-sm">Manage team rosters and coverage.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Publish Schedule</Button>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Shift
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
        {/* Employees Sidebar (Draggable Source) */}
        <Card className="w-full lg:w-64 border border-slate-200 shadow-sm h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Team Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employees.map((emp, i) => (
              <div key={i} className="p-2 flex items-center gap-3 hover:bg-slate-50 rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 transition-all">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={emp.avatar} />
                  <AvatarFallback>{emp.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-slate-900">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.role}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Calendar Grid */}
        <Card className="flex-1 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
            <div className="p-4 text-xs font-bold text-slate-500 uppercase">Shift</div>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="p-4 text-center text-xs font-bold text-slate-900 uppercase border-l border-slate-200">
                {day}
              </div>
            ))}
          </div>
          
          <div className="divide-y divide-slate-200 overflow-y-auto flex-1">
            {shifts.map((shift) => (
              <div key={shift.id} className="grid grid-cols-8 min-h-[120px]">
                <div className="p-4 bg-slate-50/50 border-r border-slate-200">
                  <Badge variant="outline" className={`mb-2 ${shift.color} whitespace-nowrap`}>
                    {shift.name}
                  </Badge>
                  <p className="text-xs text-slate-500 flex items-center">
                    <Clock className="h-3 w-3 mr-1" /> {shift.time}
                  </p>
                </div>
                
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="border-l border-slate-200 p-2 hover:bg-blue-50/30 transition-colors group relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                      <Plus className="h-6 w-6 text-blue-200" />
                    </div>
                    {/* Mocked assigned shifts */}
                    {i === 1 && shift.id === 1 && (
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex items-center gap-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src="https://github.com/shadcn.png" />
                        </Avatar>
                        <span className="text-xs font-bold text-slate-700">John</span>
                      </div>
                    )}
                    {i === 3 && shift.id === 2 && (
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex items-center gap-2 mb-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src="https://github.com/shadcn.png" />
                        </Avatar>
                        <span className="text-xs font-bold text-slate-700">Sarah</span>
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
