import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, UserPlus, Mail, FileText, Monitor, Users, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStore } from "@/store/useStore";
import { useState } from "react";

const mockNewHires = [
  { id: 101, name: "Alice Johnson", role: "UX Designer", start: "Nov 25", avatar: "https://github.com/shadcn.png" },
  { id: 102, name: "Bob Smith", role: "Backend Dev", start: "Nov 28", avatar: "https://github.com/shadcn.png" },
];

export default function Onboarding() {
  const { onboardingTasks, toggleOnboardingTask } = useStore();
  const [selectedHireId, setSelectedHireId] = useState(101);

  const selectedHire = mockNewHires.find(h => h.id === selectedHireId) || mockNewHires[0];
  const hireTasks = onboardingTasks.filter(t => t.hireId === selectedHireId);
  const progress = Math.round((hireTasks.filter(t => t.completed).length / hireTasks.length) * 100) || 0;

  // Group tasks by category
  const categories = Array.from(new Set(hireTasks.map(t => t.category)));

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Onboarding</h1>
          <p className="text-muted-foreground text-sm">Manage new hire checklists and progress.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
          <UserPlus className="h-4 w-4 mr-2" /> Start Onboarding
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Hires List */}
        <div className="space-y-6">
          <h3 className="font-bold text-muted-foreground text-sm uppercase tracking-wider">Incoming Hires</h3>
          {mockNewHires.map((hire) => {
            const hireProgress = Math.round((onboardingTasks.filter(t => t.hireId === hire.id && t.completed).length / onboardingTasks.filter(t => t.hireId === hire.id).length) * 100) || 0;
            return (
              <Card 
                key={hire.id} 
                className={`border shadow-sm cursor-pointer transition-all group ${selectedHireId === hire.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
                onClick={() => setSelectedHireId(hire.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <Avatar>
                      <AvatarImage src={hire.avatar} />
                      <AvatarFallback>{hire.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-foreground">{hire.name}</h4>
                      <p className="text-xs text-muted-foreground">{hire.role} • Starts {hire.start}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{hireProgress}%</span>
                    </div>
                    <Progress value={hireProgress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Checklist Detail */}
        <div className="lg:col-span-2">
          <Card className="border border-border shadow-sm h-full bg-card">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex justify-between items-center">
                <div>
                   <CardTitle>{selectedHire.name}</CardTitle>
                   <p className="text-sm text-muted-foreground">{selectedHire.role} • Engineering</p>
                </div>
                <Button variant="outline" size="sm" className="bg-card border-border text-foreground hover:bg-muted">
                  <Mail className="h-4 w-4 mr-2" /> Resend Welcome
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-8">
                {categories.map((category) => (
                  <div key={category}>
                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs border border-blue-200 dark:border-blue-800">
                        {category.charAt(0)}
                      </div>
                      {category}
                    </h4>
                    <div className="space-y-2 ml-8">
                      {hireTasks.filter(t => t.category === category).map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer group"
                          onClick={() => toggleOnboardingTask(selectedHireId, item.id)}
                        >
                          <div className={`transition-colors ${item.completed ? 'text-green-500' : 'text-muted-foreground/30 group-hover:text-muted-foreground'}`}>
                            {item.completed ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </div>
                          <span className={`text-sm ${item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {item.task}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {categories.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No tasks assigned for this user.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-border flex justify-end">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={progress < 100}>
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
