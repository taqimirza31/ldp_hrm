import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Globe, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const leaveRequests = [
  { id: 1, user: "Neo Anderson", type: "Vacation", start: new Date(2024, 10, 12), end: new Date(2024, 10, 15), status: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  { id: 2, user: "Trinity Moss", type: "Sick Leave", start: new Date(2024, 10, 14), end: new Date(2024, 10, 14), status: "Pending Manager", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { id: 3, user: "Morpheus King", type: "Conference", start: new Date(2024, 10, 18), end: new Date(2024, 10, 20), status: "Approved", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: 4, user: "John Wick", type: "Personal", start: new Date(2024, 10, 25), end: new Date(2024, 10, 26), status: "Pending HR", color: "bg-purple-100 text-purple-700 border-purple-200" },
];

const policies = [
  { region: "Pakistan", annual: 14, sick: 10, casual: 10, rollover: true },
  { region: "India", annual: 18, sick: 12, casual: 8, rollover: false },
  { region: "USA", annual: 15, sick: 5, casual: 0, rollover: true },
];

export default function LeaveCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Leave Management</h1>
          <p className="text-slate-500 text-sm">Global leave policies and multi-tier approvals.</p>
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

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="mb-8 bg-slate-100 p-1">
          <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" /> Team Calendar</TabsTrigger>
          <TabsTrigger value="approvals"><CheckCircle2 className="h-4 w-4 mr-2" /> Approvals</TabsTrigger>
          <TabsTrigger value="policies"><Globe className="h-4 w-4 mr-2" /> Regional Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0">
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
                      const hasEvent = dayNum === 12 || dayNum === 14 || dayNum === 18 || dayNum === 25;
                      
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
              <Card className="border border-slate-200 shadow-sm bg-blue-600 text-white">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-1">Who's Away?</h3>
                  <p className="text-blue-100 text-sm mb-4">3 people are on leave today.</p>
                  <div className="flex -space-x-2 overflow-hidden">
                    {[1, 2, 3].map((i) => (
                      <Avatar key={i} className="inline-block border-2 border-blue-600 h-8 w-8 ring-2 ring-white/20">
                        <AvatarImage src={`https://ui-avatars.com/api/?background=random&name=User+${i}`} />
                        <AvatarFallback>U{i}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>My Entitlements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Annual Leave</span>
                      <span className="font-bold text-slate-900">12 / 14</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 w-[85%]" />
                    </div>
                  </div>
                   <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Sick Leave</span>
                      <span className="font-bold text-slate-900">8 / 10</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 w-[80%]" />
                    </div>
                  </div>
                   <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Casual Leave</span>
                      <span className="font-bold text-slate-900">5 / 10</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[50%]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Multi-tier approval workflow requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter(r => r.status.includes('Pending')).map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${req.user.replace(' ','+')}`} />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-slate-900">{req.user}</p>
                        <p className="text-sm text-slate-500">{req.type} • {format(req.start, 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                         {req.status}
                       </Badge>
                       <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200">Reject</Button>
                       </div>
                    </div>
                  </div>
                ))}
                {leaveRequests.filter(r => r.status.includes('Pending')).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No pending requests at this time.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-0">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {policies.map((policy) => (
               <Card key={policy.region} className="border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
                 <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                   <div className="flex items-center justify-between">
                     <CardTitle className="flex items-center gap-2">
                       <Globe className="h-4 w-4 text-blue-600" /> {policy.region}
                     </CardTitle>
                     <Button variant="ghost" size="sm" className="h-8">Edit</Button>
                   </div>
                 </CardHeader>
                 <CardContent className="p-6 space-y-4">
                   <div className="flex justify-between py-2 border-b border-slate-100">
                     <span className="text-sm text-slate-600">Annual Leave</span>
                     <span className="font-bold text-slate-900">{policy.annual} days</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-slate-100">
                     <span className="text-sm text-slate-600">Sick Leave</span>
                     <span className="font-bold text-slate-900">{policy.sick} days</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-slate-100">
                     <span className="text-sm text-slate-600">Casual Leave</span>
                     <span className="font-bold text-slate-900">{policy.casual} days</span>
                   </div>
                   <div className="flex justify-between py-2">
                     <span className="text-sm text-slate-600">Rollover Allowed</span>
                     <Badge variant="outline" className={policy.rollover ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600"}>
                       {policy.rollover ? "Yes" : "No"}
                     </Badge>
                   </div>
                 </CardContent>
               </Card>
             ))}
             
             <Card className="border border-dashed border-slate-300 shadow-sm flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group h-full min-h-[300px]">
               <div className="text-center">
                 <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-3 group-hover:border-blue-400 group-hover:text-blue-600 transition-colors">
                   <Plus className="h-6 w-6 text-slate-400 group-hover:text-blue-600" />
                 </div>
                 <h3 className="font-bold text-slate-900">Add Region</h3>
                 <p className="text-sm text-slate-500">Configure new policy</p>
               </div>
             </Card>
           </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
