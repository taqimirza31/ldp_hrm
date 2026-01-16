import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, Phone, MapPin, Linkedin, Link as LinkIcon, Download, 
  Calendar, MessageSquare, Star, Clock, BrainCircuit, 
  CheckCircle2, XCircle, ArrowLeft, FileText, Share2, MoreHorizontal
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useStore } from "@/store/useStore";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export default function CandidateProfile() {
  const [, params] = useRoute("/recruitment/candidates/:id");
  const [, setLocation] = useLocation();
  const { candidates } = useStore();
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewType, setInterviewType] = useState("technical");

  const handleScheduleInterview = () => {
    setIsSchedulingOpen(false);
    toast.success("Interview Scheduled", {
      description: `Invited ${candidate.name} for a ${interviewType} interview on ${interviewDate}.`
    });
  };
  
  // Find candidate or use mock data if not found (for direct access/testing)
  const candidateId = params?.id ? parseInt(params.id) : 0;
  const storeCandidate = candidates.find(c => c.id === candidateId);
  
  const candidate = storeCandidate || {
    id: 1,
    name: "Alex Morgan",
    role: "Senior Frontend Engineer",
    stage: "interview",
    score: 92,
    img: "https://github.com/shadcn.png"
  };

  return (
    <Layout>
      <Dialog open={isSchedulingOpen} onOpenChange={setIsSchedulingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Send an invitation to {candidate.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <Select onValueChange={setInterviewType} defaultValue="technical">
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="screening">Initial Screening</SelectItem>
                  <SelectItem value="technical">Technical Round</SelectItem>
                  <SelectItem value="culture">Culture Fit</SelectItem>
                  <SelectItem value="final">Final Round</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Date</Label>
              <Input type="datetime-local" className="col-span-3" onChange={(e) => setInterviewDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Interviewer</Label>
              <Select defaultValue="sarah">
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select interviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sarah">Sarah Connor (HM)</SelectItem>
                  <SelectItem value="john">John Wick (Tech Lead)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleScheduleInterview}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-900 -ml-2 mb-4"
          onClick={() => setLocation("/recruitment")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pipeline
        </Button>

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-between bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex gap-6">
            <Avatar className="h-24 w-24 border-4 border-slate-50 shadow-sm">
              <AvatarImage src={candidate.img} />
              <AvatarFallback className="text-2xl bg-slate-100 text-slate-500">{candidate.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-display font-bold text-slate-900">{candidate.name}</h1>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1 text-xs">
                  {candidate.score}% Match
                </Badge>
              </div>
              <p className="text-lg text-slate-500 font-medium mb-4">{candidate.role}</p>
              
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer transition-colors">
                  <Mail className="h-4 w-4" /> alex.morgan@example.com
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> +1 (555) 123-4567
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> San Francisco, CA
                </span>
                <div className="flex gap-2 ml-2 border-l border-slate-200 pl-4">
                  <Linkedin className="h-4 w-4 text-[#0077b5] cursor-pointer hover:opacity-80" />
                  <LinkIcon className="h-4 w-4 text-slate-400 cursor-pointer hover:text-slate-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20" onClick={() => setIsSchedulingOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" /> Schedule Interview
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-slate-200">
                <MessageSquare className="h-4 w-4 mr-2" /> Email
              </Button>
              <Button variant="outline" size="icon" className="border-slate-200">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Current Stage</span>
              <span className="font-bold text-slate-900 capitalize">{candidate.stage}</span>
            </div>
            <Progress value={
              candidate.stage === 'applied' ? 25 :
              candidate.stage === 'screening' ? 50 :
              candidate.stage === 'interview' ? 75 : 100
            } className="h-1.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start h-12 bg-white border-b border-slate-200 rounded-none p-0 mb-6">
              <TabsTrigger value="overview" className="h-full px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none">Overview</TabsTrigger>
              <TabsTrigger value="resume" className="h-full px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none">Resume</TabsTrigger>
              <TabsTrigger value="interviews" className="h-full px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none">Interviews</TabsTrigger>
              <TabsTrigger value="scorecard" className="h-full px-6 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none">Scorecard</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-purple-600" />
                    AI Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-600 leading-relaxed">
                    Alex demonstrates <strong className="text-slate-900">exceptional technical proficiency</strong> in React and modern frontend architectures. 
                    Their experience at TechCorp shows a track record of <strong className="text-slate-900">delivering scalable systems</strong>. 
                    Communication skills are strong, though they may need support with backend integrations initially.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <h4 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Key Strengths
                      </h4>
                      <ul className="space-y-1.5 text-sm text-green-700">
                        <li>• Advanced React Patterns & Hooks</li>
                        <li>• System Design Experience</li>
                        <li>• Mentorship & Team Leadership</li>
                      </ul>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                      <h4 className="font-bold text-yellow-800 text-sm mb-2 flex items-center gap-2">
                        <Star className="h-4 w-4" /> Areas for Growth
                      </h4>
                      <ul className="space-y-1.5 text-sm text-yellow-700">
                        <li>• GraphQL Implementation Depth</li>
                        <li>• Cloud Infrastructure (AWS)</li>
                        <li>• Database Optimization</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Experience</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative pl-6 border-l-2 border-slate-100 pb-6 last:pb-0">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-white border-2 border-blue-600"></div>
                    <h3 className="font-bold text-slate-900">Senior Software Engineer</h3>
                    <p className="text-sm text-slate-500 mb-2">TechCorp Inc • 2021 - Present</p>
                    <p className="text-slate-600 text-sm">Led the migration of legacy monolith to micro-frontends using Module Federation. Improved build times by 60%.</p>
                  </div>
                  <div className="relative pl-6 border-l-2 border-slate-100 pb-6 last:pb-0">
                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-slate-300 border-2 border-white"></div>
                    <h3 className="font-bold text-slate-900">Frontend Developer</h3>
                    <p className="text-sm text-slate-500 mb-2">StartUp Flow • 2018 - 2021</p>
                    <p className="text-slate-600 text-sm">Built the core product MVP from scratch using React and TypeScript. Scaled user base to 100k.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resume">
              <div className="h-[600px] bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Resume Preview</p>
                  <Button variant="outline" className="mt-4">
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Application Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Applied Date</span>
                <span className="font-medium text-slate-900">Jan 12, 2026</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Source</span>
                <span className="font-medium text-slate-900">LinkedIn</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Referred By</span>
                <span className="font-medium text-slate-900">-</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Desired Salary</span>
                <span className="font-medium text-slate-900">$140k - $160k</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["React", "TypeScript", "Node.js", "System Design", "Remote"].map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                    {tag}
                  </Badge>
                ))}
                <Badge variant="outline" className="border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600 cursor-pointer">
                  + Add
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm bg-slate-50/50">
            <CardHeader>
              <CardTitle>Hiring Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>HM</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-slate-900">Sarah Connor</p>
                  <p className="text-xs text-slate-500">Hiring Manager</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>RC</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-slate-900">John Wick</p>
                  <p className="text-xs text-slate-500">Recruiter</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}