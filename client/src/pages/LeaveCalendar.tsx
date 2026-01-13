import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Globe, Users, CheckCircle2, AlertCircle, Clock, XCircle, CheckCircle } from "lucide-react";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useStore, LeaveRequest } from "@/store/useStore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function LeaveCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const { leaveRequests, leaveBalances, addLeaveRequest, updateLeaveStatus, employees } = useStore();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  
  // New Request State
  const [newRequest, setNewRequest] = useState<Partial<LeaveRequest>>({
    type: "Annual",
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: ""
  });

  const currentUser = employees[0]; // Simulate current logged in user
  const myBalance = leaveBalances.find(b => b.userId === currentUser.id) || leaveBalances[0];

  const handleSubmitRequest = () => {
    if (!newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      toast.error("Please fill in all fields");
      return;
    }
    
    addLeaveRequest({
      userId: currentUser.id,
      userName: currentUser.name,
      type: newRequest.type as any,
      startDate: newRequest.startDate!,
      endDate: newRequest.endDate!,
      reason: newRequest.reason!
    });
    
    toast.success("Leave request submitted successfully");
    setIsRequestDialogOpen(false);
    setNewRequest({
      type: "Annual",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: ""
    });
  };

  const handleApprove = (id: number) => {
    updateLeaveStatus(id, "Approved");
    toast.success("Request approved");
  };

  const handleReject = (id: number) => {
    updateLeaveStatus(id, "Rejected");
    toast.error("Request rejected");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'Rejected': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'Pending Manager': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'Pending HR': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leave Management</h1>
          <p className="text-muted-foreground text-sm">Global leave policies and multi-tier approvals.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
            <Filter className="h-4 w-4 mr-2" /> Filter Team
          </Button>
          
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
                <DialogDescription>
                  Submit a new leave request for approval.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">Type</Label>
                  <Select onValueChange={(val) => setNewRequest({...newRequest, type: val as any})} defaultValue={newRequest.type}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Annual">Annual Leave</SelectItem>
                      <SelectItem value="Sick">Sick Leave</SelectItem>
                      <SelectItem value="Casual">Casual Leave</SelectItem>
                      <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="start" className="text-right">Start Date</Label>
                  <Input id="start" type="date" value={newRequest.startDate} onChange={e => setNewRequest({...newRequest, startDate: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="end" className="text-right">End Date</Label>
                  <Input id="end" type="date" value={newRequest.endDate} onChange={e => setNewRequest({...newRequest, endDate: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="reason" className="text-right pt-2">Reason</Label>
                  <Textarea id="reason" value={newRequest.reason} onChange={e => setNewRequest({...newRequest, reason: e.target.value})} className="col-span-3" placeholder="Brief reason for leave..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleSubmitRequest}>Submit Request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="mb-8 bg-muted p-1">
          <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" /> Team Calendar</TabsTrigger>
          <TabsTrigger value="approvals">
            <CheckCircle2 className="h-4 w-4 mr-2" /> 
            Approvals 
            {leaveRequests.filter(r => r.status.includes('Pending')).length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white rounded-full text-[10px]">
                {leaveRequests.filter(r => r.status.includes('Pending')).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="policies"><Globe className="h-4 w-4 mr-2" /> Regional Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      November 2024
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8 border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  
                  {/* Mock Calendar Grid */}
                  <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="bg-muted/50 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                      const dayNum = i - 2; // Offset for mockup
                      const isToday = dayNum === 14;
                      // Find leave requests for this day
                      const dayRequests = leaveRequests.filter(req => {
                         // Simple mock date logic for the demo visual
                         const startDay = parseInt(req.startDate.split('-')[2]);
                         const endDay = parseInt(req.endDate.split('-')[2]);
                         // Assuming strictly November 2024 for the mock
                         return dayNum >= startDay && dayNum <= endDay;
                      });
                      
                      return (
                        <div key={i} className={`bg-card min-h-[100px] p-2 hover:bg-muted/50 transition-colors relative group ${dayNum < 1 || dayNum > 30 ? 'bg-muted/30 text-muted-foreground/50' : ''}`}>
                          <span className={`text-sm font-medium ${isToday ? 'bg-primary text-primary-foreground w-6 h-6 flex items-center justify-center rounded-full' : 'text-foreground'}`}>
                            {dayNum > 0 && dayNum <= 30 ? dayNum : ''}
                          </span>
                          
                          {dayNum > 0 && dayRequests.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {dayRequests.map((req, idx) => (
                                <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded truncate border ${getStatusColor(req.status)}`}>
                                  {req.userName}
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
              <Card className="border border-border shadow-sm bg-blue-600 text-white dark:bg-blue-700">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-1">Who's Away?</h3>
                  <p className="text-blue-100 text-sm mb-4">
                     {leaveRequests.filter(req => req.status === 'Approved').length} people are on leave this week.
                  </p>
                  <div className="flex -space-x-2 overflow-hidden">
                    {employees.slice(0, 3).map((emp) => (
                      <Avatar key={emp.id} className="inline-block border-2 border-blue-600 h-8 w-8 ring-2 ring-white/20">
                        <AvatarImage src={emp.avatar} />
                        <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle>My Entitlements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Annual Leave</span>
                      <span className="font-bold text-foreground">{myBalance.annualUsed} / {myBalance.annualTotal}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${(myBalance.annualUsed / myBalance.annualTotal) * 100}%` }} />
                    </div>
                  </div>
                   <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Sick Leave</span>
                      <span className="font-bold text-foreground">{myBalance.sickUsed} / {myBalance.sickTotal}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: `${(myBalance.sickUsed / myBalance.sickTotal) * 100}%` }} />
                    </div>
                  </div>
                   <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Casual Leave</span>
                      <span className="font-bold text-foreground">{myBalance.casualUsed} / {myBalance.casualTotal}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(myBalance.casualUsed / myBalance.casualTotal) * 100}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Multi-tier approval workflow requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.filter(r => r.status.includes('Pending')).map((req) => (
                  <div key={req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${req.userName.replace(' ','+')}`} />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-foreground">{req.userName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{req.type}</span>
                          <span>•</span>
                          <span>{req.startDate} to {req.endDate}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 italic">"{req.reason}"</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-end md:self-auto">
                       <Badge variant="outline" className={getStatusColor(req.status)}>
                         {req.status}
                       </Badge>
                       <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleApprove(req.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleReject(req.id)}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                       </div>
                    </div>
                  </div>
                ))}
                {leaveRequests.filter(r => r.status.includes('Pending')).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p>All caught up! No pending requests.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-0">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[
                { region: "Pakistan", annual: 14, sick: 10, casual: 10, rollover: true },
                { region: "India", annual: 18, sick: 12, casual: 8, rollover: false },
                { region: "USA", annual: 15, sick: 5, casual: 0, rollover: true },
             ].map((policy) => (
               <Card key={policy.region} className="border border-border shadow-sm hover:border-primary/50 transition-all bg-card">
                 <CardHeader className="bg-muted/30 border-b border-border pb-4">
                   <div className="flex items-center justify-between">
                     <CardTitle className="flex items-center gap-2 text-foreground">
                       <Globe className="h-4 w-4 text-primary" /> {policy.region}
                     </CardTitle>
                     <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">Edit</Button>
                   </div>
                 </CardHeader>
                 <CardContent className="p-6 space-y-4">
                   <div className="flex justify-between py-2 border-b border-border">
                     <span className="text-sm text-muted-foreground">Annual Leave</span>
                     <span className="font-bold text-foreground">{policy.annual} days</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-border">
                     <span className="text-sm text-muted-foreground">Sick Leave</span>
                     <span className="font-bold text-foreground">{policy.sick} days</span>
                   </div>
                   <div className="flex justify-between py-2 border-b border-border">
                     <span className="text-sm text-muted-foreground">Casual Leave</span>
                     <span className="font-bold text-foreground">{policy.casual} days</span>
                   </div>
                   <div className="flex justify-between py-2">
                     <span className="text-sm text-muted-foreground">Rollover Allowed</span>
                     <Badge variant="outline" className={policy.rollover ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" : "bg-muted text-muted-foreground"}>
                       {policy.rollover ? "Yes" : "No"}
                     </Badge>
                   </div>
                 </CardContent>
               </Card>
             ))}
             
             <Card className="border border-dashed border-border shadow-sm flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group h-full min-h-[300px]">
               <div className="text-center">
                 <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-3 group-hover:border-primary group-hover:text-primary transition-colors">
                   <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                 </div>
                 <h3 className="font-bold text-foreground">Add Region</h3>
                 <p className="text-sm text-muted-foreground">Configure new policy</p>
               </div>
             </Card>
           </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
