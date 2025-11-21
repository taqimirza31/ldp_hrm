import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, MoreHorizontal, Clock, User, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

const tasks = [
  { id: 1, title: "Review Q4 Performance Data", assignee: "Sarah Connor", due: "Today", priority: "High", progress: 75, status: "In Progress" },
  { id: 2, title: "Update Security Policies", assignee: "Neo Anderson", due: "Tomorrow", priority: "Medium", progress: 30, status: "In Progress" },
  { id: 3, title: "Prepare Onboarding Kits", assignee: "Oracle Jones", due: "Dec 01", priority: "Low", progress: 0, status: "Todo" },
  { id: 4, title: "Finalize Holiday Schedule", assignee: "Sarah Connor", due: "Yesterday", priority: "High", progress: 100, status: "Done" },
];

export default function Tasks() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Task Management</h1>
          <p className="text-slate-500 text-sm">Track HR projects and daily to-dos.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {["Todo", "In Progress", "Review", "Done"].map((status) => (
          <div key={status} className="bg-slate-50 rounded-xl p-4 border border-slate-200 h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">{status}</h3>
              <Badge variant="secondary" className="bg-white text-slate-500 border border-slate-200">
                {tasks.filter(t => t.status === status).length}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {tasks.filter(t => t.status === status).map((task) => (
                <Card key={task.id} className="border border-slate-200 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-300 transition-all">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <Badge className={`
                        ${task.priority === 'High' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 
                          task.priority === 'Medium' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : 
                          'bg-green-100 text-green-700 hover:bg-green-100'}
                      `}>
                        {task.priority}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-slate-400">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <h4 className="font-bold text-slate-900 text-sm mb-3">{task.title}</h4>
                    
                    <div className="space-y-3">
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${task.progress}%` }} />
                      </div>
                      
                      <div className="flex justify-between items-center pt-1">
                        <div className="flex -space-x-2">
                           <Avatar className="h-6 w-6 border-2 border-white">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>SC</AvatarFallback>
                          </Avatar>
                        </div>
                        <div className={`flex items-center text-xs ${task.status === 'Done' ? 'text-green-600' : task.due === 'Yesterday' ? 'text-red-500' : 'text-slate-500'}`}>
                          <Clock className="h-3 w-3 mr-1" /> {task.due}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="ghost" className="w-full text-slate-400 hover:text-slate-700 text-xs border border-dashed border-slate-300 hover:border-slate-400">
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
