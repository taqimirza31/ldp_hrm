import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Plus, Calendar, MessageSquare, Paperclip, Star } from "lucide-react";

const stages = [
  { id: "applied", title: "Applied", color: "blue-500" },
  { id: "screening", title: "Screening", color: "purple-500" },
  { id: "interview", title: "Interview", color: "orange-500" },
  { id: "offer", title: "Offer", color: "green-500" },
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
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Recruitment Pipeline</h1>
          <p className="text-muted-foreground font-tech">Tracking top talent across the sector.</p>
        </div>
        <Button className="bg-primary text-primary-foreground font-bold font-tech uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <Plus className="h-4 w-4 mr-2" /> Add Candidate
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)] overflow-hidden">
        {stages.map((stage) => (
          <div key={stage.id} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-${stage.color} shadow-[0_0_8px_var(--color-${stage.color})]`} />
                <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">{stage.title}</h3>
                <span className="bg-white/10 text-white text-xs px-2 py-0.5 rounded-full font-tech">
                  {candidates.filter(c => c.stage === stage.id).length}
                </span>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-white" />
            </div>

            <div className="flex-1 bg-white/5 rounded-xl border border-white/5 p-3 overflow-y-auto space-y-3 scrollbar-hide">
              {candidates.filter(c => c.stage === stage.id).map((candidate) => (
                <div key={candidate.id} className="glass-panel p-4 rounded-lg cursor-pointer hover:border-primary/50 hover:translate-y-[-2px] transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarImage src={candidate.img} />
                        <AvatarFallback>CN</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-bold text-white text-sm leading-none mb-1">{candidate.name}</h4>
                        <p className="text-xs text-muted-foreground font-tech">{candidate.role}</p>
                      </div>
                    </div>
                    {candidate.score > 90 && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1 py-0 h-5">
                        <Star className="h-3 w-3 mr-1 fill-primary" /> {candidate.score}%
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-3 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Calendar className="h-3 w-3" />
                      <span>2d</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <MessageSquare className="h-3 w-3" />
                      <span>4</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Paperclip className="h-3 w-3" />
                      <span>1</span>
                    </div>
                  </div>
                </div>
              ))}
              
              <button className="w-full py-3 border border-dashed border-white/10 rounded-lg text-muted-foreground hover:text-white hover:border-primary/30 hover:bg-white/5 transition-all text-xs font-tech uppercase tracking-wider flex items-center justify-center gap-2">
                <Plus className="h-3 w-3" /> Add Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
