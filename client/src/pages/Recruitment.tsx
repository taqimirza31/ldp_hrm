import Layout from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Plus, Calendar, MessageSquare, Paperclip, Star, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStore, Candidate } from "@/store/useStore";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STAGES = [
  { id: "applied", title: "Applied", color: "bg-blue-500" },
  { id: "screening", title: "Screening", color: "bg-purple-500" },
  { id: "interview", title: "Interview", color: "bg-orange-500" },
  { id: "offer", title: "Offer", color: "bg-green-500" },
];

function DroppableStage({ stage, children, count }: { stage: typeof STAGES[0], children: React.ReactNode, count: number }) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-80 flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200">
      <div className="p-4 flex items-center justify-between border-b border-slate-200/60 bg-slate-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
          <h3 className="font-semibold text-slate-700 text-sm">{stage.title}</h3>
          <Badge variant="secondary" className="bg-white text-slate-500 border border-slate-200 ml-1">
            {count}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {children}
        <Button variant="ghost" className="w-full border border-dashed border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 text-sm h-10">
          <Plus className="h-3 w-3 mr-1" /> Add Card
        </Button>
      </div>
    </div>
  );
}

function DraggableCandidate({ candidate, onDelete }: { candidate: Candidate, onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: candidate.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
    cursor: 'grabbing',
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes} 
      className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 cursor-grab transition-all duration-200 group relative"
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-slate-400 hover:text-red-600"
          onPointerDown={(e) => {
            e.stopPropagation(); // Prevent drag start
            if (confirm("Delete this candidate?")) {
              onDelete(candidate.id);
            }
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-slate-100">
            <AvatarImage src={candidate.img} />
            <AvatarFallback>{candidate.name[0]}</AvatarFallback>
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
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Calendar className="h-3 w-3" />
          <span>2d</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <MessageSquare className="h-3 w-3" />
          <span>4</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Paperclip className="h-3 w-3" />
          <span>1</span>
        </div>
      </div>
    </div>
  );
}

export default function Recruitment() {
  const { candidates, moveCandidate, addCandidate, deleteCandidate } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState<Partial<Candidate>>({
    name: "",
    role: "",
    stage: "applied",
    score: 85,
    img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Find which stage we dropped over
      const stageId = over.id as string;
      if (STAGES.some(s => s.id === stageId)) {
        moveCandidate(Number(active.id), stageId);
      }
    }
  };

  const handleAddCandidate = () => {
    if (!newCandidate.name || !newCandidate.role) {
      toast.error("Please fill in name and role");
      return;
    }

    addCandidate({
      name: newCandidate.name!,
      role: newCandidate.role!,
      stage: newCandidate.stage || "applied",
      score: Math.floor(Math.random() * 20) + 80, // Random score between 80-100
      img: newCandidate.img || ""
    });

    toast.success("Candidate added to pipeline");
    setIsAddDialogOpen(false);
    setNewCandidate({
      name: "",
      role: "",
      stage: "applied",
      score: 85,
      img: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
    });
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Recruitment Pipeline</h1>
          <p className="text-slate-500 text-sm">Drag and drop candidates to move them through stages.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search candidates..." 
              className="pl-9 w-64 bg-white" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Add Candidate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Candidate</DialogTitle>
                <DialogDescription>
                  Enter candidate details to add them to the pipeline.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Role</Label>
                  <Input id="role" value={newCandidate.role} onChange={e => setNewCandidate({...newCandidate, role: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stage" className="text-right">Stage</Label>
                  <Select onValueChange={(val) => setNewCandidate({...newCandidate, stage: val})} defaultValue="applied">
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCandidate}>Save Candidate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 h-[calc(100vh-200px)] overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <DroppableStage 
              key={stage.id} 
              stage={stage} 
              count={filteredCandidates.filter(c => c.stage === stage.id).length}
            >
              {filteredCandidates
                .filter((candidate) => candidate.stage === stage.id)
                .map((candidate) => (
                  <DraggableCandidate 
                    key={candidate.id} 
                    candidate={candidate} 
                    onDelete={deleteCandidate}
                  />
                ))}
            </DroppableStage>
          ))}
        </div>
      </DndContext>
    </Layout>
  );
}
