import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, LogOut, ArrowRight, Archive } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

const exits = [
  { id: 1, name: "Cypher", role: "Operator", date: "Nov 30, 2025", type: "Voluntary", progress: 20 },
  { id: 2, name: "Agent Brown", role: "Security", date: "Dec 15, 2025", type: "Involuntary", progress: 0 },
];

const checklist = [
  { category: "IT & Access", items: [
    { text: "Revoke Email Access", done: false },
    { text: "Collect Laptop & Phone", done: false },
    { text: "Disable VPN/SaaS Accounts", done: false },
  ]},
  { category: "HR & Legal", items: [
    { text: "Exit Interview", done: true },
    { text: "Sign Separation Agreement", done: false },
    { text: "Final Payroll Calculation", done: false },
  ]},
  { category: "Knowledge Transfer", items: [
    { text: "Handover Documentation", done: false },
    { text: "Transfer Project Ownership", done: false },
  ]}
];

export default function Offboarding() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Offboarding</h1>
          <p className="text-slate-500 text-sm">Manage employee exits securely.</p>
        </div>
        <Button variant="destructive" className="shadow-sm">
          <LogOut className="h-4 w-4 mr-2" /> Initiate Exit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Departing Employees</h3>
          {exits.map((exit) => (
            <Card key={exit.id} className="border border-slate-200 shadow-sm cursor-pointer hover:border-red-300 transition-all group">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 mb-3">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>EX</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-slate-900">{exit.name}</h4>
                    <p className="text-xs text-slate-500">{exit.role} • Last Day: {exit.date}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-600">{exit.type}</span>
                   <span className="text-xs font-bold text-slate-900">{exit.progress}% Done</span>
                </div>
                <Progress value={exit.progress} className="h-1.5" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          <Card className="border border-slate-200 shadow-sm h-full">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex justify-between items-center">
                <div>
                   <CardTitle>Cypher - Exit Process</CardTitle>
                   <p className="text-sm text-slate-500">Operator • Engineering Dept</p>
                </div>
                <Button variant="outline" size="sm">
                  <Archive className="h-4 w-4 mr-2" /> Archive Profile
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                {checklist.map((section, idx) => (
                  <div key={idx}>
                    <h4 className="font-bold text-slate-900 mb-3">{section.category}</h4>
                    <div className="space-y-2">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                          <div className={`cursor-pointer ${item.done ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}>
                            {item.done ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </div>
                          <span className={`text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
               <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <Button variant="destructive">
                  Finalize Termination <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
