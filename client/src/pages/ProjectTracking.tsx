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
              <Card className="border border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="relative pt-8 pb-4">
                    {/* Month Headers */}
                    <div className="flex border-b border-slate-200 pb-2 mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <div className="w-1/2 pl-2">January</div>
                      <div className="w-1/2 pl-2 border-l border-slate-200">February</div>
                    </div>

                    {/* Timeline Grid Background */}
                    <div className="absolute inset-0 top-14 bottom-0 flex pointer-events-none">
                      <div className="w-1/6 border-r border-slate-100 h-full"></div>
                      <div className="w-1/6 border-r border-slate-100 h-full"></div>
                      <div className="w-1/6 border-r border-slate-200 h-full"></div> {/* End of Jan */}
                      <div className="w-1/6 border-r border-slate-100 h-full"></div>
                      <div className="w-1/6 border-r border-slate-100 h-full"></div>
                      <div className="w-1/6 h-full"></div>
                    </div>

                    {/* "Today" Marker - Assuming roughly Jan 24th/25th based on progress */}
                    <div className="absolute top-10 bottom-0 left-[40%] w-px bg-blue-500 z-10 flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 -mt-1"></div>
                      <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded mt-1">Today</div>
                    </div>

                    {/* Timeline Bars */}
                    <div className="space-y-6 relative z-0">
                      {phases.map((phase, idx) => {
                        // Rough estimation of positions based on dates
                        // Jan 1-31 (50% width), Feb 1-28 (50% width)
                        // Total timeline: 60 days approx.
                        // Phase 1: Jan 1-15 -> Left 0%, Width 25%
                        // Phase 2: Jan 16-25 -> Left 26%, Width 16%
                        // Phase 3: Jan 26-Feb 5 -> Left 43%, Width 18%
                        // Phase 4: Feb 6-20 -> Left 62%, Width 24%
                        
                        let left = "0%";
                        let width = "0%";
                        let color = "bg-slate-200";
                        
                        if (idx === 0) { left = "0%"; width = "25%"; color = "bg-green-500"; }
                        if (idx === 1) { left = "26%"; width = "16%"; color = "bg-green-500"; }
                        if (idx === 2) { left = "43%"; width = "18%"; color = "bg-blue-500 striped-bg"; } // Active
                        if (idx === 3) { left = "62%"; width = "24%"; color = "bg-slate-300"; }

                        return (
                          <div key={idx} className="relative h-12">
                            <div className="absolute top-0 left-0 w-full flex items-center text-sm font-medium text-slate-700 mb-1 z-10">
                              <span className="w-32 truncate mr-4 text-xs font-bold text-slate-500 text-right">{phase.name.split(':')[0]}</span>
                            </div>
                            <div className="ml-36 relative h-8 rounded-md bg-slate-50 w-full overflow-hidden">
                               <div 
                                 className={`absolute top-1 bottom-1 rounded-sm shadow-sm ${color} transition-all hover:opacity-90 cursor-pointer flex items-center px-2`}
                                 style={{ left, width }}
                               >
                                 <span className="text-[10px] font-bold text-white truncate w-full shadow-sm">{phase.name.split(':')[1]}</span>
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="mt-8 flex gap-4 text-xs text-slate-500 justify-center border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Completed</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> In Progress</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> Planned</div>
                  </div>
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