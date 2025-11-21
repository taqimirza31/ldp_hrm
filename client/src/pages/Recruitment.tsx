import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Plus, Calendar, MessageSquare, Paperclip, Star, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const stages = [
  { id: "applied", title: "Applied", color: "bg-blue-500", count: 12 },
  { id: "screening", title: "Screening", color: "bg-purple-500", count: 5 },
  { id: "interview", title: "Interview", color: "bg-orange-500", count: 3 },
  { id: "offer", title: "Offer", color: "bg-green-500", count: 1 },
];

const candidates = [
  { id: 1, name: "John Wick", role: "Security Specialist", stage: "applied", score: 98, img: "https://github.com/shadcn.png" },
  { id: 2, name: "Ellen Ripley", role: "Operations Manager", stage: "interview", score: 95, img: "https://github.com/shadcn.png" },
  { id: 3, name: "Tony Stark", role: "Lead Engineer", stage: "offer", score: 99, img: "https://github.com/shadcn.png" },
  { id: 4, name: "Sarah Connor", role: "Product Owner", stage: "screening", score: 88, img: "https://github.com/shadcn.png" },
  { id: 5, name: "Bruce Wayne", role: "CEO", stage: "applied", score: 92, img: "https://github.com/shadcn.png" },
  { id: 6, name: "Natasha Romanoff", role: "HR BP", stage: "interview", score: 96, img: "https://github.com/shadcn.png" },
];

export default function Recruitment() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Recruitment</h1>
          <p className="text-slate-500 text-sm">Track and manage candidate pipelines.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search candidates..." className="pl-9 w-64 bg-white" />
          </div>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Candidate
          </Button>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)] overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200">
            <div className="p-4 flex items-center justify-between border-b border-slate-200/60 bg-slate-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-slate-700 text-sm">{stage.title}</h3>
                <Badge variant="secondary" className="bg-white text-slate-500 border border-slate-200 ml-1">
                  {candidates.filter(c => c.stage === stage.id).length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {candidates.filter(c => c.stage === stage.id).map((candidate) => (
                <div key={candidate.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all duration-200 group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-slate-100">
                        <AvatarImage src={candidate.img} />
                        <AvatarFallback>CN</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm leading-none mb-1">{candidate.name}</h4>
                        <p className="text-xs text-slate-500">{candidate.role}</p>
                      </div>
                    </div>
                    {candidate.score > 90 && (
                      <div className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                        <Star className="h-3 w-3 mr-0.5 fill-green-600" /> {candidate.score}%
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
                      <Calendar className="h-3 w-3" />
                      <span>2d</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
                      <MessageSquare className="h-3 w-3" />
                      <span>4</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors">
                      <Paperclip className="h-3 w-3" />
                      <span>1</span>
                    </div>
                  </div>
                </div>
              ))}
              
              <Button variant="ghost" className="w-full border border-dashed border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 text-sm h-10">
                <Plus className="h-3 w-3 mr-1" /> Add Card
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
