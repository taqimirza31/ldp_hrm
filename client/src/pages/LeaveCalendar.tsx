import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

const leaveRequests = [
  { id: 1, user: "Neo Anderson", type: "Vacation", start: new Date(2024, 10, 12), end: new Date(2024, 10, 15), status: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  { id: 2, user: "Trinity Moss", type: "Sick Leave", start: new Date(2024, 10, 14), end: new Date(2024, 10, 14), status: "Pending", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { id: 3, user: "Morpheus King", type: "Conference", start: new Date(2024, 10, 18), end: new Date(2024, 10, 20), status: "Approved", color: "bg-blue-100 text-blue-700 border-blue-200" },
];

export default function LeaveCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Leave Management</h1>
          <p className="text-slate-500 text-sm">Team availability and time-off requests.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700">
            <Filter className="h-4 w-4 mr-2" /> Filter Team
          </Button>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Request Leave
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-500" />
                  November 2024
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              
              {/* Mock Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 35 }).map((_, i) => {
                  const dayNum = i - 2; // Offset for mockup
                  const isToday = dayNum === 14;
                  const hasEvent = dayNum === 12 || dayNum === 14 || dayNum === 18;
                  
                  return (
                    <div key={i} className={`bg-white min-h-[100px] p-2 hover:bg-slate-50 transition-colors relative group ${dayNum < 1 || dayNum > 30 ? 'bg-slate-50/50 text-slate-300' : ''}`}>
                      <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-700'}`}>
                        {dayNum > 0 && dayNum <= 30 ? dayNum : ''}
                      </span>
                      
                      {hasEvent && dayNum > 0 && (
                        <div className="mt-2 space-y-1">
                          {leaveRequests.filter(r => r.start.getDate() <= dayNum && r.end.getDate() >= dayNum).map((req, idx) => (
                            <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${req.color} border`}>
                              {req.user}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Pending Requests</h3>
              <div className="space-y-4">
                {leaveRequests.filter(r => r.status === 'Pending').map((req) => (
                  <div key={req.id} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={`https://github.com/shadcn.png`} />
                      <AvatarFallback>TM</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{req.user}</p>
                      <p className="text-xs text-slate-500 mb-2">{req.type} • {format(req.start, 'MMM d')}</p>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 hover:bg-red-50 border-red-200">Deny</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm bg-blue-600 text-white">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-1">Who's Away?</h3>
              <p className="text-blue-100 text-sm mb-4">3 people are on leave today.</p>
              <div className="flex -space-x-2 overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <Avatar key={i} className="inline-block border-2 border-blue-600 h-8 w-8 ring-2 ring-white/20">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>U{i}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
