import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, UserPlus, Mail, FileText, Monitor, Users, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const newHires = [
  { id: 1, name: "Alice Johnson", role: "UX Designer", start: "Nov 25", progress: 20, avatar: "https://github.com/shadcn.png" },
  { id: 2, name: "Bob Smith", role: "Backend Dev", start: "Nov 28", progress: 0, avatar: "https://github.com/shadcn.png" },
  { id: 3, name: "Charlie Brown", role: "Sales Rep", start: "Dec 01", progress: 0, avatar: "https://github.com/shadcn.png" },
];

const checklist = [
  { id: 1, category: "Pre-boarding", items: [
    { text: "Send Offer Letter", completed: true },
    { text: "Background Check", completed: true },
    { text: "Order Laptop & Equipment", completed: false }
  ]},
  { id: 2, category: "Day 1", items: [
    { text: "Team Introduction Email", completed: false },
    { text: "IT Setup & Access", completed: false },
    { text: "HR Orientation", completed: false }
  ]},
  { id: 3, category: "Week 1", items: [
    { text: "Product Training", completed: false },
    { text: "Meet with Manager", completed: false },
    { text: "Compliance Training", completed: false }
  ]}
];

export default function Onboarding() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Onboarding</h1>
          <p className="text-slate-500 text-sm">Manage new hire checklists and progress.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
          <UserPlus className="h-4 w-4 mr-2" /> Start Onboarding
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Hires List */}
        <div className="space-y-6">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Incoming Hires</h3>
          {newHires.map((hire) => (
            <Card key={hire.id} className="border border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-3">
                  <Avatar>
                    <AvatarImage src={hire.avatar} />
                    <AvatarFallback>{hire.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-slate-900">{hire.name}</h4>
                    <p className="text-xs text-slate-500">{hire.role} • Starts {hire.start}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-medium text-slate-900">{hire.progress}%</span>
                  </div>
                  <Progress value={hire.progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Checklist Detail */}
        <div className="lg:col-span-2">
          <Card className="border border-slate-200 shadow-sm h-full">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex justify-between items-center">
                <div>
                   <CardTitle>Alice Johnson</CardTitle>
                   <p className="text-sm text-slate-500">UX Designer • Engineering</p>
                </div>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" /> Resend Welcome
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                {checklist.map((section) => (
                  <div key={section.id}>
                    <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">{section.id}</div>
                      {section.category}
                    </h4>
                    <div className="space-y-2 ml-8">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                          <div className={`cursor-pointer ${item.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}>
                            {item.completed ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </div>
                          <span className={`text-sm ${item.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <Button className="bg-slate-900 text-white hover:bg-slate-800">
                  Complete Stage <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
