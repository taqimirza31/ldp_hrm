import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Plus, Filter, MessageSquare, Clock, 
  CheckCircle2, AlertCircle, HelpCircle, FileText,
  Laptop, Settings, CreditCard, Users, Building, MoreHorizontal, Phone
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Mock Data
const tickets = [
  { id: "INC-2024-001", title: "Laptop battery draining fast", category: "IT Hardware", priority: "Medium", status: "In Progress", created: "2 hours ago", assignee: "IT Support" },
  { id: "REQ-2024-045", title: "Access to Figma Enterprise", category: "Software Access", priority: "Low", status: "Open", created: "1 day ago", assignee: "Unassigned" },
  { id: "REQ-2024-032", title: "New ID Card Request", category: "Facilities", priority: "Low", status: "Resolved", created: "3 days ago", assignee: "Admin Team" },
  { id: "INC-2024-005", title: "Unable to login to Payroll Portal", category: "IT Access", priority: "High", status: "In Progress", created: "4 hours ago", assignee: "HR Systems" },
  { id: "REQ-2024-028", title: "Conference Room B Projector Issue", category: "Facilities", priority: "Medium", status: "Open", created: "5 hours ago", assignee: "Facilities" },
];

const faqs = [
  { question: "How do I reset my password?", category: "IT Access", views: 1245 },
  { question: "What is the Wi-Fi guest password?", category: "IT Network", views: 890 },
  { question: "How to claim travel expenses?", category: "Finance", views: 756 },
  { question: "Holiday calendar 2026", category: "HR Policy", views: 2300 },
];

export default function ServiceDesk() {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

  const handleSubmitTicket = () => {
    setIsNewTicketOpen(false);
    toast.success("Ticket Created Successfully", {
      description: "Ticket #REQ-2026-099 has been assigned to the IT Team.",
    });
  };

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Service Desk</h1>
          <p className="text-slate-500 mt-1">Submit requests, report issues, and find answers.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <HelpCircle className="h-4 w-4" /> Knowledge Base
          </Button>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue or request in detail.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select defaultValue="incident">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incident">Report an Issue (Incident)</SelectItem>
                        <SelectItem value="request">Request Service (Request)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">IT & Hardware</SelectItem>
                        <SelectItem value="software">Software & Access</SelectItem>
                        <SelectItem value="hr">HR & Payroll</SelectItem>
                        <SelectItem value="facilities">Facilities & Admin</SelectItem>
                        <SelectItem value="finance">Finance & Expenses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input placeholder="Brief summary of the issue" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea placeholder="Please provide detailed information..." className="min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select defaultValue="low">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - General Question</SelectItem>
                      <SelectItem value="medium">Medium - Affects Work</SelectItem>
                      <SelectItem value="high">High - Critical Blocker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitTicket}>Submit Ticket</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Search Banner */}
          <div className="bg-slate-900 rounded-xl p-8 text-white text-center relative overflow-hidden">
            <div className="relative z-10 max-w-lg mx-auto">
              <h2 className="text-2xl font-bold mb-4">How can we help you today?</h2>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Search for articles, guides, and solutions..." 
                  className="pl-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20 transition-all"
                />
              </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 z-0"></div>
          </div>

          {/* Quick Categories */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Laptop, label: "IT Support", color: "text-blue-600", bg: "bg-blue-50" },
              { icon: Users, label: "HR Services", color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Building, label: "Facilities", color: "text-orange-600", bg: "bg-orange-50" },
              { icon: CreditCard, label: "Finance", color: "text-green-600", bg: "bg-green-50" },
            ].map((cat, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                  <div className={`p-3 rounded-full ${cat.bg} ${cat.color}`}>
                    <cat.icon className="h-6 w-6" />
                  </div>
                  <span className="font-medium text-sm text-slate-700">{cat.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Tickets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Your Recent Tickets</CardTitle>
              <Button variant="ghost" size="sm" className="text-blue-600">View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {tickets.map((ticket, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-lg ${
                        ticket.priority === 'High' ? 'bg-red-50 text-red-600' : 
                        ticket.priority === 'Medium' ? 'bg-orange-50 text-orange-600' : 
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {ticket.priority === 'High' ? <AlertCircle className="h-4 w-4" /> : 
                         ticket.status === 'Resolved' ? <CheckCircle2 className="h-4 w-4" /> :
                         <Clock className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">{ticket.id}</span>
                          <h4 className="font-medium text-slate-900 text-sm">{ticket.title}</h4>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Settings className="h-3 w-3" /> {ticket.category}</span>
                          <span>•</span>
                          <span>{ticket.created}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:block text-right">
                        <p className="text-xs text-slate-400">Assigned to</p>
                        <p className="text-xs font-medium text-slate-700">{ticket.assignee}</p>
                      </div>
                      <Badge variant={ticket.status === 'Resolved' ? 'secondary' : 'default'} className={
                        ticket.status === 'Resolved' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                        ticket.status === 'Open' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                        'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }>
                        {ticket.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Knowledge Base */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Popular Articles</CardTitle>
              <CardDescription>Most viewed guides this week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="flex items-start gap-3 group cursor-pointer">
                  <div className="mt-0.5 text-slate-400 group-hover:text-blue-600 transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">{faq.question}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{faq.category} • {faq.views} views</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2">Visit Help Center</Button>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white border-none">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-2">Need immediate help?</h3>
              <p className="text-blue-100 text-sm mb-4">Our IT Support team is available 24/7 for critical issues.</p>
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-lg">
                <Phone className="h-5 w-5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-200">Emergency Hotline</p>
                  <p className="font-mono font-bold text-lg">+1 (800) 123-HELP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}