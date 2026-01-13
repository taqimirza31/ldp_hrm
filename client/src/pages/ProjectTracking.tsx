import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock, AlertTriangle, Calendar, ArrowRight, BarChart3, LayoutDashboard } from "lucide-react";

const phases = [
  {
    name: "Phase 1: Core Foundation",
    status: "Completed",
    progress: 100,
    date: "Jan 01 - Jan 15",
    description: "Essential HRIS modules and system architecture.",
    tasks: [
      { name: "Project Setup & Tailwind v4 Config", status: "Done" },
      { name: "Employee Directory & Profile", status: "Done" },
      { name: "Leave Management System", status: "Done" },
      { name: "Time & Attendance (Biometrics)", status: "Done" },
      { name: "Payroll Processing Engine", status: "Done" },
      { name: "Dark Mode & Theming", status: "Done" }
    ]
  },
  {
    name: "Phase 2: Talent & Growth",
    status: "Completed",
    progress: 100,
    date: "Jan 16 - Jan 25",
    description: "Advanced modules for recruitment and performance.",
    tasks: [
      { name: "Recruitment Pipeline (Kanban)", status: "Done" },
      { name: "Onboarding Checklists", status: "Done" },
      { name: "Performance Reviews (360°)", status: "Done" },
      { name: "9-Box Talent Calibration", status: "Done" },
      { name: "Org Chart Visualization", status: "Done" }
    ]
  },
  {
    name: "Phase 3: Financials & AI",
    status: "In Progress",
    progress: 80,
    date: "Jan 26 - Feb 05",
    description: "Financial tools and AI-powered intelligence.",
    tasks: [
      { name: "Loan & Advance Management", status: "Done" },
      { name: "AI Job Description Generator", status: "Done" },
      { name: "AI Performance Insights", status: "Done" },
      { name: "Expense Management", status: "Pending" },
      { name: "Benefits Administration", status: "Pending" }
    ]
  },
  {
    name: "Phase 4: Culture & Compliance",
    status: "Planned",
    progress: 15,
    date: "Feb 06 - Feb 20",
    description: "Employee engagement and legal compliance modules.",
    tasks: [
      { name: "Whistleblower Portal", status: "Done" },
      { name: "Kudos & Recognition", status: "Pending" },
      { name: "Training (LMS)", status: "Pending" },
      { name: "Succession Planning", status: "Pending" },
      { name: "Diversity Dashboard", status: "Pending" },
      { name: "Audit Logs", status: "Pending" }
    ]
  }
];

const milestones = [
  { title: "MVP Launch", date: "Jan 15", status: "Completed" },
  { title: "Beta Release (Internal)", date: "Jan 30", status: "On Track" },
  { title: "Full Launch", date: "Feb 28", status: "Planned" },
];

export default function ProjectTracking() {
  const totalTasks = phases.reduce((acc, phase) => acc + phase.tasks.length, 0);
  const completedTasks = phases.reduce((acc, phase) => acc + phase.tasks.filter(t => t.status === "Done").length, 0);
  const overallProgress = Math.round((completedTasks / totalTasks) * 100);

  return (
    <Layout>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <LayoutDashboard className="h-5 w-5" />
          <span className="font-bold tracking-wide text-xs uppercase">Project Management</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Voyager Implementation Plan</h1>
        <p className="text-slate-500 mt-1">Tracking progress, timelines, and deliverables for the HRIS rollout.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-slate-900 text-white border-none shadow-lg">
          <CardContent className="p-6">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Overall Progress</p>
            <div className="flex items-end gap-2 mb-4">
              <h2 className="text-4xl font-bold">{overallProgress}%</h2>
              <span className="text-sm text-green-400 font-medium mb-1">On Schedule</span>
            </div>
            <Progress value={overallProgress} className="h-2 bg-slate-700" />
            <p className="text-xs text-slate-400 mt-3">{completedTasks} of {totalTasks} tasks completed</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Clock className="h-5 w-5" />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Time Elapsed</p>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">24 Days</h2>
            <p className="text-xs text-slate-500 mt-1">Since project kick-off</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Modules Built</p>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">18 / 30</h2>
            <p className="text-xs text-slate-500 mt-1">Core & Advanced systems</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pending Items</p>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">12</h2>
            <p className="text-xs text-slate-500 mt-1">Tasks remaining in Phase 3 & 4</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="roadmap" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="roadmap">Roadmap & Phases</TabsTrigger>
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="roadmap" className="mt-0 space-y-6">
              {phases.map((phase, idx) => (
                <Card key={idx} className={`border ${phase.status === 'Completed' ? 'border-green-200 bg-green-50/10' : phase.status === 'In Progress' ? 'border-blue-200 bg-blue-50/10' : 'border-slate-200'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">{phase.name}</CardTitle>
                          <Badge variant={phase.status === 'Completed' ? 'default' : phase.status === 'In Progress' ? 'secondary' : 'outline'} className={phase.status === 'Completed' ? 'bg-green-600' : ''}>
                            {phase.status}
                          </Badge>
                        </div>
                        <CardDescription>{phase.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{phase.progress}%</span>
                        <p className="text-xs text-slate-500">{phase.date}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <Progress value={phase.progress} className={`h-1.5 ${phase.status === 'Completed' ? 'bg-green-100' : 'bg-slate-100'}`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {phase.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="flex items-center gap-2 text-sm">
                          {task.status === 'Done' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                          )}
                          <span className={task.status === 'Done' ? 'text-slate-700' : 'text-slate-400'}>
                            {task.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            
            <TabsContent value="timeline">
              <Card className="border border-slate-200">
                <CardContent className="p-8 text-center text-slate-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Gantt chart visualization would go here.</p>
                  <p className="text-sm">Use the Roadmap view for detailed task breakdown.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {milestones.map((milestone, idx) => (
                  <div key={idx} className="relative flex items-center gap-4 pl-2">
                    <div className={`z-10 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center flex-shrink-0 ${milestone.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">{milestone.date}</p>
                      <h4 className="font-bold text-slate-900">{milestone.title}</h4>
                      <Badge variant="outline" className="mt-1 text-[10px] h-5">{milestone.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-none">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-2">Next Priority</h3>
              <p className="text-indigo-100 text-sm mb-6">
                Complete the remaining modules in Phase 3 & 4 to reach Beta readiness.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white/10 p-2 rounded">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Benefits Administration</span>
                </div>
                <div className="flex items-center gap-3 bg-white/10 p-2 rounded">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">LMS / Training Module</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}