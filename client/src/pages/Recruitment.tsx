import Layout from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Briefcase, MapPin, Clock, Users, FileText, Eye, Trash2,
  ArrowRight, Send, CheckCircle, XCircle, UserPlus, BarChart3, Building2,
  Share2, Linkedin, ExternalLink, Copy, Shield, Upload, AlertTriangle, Ban,
  Link2, MailCheck, RefreshCw, Sparkles, FileEdit, LayoutGrid, List, GripVertical, X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { formatDistanceToNow } from "date-fns";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { EmployeeSelect, EmployeeMultiSelect } from "@/components/EmployeeSelect";
import {
  KpiCard,
  FilterBar,
  PipelineColumn,
  CandidateCard,
  CandidateDrawer,
  type PipelineApplication,
  type PipelineStage,
} from "@/components/recruitment";
import { Skeleton } from "@/components/ui/skeleton";

// ==================== TYPES ====================

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string | null;
  employment_type: string | null;
  description: string | null;
  requirements: string | null;
  salary_range_min: string | null;
  salary_range_max: string | null;
  salary_currency: string | null;
  headcount: number;
  hiring_manager_id: string | null;
  hiring_manager_ids: string[] | null;
  hm_names: string[];
  hm_ids: string[];
  status: string;
  published_channels: string[] | null;
  application_count: number;
  hired_count: number;
  published_at: string | null;
  created_at: string;
}

interface AppRow {
  id: string;
  candidate_id: string;
  job_id: string;
  stage: string;
  first_name: string;
  last_name: string;
  candidate_email: string;
  current_company: string | null;
  experience_years: number | null;
  expected_salary: string | null;
  resume_url: string | null;
  job_title: string;
  job_department: string;
  applied_at: string;
  stage_updated_at: string | null;
  offer_id?: string | null;
  offer_status?: string | null;
  offer_approval_status?: string | null;
  offer_letter_url?: string | null;
  offer_letter_filename?: string | null;
  tentative_status?: string | null;
}

interface CandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  current_company: string | null;
  current_title: string | null;
  experience_years: number | null;
  expected_salary: string | null;
  source: string | null;
  application_count: number;
  created_at: string;
  resume_url?: string | null;
  resume_filename?: string | null;
}

const STAGES = [
  { id: "applied", label: "Applied", color: "bg-blue-500" },
  { id: "longlisted", label: "Longlisted", color: "bg-indigo-500" },
  { id: "screening", label: "Screening", color: "bg-purple-500" },
  { id: "shortlisted", label: "Shortlisted", color: "bg-cyan-500" },
  { id: "assessment", label: "Assessment", color: "bg-amber-500" },
  { id: "interview", label: "Interview", color: "bg-orange-500" },
  { id: "verbally_accepted", label: "Verbally Accepted", color: "bg-teal-500" },
  { id: "tentative", label: "Tentative", color: "bg-yellow-500" },
  { id: "offer", label: "Offer", color: "bg-emerald-500" },
  { id: "hired", label: "Hired", color: "bg-green-600" },
  { id: "rejected", label: "Rejected", color: "bg-red-500" },
];

function stageBadge(stage: string) {
  const s = STAGES.find((x) => x.id === stage);
  const label = s?.label || stage;
  const colorMap: Record<string, string> = {
    applied: "bg-blue-100 text-blue-700 border-blue-200",
    longlisted: "bg-indigo-100 text-indigo-700 border-indigo-200",
    screening: "bg-purple-100 text-purple-700 border-purple-200",
    shortlisted: "bg-cyan-100 text-cyan-700 border-cyan-200",
    assessment: "bg-amber-100 text-amber-700 border-amber-200",
    interview: "bg-orange-100 text-orange-700 border-orange-200",
    verbally_accepted: "bg-teal-100 text-teal-700 border-teal-200",
    offer: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tentative: "bg-yellow-100 text-yellow-700 border-yellow-200",
    hired: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return <Badge variant="outline" className={`text-xs ${colorMap[stage] || ""}`}>{label}</Badge>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ==================== JOB DIALOG ====================

function JobDialog({
  open,
  onClose,
  job,
  employees,
  preFill,
}: {
  open: boolean;
  onClose: () => void;
  job: JobPosting | null;
  employees: any[];
  preFill?: { title?: string; department?: string; description?: string; requirements?: string } | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!job?.id;
  const [form, setForm] = useState({
    title: job?.title || "",
    department: job?.department || "",
    location: job?.location || "",
    employmentType: job?.employment_type || "full_time",
    description: job?.description || "",
    requirements: job?.requirements || "",
    salaryRangeMin: job?.salary_range_min || "",
    salaryRangeMax: job?.salary_range_max || "",
    salaryCurrency: job?.salary_currency || "AED",
    headcount: job?.headcount?.toString() || "1",
    hiringManagerIds: job?.hm_ids || (job?.hiring_manager_id ? [job.hiring_manager_id] : []),
    status: job?.status || "draft",
    publishedChannels: job?.published_channels || ["career_page"],
  });
  const [loading, setLoading] = useState(false);

  // When opening for create with preFill (from AI generator), apply it
  useEffect(() => {
    if (open && !job && preFill) {
      setForm((f) => ({
        ...f,
        title: preFill.title ?? f.title,
        department: preFill.department ?? f.department,
        description: preFill.description ?? f.description,
        requirements: preFill.requirements ?? f.requirements,
      }));
    }
  }, [open, job, preFill]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.department.trim()) {
      toast.error("Title and Department are required");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        headcount: parseInt(form.headcount) || 1,
        salaryRangeMin: form.salaryRangeMin ? parseFloat(form.salaryRangeMin) : null,
        salaryRangeMax: form.salaryRangeMax ? parseFloat(form.salaryRangeMax) : null,
        hiringManagerIds: form.hiringManagerIds.length > 0 ? form.hiringManagerIds : null,
        hiringManagerId: form.hiringManagerIds.length > 0 ? form.hiringManagerIds[0] : null,
      };
      if (isEdit) {
        await apiRequest("PATCH", `/api/recruitment/jobs/${job.id}`, payload);
        toast.success("Job updated");
      } else {
        await apiRequest("POST", "/api/recruitment/jobs", payload);
        toast.success("Job created");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs/filter-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Job Posting" : "Create Job Posting"}</DialogTitle>
          <DialogDescription>Fill in the details for this position.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Frontend Engineer" />
              </div>
              <div className="space-y-2">
                <Label>Department *</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Engineering" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Dubai, Remote" />
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select value={form.employmentType} onValueChange={(v) => setForm({ ...form, employmentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Job description..." />
            </div>
            <div className="space-y-2">
              <Label>Requirements</Label>
              <Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} placeholder="Required qualifications..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Min Salary</Label>
                <Input type="number" value={form.salaryRangeMin} onChange={(e) => setForm({ ...form, salaryRangeMin: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Max Salary</Label>
                <Input type="number" value={form.salaryRangeMax} onChange={(e) => setForm({ ...form, salaryRangeMax: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={form.salaryCurrency} onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })} placeholder="AED" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hiring Manager(s)</Label>
                <EmployeeMultiSelect
                  value={form.hiringManagerIds}
                  onChange={(ids) => setForm({ ...form, hiringManagerIds: ids })}
                  employees={employees}
                  placeholder="Select hiring manager(s)..."
                />
              </div>
              <div className="space-y-2">
                <Label>Headcount</Label>
                <Input type="number" min="1" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : isEdit ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== AI JOB DESCRIPTION GENERATOR DIALOG ====================

const AI_PREVIEW_PLACEHOLDER = `We are looking for a talented professional to join our team...

**Responsibilities**
• Lead and deliver on key initiatives
• Collaborate with cross-functional teams
• Mentor and support team members

**Requirements**
• Relevant experience and skills
• Strong communication and problem-solving
• Portfolio or examples of work`;

function AIGeneratorDialog({
  open,
  onClose,
  onUseDescription,
}: {
  open: boolean;
  onClose: () => void;
  onUseDescription: (content: { title: string; department: string; description: string; requirements: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [experience, setExperience] = useState("mid");
  const [skills, setSkills] = useState("");
  const [generated, setGenerated] = useState(false);
  const [preview, setPreview] = useState("");

  const handleGenerate = () => {
    setGenerated(true);
    setPreview(AI_PREVIEW_PLACEHOLDER.replace("talented professional", title || "talented professional").replace("our team", `${department || "our"} team`));
  };

  const handleUseAndCreate = () => {
    const desc = preview || "Job description to be finalized.";
    const reqMatch = desc.includes("**Requirements**") ? desc.split("**Requirements**")[1]?.trim() : "";
    const descMatch = desc.includes("**Responsibilities**") ? desc.split("**Responsibilities**")[0]?.trim() : desc;
    onUseDescription({
      title: title || "New role",
      department: department || "General",
      description: descMatch || desc,
      requirements: reqMatch || "See description.",
    });
    onClose();
    setGenerated(false);
    setPreview("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate job description with AI
          </DialogTitle>
          <DialogDescription>Enter a few details and we&apos;ll generate a draft. You can then use it to create the job posting.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Product Designer" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
            </div>
            <div className="space-y-2">
              <Label>Experience level</Label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jr">Junior</SelectItem>
                  <SelectItem value="mid">Mid-Level</SelectItem>
                  <SelectItem value="sr">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Key skills (comma separated)</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Figma" />
            </div>
            <Button className="w-full gap-2" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4" /> Generate with AI
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <ScrollArea className="h-[240px] rounded-md border border-border p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {generated ? preview : "Fill the form and click Generate to see a draft."}
            </ScrollArea>
            {generated && (
              <Button variant="outline" className="w-full gap-2" onClick={handleUseAndCreate}>
                <FileEdit className="h-4 w-4" /> Use description & create job
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== STAGE CHANGE DIALOG ====================

function StageChangeDialog({
  open,
  onClose,
  application,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
  employees: { id: string; first_name: string; last_name: string; department?: string; employee_id?: string; work_email?: string }[];
}) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState(application?.stage || "applied");
  const [notes, setNotes] = useState("");
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedInterviewerIds([]);
  }, [application?.id]);

  const interviewerNames = selectedInterviewerIds
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `${e!.first_name} ${e!.last_name}`)
    .join(", ");

  const handleSave = async () => {
    if (!application) return;
    const previousApps = queryClient.getQueryData<AppRow[]>(["/api/recruitment/applications"]);
    // Optimistic update: move card immediately so UI feels instant
    queryClient.setQueryData<AppRow[]>(["/api/recruitment/applications"], (prev) => {
      if (!prev) return prev;
      return prev.map((a) => (a.id === application.id ? { ...a, stage } : a));
    });
    setLoading(true);
    onClose();
    try {
      await apiRequest("PATCH", `/api/recruitment/applications/${application.id}/stage`, {
        stage,
        notes: notes || null,
        interviewerNames: interviewerNames || null,
        interviewerIds: selectedInterviewerIds.length > 0 ? selectedInterviewerIds : null,
        rejectReason: stage === "rejected" ? rejectReason : null,
      });
      toast.success(`Moved to ${STAGES.find((s) => s.id === stage)?.label || stage}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stage");
      if (previousApps) queryClient.setQueryData(["/api/recruitment/applications"], previousApps);
    } finally {
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Move Candidate</DialogTitle>
          <DialogDescription>
            {application ? `${application.first_name} ${application.last_name} — ${application.job_title}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Stage *</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.filter((s) => s.id !== "hired" && s.id !== "tentative").map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(stage === "interview" || stage === "screening") && (
            <div className="space-y-2">
              <Label>Interviewer(s)</Label>
              <EmployeeMultiSelect
                value={selectedInterviewerIds}
                onChange={setSelectedInterviewerIds}
                employees={employees as any}
                placeholder="Select employees..."
              />
            </div>
          )}
          {stage === "rejected" && (
            <div className="space-y-2">
              <Label>Reject Reason</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Optional reason..." />
            </div>
          )}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Move"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== OFFER DIALOG ====================

function OfferDialog({
  open,
  onClose,
  application,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    salary: "",
    salaryCurrency: "AED",
    jobTitle: application?.job_title || "",
    department: application?.job_department || "",
    startDate: "",
    employmentType: "full_time",
    terms: "",
    status: "draft" as string,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!application || !form.salary || !form.jobTitle) {
      toast.error("Salary and Job Title are required");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/recruitment/offers", {
        applicationId: application.id,
        salary: parseFloat(form.salary),
        salaryCurrency: form.salaryCurrency,
        jobTitle: form.jobTitle,
        department: form.department,
        startDate: form.startDate || null,
        employmentType: form.employmentType,
        terms: form.terms || null,
        status: form.status,
      });
      toast.success("Offer created");
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create offer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Offer</DialogTitle>
          <DialogDescription>
            {application ? `For ${application.first_name} ${application.last_name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Salary *</Label>
              <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. 25000" />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={form.salaryCurrency} onChange={(e) => setForm({ ...form, salaryCurrency: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job Title *</Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Terms / Notes</Label>
            <Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={3} placeholder="Offer terms, benefits, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Create Offer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== HIRE DIALOG ====================

function HireDialog({
  open,
  onClose,
  application,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill suggested employee ID from candidate → employee automation
  useEffect(() => {
    if (!open || !application) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/employees/suggested-id");
        const data = await res.json();
        if (!cancelled && data?.suggestedId) setEmployeeId(data.suggestedId);
      } catch {
        if (!cancelled) setEmployeeId("");
      }
    })();
    return () => { cancelled = true; };
  }, [open, application?.id]);

  const handleHire = async () => {
    if (!application || !employeeId.trim()) {
      toast.error("Employee ID is required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/recruitment/applications/${application.id}/hire`, {
        employeeId: employeeId.trim(),
      });
      const data = await res.json();
      toast.success(`${application.first_name} ${application.last_name} has been hired!`, {
        description: "Employee created. Start onboarding from their profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to hire candidate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Hire Candidate</DialogTitle>
          <DialogDescription>
            {application ? `Convert ${application.first_name} ${application.last_name} to an employee. Employee details will be filled from the candidate profile and offer.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {application && (
            <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Will create employee:</strong> {application.first_name} {application.last_name}, {application.candidate_email}, {application.job_title}, {application.job_department}. Work email will use the candidate&apos;s email until Microsoft account is provisioned.
            </div>
          )}
          <div className="space-y-2">
            <Label>Employee ID *</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP-009" />
            <p className="text-xs text-muted-foreground">Suggested ID is pre-filled; you can change it.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleHire} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4 mr-2" /> {loading ? "Processing..." : "Hire Candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== TENTATIVE DIALOG (Initiate) ====================

function TentativeInitDialog({
  open,
  onClose,
  application,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
}) {
  const queryClient = useQueryClient();
  const [isFirstJob, setIsFirstJob] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleInitiate = async () => {
    if (!application) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/tentative/initiate", {
        applicationId: application.id,
        isFirstJob,
      });
      const data = await res.json();
      toast.success("Tentative initiated — document checklist generated", {
        description: `Portal link: ${window.location.origin}${data.portalUrl}`,
        duration: 8000,
      });
      // Copy portal link to clipboard
      navigator.clipboard.writeText(`${window.location.origin}${data.portalUrl}`);
      toast.info("Portal link copied to clipboard");
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate tentative");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-yellow-600" /> Initiate Tentative Hiring</DialogTitle>
          <DialogDescription>
            {application ? `${application.first_name} ${application.last_name} — Start document verification before final hire.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-medium text-sm text-yellow-800 dark:text-yellow-200 mb-2">What happens next:</h4>
            <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>1. A document checklist is generated</li>
              <li>2. A secure upload link is created for the candidate</li>
              <li>3. Candidate uploads required documents</li>
              <li>4. HR verifies each document</li>
              <li>5. Once all cleared, you can Confirm Hire</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Label className="font-medium">Is this the candidate's first full-time job?</Label>
            <p className="text-xs text-muted-foreground">This determines which employment documents are required.</p>
            <div className="flex gap-3">
              <Button
                variant={!isFirstJob ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFirstJob(false)}
              >
                No, experienced
              </Button>
              <Button
                variant={isFirstJob ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFirstJob(true)}
              >
                Yes, first job
              </Button>
            </div>
            {isFirstJob && (
              <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                Previous salary slips, experience certificates, and resignation letters will be marked as "Not Applicable".
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInitiate} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            <Shield className="h-4 w-4 mr-2" /> {loading ? "Initiating..." : "Start Tentative"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== TENTATIVE REVIEW DIALOG (HR verifies docs) ====================

function TentativeReviewDialog({
  open,
  onClose,
  application,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
}) {
  const queryClient = useQueryClient();
  const [confirmHireOpen, setConfirmHireOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const { data: tentative, isLoading } = useQuery<any>({
    queryKey: ["/api/tentative", application?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/tentative/${application!.id}`);
      return r.json();
    },
    enabled: !!application?.id && open,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ docId, action, reason }: { docId: string; action: string; reason?: string }) => {
      const r = await apiRequest("PATCH", `/api/tentative/documents/${docId}/verify`, { action, reason });
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify" ? "Document verified" : "Document rejected");
      queryClient.invalidateQueries({ queryKey: ["/api/tentative", application?.id] });
    },
    onError: (err: any) => toast.error(err?.message || "Action failed"),
  });

  const clearMutation = useMutation({
    mutationFn: async (tentativeId: string) => {
      const r = await apiRequest("POST", `/api/tentative/${tentativeId}/clear`);
      return r.json();
    },
    onSuccess: () => {
      toast.success("Tentative cleared — ready for Confirm Hire");
      queryClient.invalidateQueries({ queryKey: ["/api/tentative", application?.id] });
    },
    onError: (err: any) => toast.error(err?.message || "Cannot clear yet"),
  });

  const failMutation = useMutation({
    mutationFn: async ({ tentativeId, reason }: { tentativeId: string; reason?: string }) => {
      const r = await apiRequest("POST", `/api/tentative/${tentativeId}/fail`, { reason });
      return r.json();
    },
    onSuccess: () => {
      toast.success("Tentative marked as failed — application rejected");
      queryClient.invalidateQueries({ queryKey: ["/api/tentative", application?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      onClose();
    },
    onError: (err: any) => toast.error(err?.message || "Action failed"),
  });

  const DOC_LABELS: Record<string, string> = {
    cnic_front: "CNIC Front", cnic_back: "CNIC Back", professional_photo: "Professional Photo",
    passport: "Passport", drivers_license: "Driver's License", degree_transcript: "Degree / Transcript",
    experience_certificate: "Experience Certificate", salary_slip: "Latest Salary Slip",
    resignation_acceptance: "Resignation Acceptance", internship_certificate: "Internship Certificate",
  };

  const docs = tentative?.documents || [];
  const requiredDocs = docs.filter((d: any) => d.required);
  const allRequiredDone = requiredDocs.every((d: any) => d.status === "verified" || d.status === "not_applicable");
  const isCleared = tentative?.status === "cleared";

  return (
    <>
      <Dialog open={open && !confirmHireOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-600" />
              Tentative Review — {application?.first_name} {application?.last_name}
            </DialogTitle>
            <DialogDescription>
              Verify candidate documents before confirming hire.
              {tentative?.portal_token && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs p-0 h-auto ml-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/tentative-portal/${tentative.portal_token}`);
                    toast.success("Portal link copied");
                  }}
                >
                  Copy portal link
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div
              className="overflow-y-auto overscroll-contain pr-2 -mr-1"
              style={{ maxHeight: "min(55vh, 520px)" }}
            >
              <div className="space-y-4 py-2">
                {/* Status */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant="outline" className={
                      tentative?.status === "cleared" ? "bg-green-100 text-green-700 border-green-200" :
                      tentative?.status === "failed" ? "bg-red-100 text-red-700 border-red-200" :
                      "bg-yellow-100 text-yellow-700 border-yellow-200"
                    }>{tentative?.status?.toUpperCase()}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {tentative?.is_first_job ? "First Job" : "Experienced"}
                    </Badge>
                  </div>
                </div>

                {/* Documents */}
                {docs.map((doc: any) => (
                  <div key={doc.id} className={`p-3 rounded-lg border ${doc.status === "rejected" ? "border-red-200 bg-red-50/30" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {doc.status === "verified" && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                        {doc.status === "uploaded" && <Upload className="h-4 w-4 text-blue-500 shrink-0" />}
                        {doc.status === "pending" && <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                        {doc.status === "rejected" && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        {doc.status === "not_applicable" && <Ban className="h-4 w-4 text-slate-400 shrink-0" />}
                        <div>
                          <p className="font-medium text-sm">{DOC_LABELS[doc.document_type] || doc.document_type}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.required && <span className="text-[10px] text-red-500 font-medium">REQUIRED</span>}
                            {doc.file_name && <span className="text-[10px] text-muted-foreground">{doc.file_name}</span>}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${
                        doc.status === "verified" ? "bg-green-100 text-green-700" :
                        doc.status === "uploaded" ? "bg-blue-100 text-blue-700" :
                        doc.status === "rejected" ? "bg-red-100 text-red-700" :
                        doc.status === "not_applicable" ? "bg-slate-100 text-slate-500" :
                        "bg-amber-100 text-amber-700"
                      }`}>{doc.status.replace("_", " ")}</Badge>
                    </div>

                    {/* View uploaded file — use API so PDF/images open correctly in new tab */}
                    {["uploaded", "verified", "rejected"].includes(doc.status) && (
                      <div className="mt-2">
                        <a
                          href={`/api/tentative/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> View document
                        </a>
                      </div>
                    )}

                    {doc.rejection_reason && (
                      <p className="text-xs text-red-600 mt-2 bg-red-100 rounded px-2 py-1">Rejection: {doc.rejection_reason}</p>
                    )}

                    {/* Verify/Reject actions */}
                    {doc.status === "uploaded" && !isCleared && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700"
                          onClick={() => verifyMutation.mutate({ docId: doc.id, action: "verify" })}
                          disabled={verifyMutation.isPending}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" /> Verify
                        </Button>
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            placeholder="Rejection reason..."
                            className="h-7 text-xs"
                            value={rejectReason[doc.id] || ""}
                            onChange={(e) => setRejectReason({ ...rejectReason, [doc.id]: e.target.value })}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 hover:text-red-700 shrink-0"
                            onClick={() => {
                              if (!rejectReason[doc.id]?.trim()) { toast.error("Rejection reason required"); return; }
                              verifyMutation.mutate({ docId: doc.id, action: "reject", reason: rejectReason[doc.id] });
                            }}
                            disabled={verifyMutation.isPending}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {tentative?.status === "pending" && (
              <>
                <Button variant="outline" className="text-red-600" onClick={() => {
                  const reason = prompt("Reason for failing this tentative?");
                  if (reason !== null) failMutation.mutate({ tentativeId: tentative.id, reason });
                }}>
                  Mark Failed
                </Button>
                <Button
                  onClick={() => clearMutation.mutate(tentative.id)}
                  disabled={!allRequiredDone || clearMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {clearMutation.isPending ? "Clearing..." : allRequiredDone ? "Clear Tentative" : "Pending Docs..."}
                </Button>
              </>
            )}
            {tentative?.status === "cleared" && (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => setConfirmHireOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Confirm Hire
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Hire sub-dialog */}
      {confirmHireOpen && tentative && (
        <ConfirmHireDialog
          open={confirmHireOpen}
          onClose={() => { setConfirmHireOpen(false); onClose(); }}
          tentativeId={tentative.id}
          application={application}
        />
      )}
    </>
  );
}

// ==================== CONFIRM HIRE DIALOG (via Tentative) ====================

function ConfirmHireDialog({
  open,
  onClose,
  tentativeId,
  application,
}: {
  open: boolean;
  onClose: () => void;
  tentativeId: string;
  application: AppRow | null;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill suggested employee ID (same automation as Hire dialog)
  useEffect(() => {
    if (!open || !application) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/employees/suggested-id");
        const data = await res.json();
        if (!cancelled && data?.suggestedId) setEmployeeId(data.suggestedId);
      } catch {
        if (!cancelled) setEmployeeId("");
      }
    })();
    return () => { cancelled = true; };
  }, [open, application?.id]);

  const handleConfirm = async () => {
    if (!employeeId.trim()) {
      toast.error("Employee ID is required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/tentative/${tentativeId}/confirm-hire`, {
        employeeId: employeeId.trim(),
      });
      const data = await res.json();
      toast.success(`${application?.first_name} ${application?.last_name} has been hired!`, {
        description: "Employee created. Start onboarding from their profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to confirm hire");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" /> Confirm Hire
          </DialogTitle>
          <DialogDescription>
            {application ? `All documents verified. Convert ${application.first_name} ${application.last_name} to an employee.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Tentative cleared — all documents verified. Employee will be created from the candidate profile and offer (name, email, job, department, location). Work email will use the candidate&apos;s email until Microsoft account is provisioned.
          </div>
          {application && (
            <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Will create:</strong> {application.first_name} {application.last_name}, {application.candidate_email}, {application.job_title}, {application.job_department}.
            </div>
          )}
          <div className="space-y-2">
            <Label>Employee ID *</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. EMP-009" />
            <p className="text-xs text-muted-foreground">Suggested ID is pre-filled; you can change it.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <UserPlus className="h-4 w-4 mr-2" /> {loading ? "Processing..." : "Confirm Hire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== JOB DETAIL DIALOG ====================

function JobDetailDialog({
  open,
  onClose,
  job,
}: {
  open: boolean;
  onClose: () => void;
  job: JobPosting | null;
}) {
  const [, setLocation] = useLocation();
  const { data: jobDetail, isLoading } = useQuery<JobPosting & { applications?: AppRow[] }>({
    queryKey: ["/api/recruitment/jobs", job?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recruitment/jobs/${job!.id}`);
      return res.json();
    },
    enabled: !!job?.id && open,
  });

  const applications = jobDetail?.applications || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{job?.title}</DialogTitle>
          <DialogDescription>
            {job?.department}{job?.location ? ` · ${job.location}` : ""}
            {job?.employment_type ? ` · ${(job.employment_type || "").replace("_", " ")}` : ""}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-2">
              {jobDetail?.description && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobDetail.description}</p>
                </div>
              )}
              {jobDetail?.requirements && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Requirements</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobDetail.requirements}</p>
                </div>
              )}
              {jobDetail?.hm_names && jobDetail.hm_names.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Hiring Manager{jobDetail.hm_names.length > 1 ? "s" : ""}: {jobDetail.hm_names.join(", ")}
                </p>
              )}
              <div>
                <h4 className="font-semibold text-sm mb-3">Applicants ({applications.length})</h4>
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No applicants yet.</p>
                ) : (
                  <div className="space-y-2">
                    {applications.map((app: any) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">{app.first_name?.[0]}{app.last_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <button
                              onClick={() => {
                                onClose();
                                setLocation(`/recruitment/candidates/${app.candidate_id}`);
                              }}
                              className="font-medium text-sm hover:text-primary hover:underline text-left"
                            >
                              {app.first_name} {app.last_name}
                            </button>
                            <p className="text-xs text-muted-foreground">{app.candidate_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {stageBadge(app.stage)}
                          {app.resume_url && (
                            <a
                              href={app.resume_url}
                              download={app.resume_filename || "resume.pdf"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" /> CV
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
        <DialogFooter className="flex-wrap gap-2">
          {job?.id && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/careers?job=${encodeURIComponent(job.id)}`;
                navigator.clipboard.writeText(url);
                toast.success("Link copied — opens directly to this job's application");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy apply link
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== PIPELINE DND HELPERS ====================

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-50" : ""}>
      {children}
    </div>
  );
}

function DroppableColumn({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={(className || "") + (isOver ? " ring-2 ring-primary/50 rounded-xl" : "")}>
      {children}
    </div>
  );
}

function PipelineDetailPanel({
  app,
  onClose,
  setStageDialog,
  setHireDialog,
  setOfferDialog,
  setTentativeInitDialog,
  setTentativeReviewDialog,
  setUploadLetterOfferId,
  queryClient,
}: {
  app: AppRow | null;
  onClose: () => void;
  setStageDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setHireDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setOfferDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setTentativeInitDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setTentativeReviewDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setUploadLetterOfferId: (id: string | null) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  if (!app) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 border-l bg-muted/20">
        <p className="text-sm text-muted-foreground">Select a candidate from the board or list</p>
        <p className="text-xs text-muted-foreground mt-1">Details and actions will appear here</p>
      </div>
    );
  }
  const stageLabel = STAGES.find((s) => s.id === app.stage)?.label || app.stage;
  const lastActivity = app.stage_updated_at ? formatDistanceToNow(new Date(app.stage_updated_at), { addSuffix: true }) : null;
  return (
    <div className="h-full flex flex-col border-l bg-card">
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm">Candidate</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{app.first_name[0]}{app.last_name[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Link href={`/recruitment/candidates/${app.candidate_id}`} className="font-semibold text-sm hover:underline block">{app.first_name} {app.last_name}</Link>
              <p className="text-xs text-muted-foreground truncate">{app.job_title}</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <p className="flex items-center gap-1.5"><MailCheck className="h-3.5 w-3.5 shrink-0" /><a href={`mailto:${app.candidate_email}`} className="text-primary hover:underline truncate block">{app.candidate_email}</a></p>
            {app.current_company && <p className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5 shrink-0" /> {app.current_company}{app.experience_years != null ? ` · ${app.experience_years}y` : ""}</p>}
            <p className="text-muted-foreground">Applied {app.applied_at ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true }) : "—"}</p>
            {lastActivity && <p className="text-muted-foreground">Last activity: {lastActivity}</p>}
            <p className="font-medium">Stage: {stageLabel}</p>
          </div>
          {app.resume_url && (
            <a href={app.resume_url} download target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Download CV
            </a>
          )}
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setStageDialog({ open: true, app })}>
                <ArrowRight className="h-3.5 w-3.5 mr-1" /> Move
              </Button>
              {app.stage === "interview" && (
                <Button variant="outline" size="sm" className="text-xs text-teal-600" onClick={async () => {
                  try {
                    await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/stage`, { stage: "verbally_accepted" });
                    toast.success("Marked as verbally accepted");
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                  } catch { toast.error("Failed"); }
                }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Verbal Acceptance</Button>
              )}
              {app.stage === "verbally_accepted" && (
                <Button variant="outline" size="sm" className="text-xs text-yellow-600" onClick={() => setTentativeInitDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Initiate Tentative</Button>
              )}
              {app.stage === "offer" && app.offer_id && (app.offer_status === "draft" || app.offer_status === "sent") && app.offer_approval_status !== "rejected" && (
                <>
                  <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={async () => {
                    try { await apiRequest("PATCH", `/api/recruitment/offers/${app.offer_id}/approve`); toast.success("Offer approved"); queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] }); queryClient.invalidateQueries({ queryKey: ["/api/recruitment/offers"] }); } catch { toast.error("Failed"); }
                  }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                  <Button variant="outline" size="sm" className="text-xs text-red-500" onClick={async () => {
                    try { await apiRequest("PATCH", `/api/recruitment/offers/${app.offer_id}/reject`); toast.success("Rejected"); queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] }); } catch { toast.error("Failed"); }
                  }}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                </>
              )}
              {app.stage === "offer" && app.offer_id && app.offer_approval_status === "approved" && (
                <>
                  {app.offer_letter_url ? (
                    <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/recruitment/offers/${app.offer_id}/letter`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 text-xs px-3 rounded-md border bg-muted/50 hover:bg-muted"><FileText className="h-3.5 w-3.5 mr-1" /> View letter</a>
                  ) : (
                    <Button variant="outline" size="sm" className="text-xs text-amber-700" onClick={() => setUploadLetterOfferId(app.offer_id!)}><Upload className="h-3.5 w-3.5 mr-1" /> Upload letter (PDF)</Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs text-blue-600" onClick={async () => {
                    try { const res = await apiRequest("GET", `/api/recruitment/offers/${app.offer_id}/link`); const data = await res.json(); await navigator.clipboard.writeText(data.url); toast.success("Link copied"); } catch { toast.error("Failed"); }
                  }}><Link2 className="h-3.5 w-3.5 mr-1" /> Copy link</Button>
                  <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={() => setHireDialog({ open: true, app })}><UserPlus className="h-3.5 w-3.5 mr-1" /> Direct hire</Button>
                </>
              )}
              {app.stage === "offer" && !app.offer_id && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })} disabled={!!(app.tentative_status && app.tentative_status !== "cleared")}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>
              )}
              {app.stage === "tentative" && app.tentative_status === "cleared" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>}
              {app.stage === "tentative" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setTentativeReviewDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Review Docs</Button>}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function Recruitment() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pipeline");

  // Dialogs
  const [jobDialog, setJobDialog] = useState<{ open: boolean; job: JobPosting | null }>({ open: false, job: null });
  const [aiGeneratorOpen, setAIGeneratorOpen] = useState(false);
  const [preFillForJob, setPreFillForJob] = useState<{ title?: string; department?: string; description?: string; requirements?: string } | null>(null);
  const [jobDetailDialog, setJobDetailDialog] = useState<{ open: boolean; job: JobPosting | null }>({ open: false, job: null });
  const [stageDialog, setStageDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [offerDialog, setOfferDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [hireDialog, setHireDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [tentativeInitDialog, setTentativeInitDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [tentativeReviewDialog, setTentativeReviewDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [addAppDialog, setAddAppDialog] = useState(false);
  const [addAppForm, setAddAppForm] = useState<{ candidateId: string; jobId: string; coverLetter: string }>({ candidateId: "", jobId: "", coverLetter: "" });
  const [uploadLetterOfferId, setUploadLetterOfferId] = useState<string | null>(null);
  const [uploadLetterFile, setUploadLetterFile] = useState<File | null>(null);
  const [addCandidateDialog, setAddCandidateDialog] = useState(false);
  const [selectedPipelineApp, setSelectedPipelineApp] = useState<AppRow | null>(null);
  const [fullDetailPanelOpen, setFullDetailPanelOpen] = useState(false);
  const [pipelineView, setPipelineView] = useState<"board" | "list">("board");
  const [pipelineDensity, setPipelineDensity] = useState<"comfortable" | "compact">("comfortable");
  const [addCandidateForm, setAddCandidateForm] = useState<{
    firstName: string; lastName: string; email: string; phone: string;
    personalEmail: string; dateOfBirth: string; gender: string; maritalStatus: string; bloodGroup: string;
    street: string; city: string; state: string; zipCode: string; country: string;
    currentCompany: string; currentTitle: string; experienceYears: string;
    resumeUrl: string; resumeFilename: string; source: string; notes: string;
  }>({
    firstName: "", lastName: "", email: "", phone: "",
    personalEmail: "", dateOfBirth: "", gender: "", maritalStatus: "", bloodGroup: "",
    street: "", city: "", state: "", zipCode: "", country: "",
    currentCompany: "", currentTitle: "", experienceYears: "", resumeUrl: "", resumeFilename: "", source: "manual", notes: "",
  });
  const addCandidateResumeInputRef = useRef<HTMLInputElement>(null);

  const [jobFilters, setJobFilters] = useState<{ status: string; department: string; location: string; employmentType: string }>({
    status: "all",
    department: "",
    location: "",
    employmentType: "",
  });
  const prevOfferStatusRef = useRef<Map<string, string>>(new Map());
  const offerLetterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadLetterOfferId) offerLetterInputRef.current?.click();
  }, [uploadLetterOfferId]);

  const jobsQueryParams = new URLSearchParams();
  if (jobFilters.status && jobFilters.status !== "all") jobsQueryParams.set("status", jobFilters.status);
  if (jobFilters.department) jobsQueryParams.set("department", jobFilters.department);
  if (jobFilters.location) jobsQueryParams.set("location", jobFilters.location);
  if (jobFilters.employmentType) jobsQueryParams.set("employmentType", jobFilters.employmentType);
  const jobsQueryString = jobsQueryParams.toString();

  const { data: jobs = [] } = useQuery<JobPosting[]>({
    queryKey: ["/api/recruitment/jobs", jobFilters.status, jobFilters.department, jobFilters.location, jobFilters.employmentType],
    queryFn: async () => {
      const url = `/api/recruitment/jobs${jobsQueryString ? `?${jobsQueryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Jobs: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    placeholderData: keepPreviousData,
  });
  const { data: jobFilterOptions } = useQuery<{ departments: string[]; locations: string[]; employmentTypes: string[] }>({
    queryKey: ["/api/recruitment/jobs/filter-options"],
    enabled: activeTab === "jobs",
  });
  const { data: applications = [], isLoading: applicationsLoading, refetch: refetchApplications } = useQuery<AppRow[]>({
    queryKey: ["/api/recruitment/applications"],
    queryFn: async () => {
      const res = await fetch("/api/recruitment/applications", { credentials: "include" });
      if (!res.ok) throw new Error(`Applications: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 8000,
    staleTime: 4000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
  const { data: candidatesList = [] } = useQuery<CandidateRow[]>({
    queryKey: ["/api/recruitment/candidates"],
    placeholderData: keepPreviousData,
  });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/recruitment/stats"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const createApplicationMutation = useMutation({
    mutationFn: async (body: { candidateId: string; jobId: string; coverLetter?: string }) => {
      const r = await apiRequest("POST", "/api/recruitment/applications", body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      setAddAppDialog(false);
      setAddAppForm({ candidateId: "", jobId: "", coverLetter: "" });
      toast.success("Application added to pipeline");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to add application"),
  });

  const createCandidateMutation = useMutation({
    mutationFn: async (body: {
      firstName: string; lastName: string; email: string; phone?: string;
      personalEmail?: string; dateOfBirth?: string; gender?: string; maritalStatus?: string; bloodGroup?: string;
      street?: string; city?: string; state?: string; zipCode?: string; country?: string;
      currentCompany?: string; currentTitle?: string; experienceYears?: number;
      resumeUrl?: string; resumeFilename?: string; source?: string; notes?: string;
    }) => {
      const r = await apiRequest("POST", "/api/recruitment/candidates", body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      setAddCandidateDialog(false);
      setAddCandidateForm({
        firstName: "", lastName: "", email: "", phone: "",
        personalEmail: "", dateOfBirth: "", gender: "", maritalStatus: "", bloodGroup: "",
        street: "", city: "", state: "", zipCode: "", country: "",
        currentCompany: "", currentTitle: "", experienceYears: "", resumeUrl: "", resumeFilename: "", source: "manual", notes: "",
      });
      toast.success("Candidate added");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to add candidate"),
  });

  const uploadLetterMutation = useMutation({
    mutationFn: async ({ offerId, file }: { offerId: string; file: File }) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Failed to read file"));
        r.readAsDataURL(file);
      });
      await apiRequest("POST", `/api/recruitment/offers/${offerId}/upload-letter`, {
        fileUrl: dataUrl,
        fileName: file.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      setUploadLetterOfferId(null);
      setUploadLetterFile(null);
      if (offerLetterInputRef.current) offerLetterInputRef.current.value = "";
      toast.success("Offer letter uploaded");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to upload offer letter"),
  });

  // Toast when an offer is accepted (detected on refetch; skip on first load)
  useEffect(() => {
    if (!applications.length) return;
    const prev = prevOfferStatusRef.current;
    const isSubsequentLoad = prev.size > 0;
    if (isSubsequentLoad) {
      for (const app of applications) {
        const nowAccepted = app.offer_status === "accepted";
        const wasAccepted = prev.get(app.id) === "accepted";
        if (nowAccepted && !wasAccepted) {
          const name = [app.first_name, app.last_name].filter(Boolean).join(" ") || app.candidate_email || "Candidate";
          toast.success(`Offer accepted — ${name} (${app.job_title || "job"})`, { duration: 6000 });
        }
      }
    }
    prevOfferStatusRef.current = new Map(applications.map((a) => [a.id, a.offer_status ?? ""]));
  }, [applications]);

  // Filter applications
  const filteredApps = applications.filter((a) => {
    const matchSearch = !searchTerm ||
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.candidate_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchJob = !selectedJobId || a.job_id === selectedJobId;
    return matchSearch && matchJob;
  });

  const activeStages = STAGES.filter((s) => s.id !== "rejected");

  // Delete handlers
  const handleDeleteJob = async (id: string) => {
    if (!confirm("Delete this job posting and all its applications?")) return;
    try {
      await apiRequest("DELETE", `/api/recruitment/jobs/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs/filter-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      toast.success("Job deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const handleDeleteApp = async (id: string) => {
    if (!confirm("Delete this application?")) return;
    try {
      await apiRequest("DELETE", `/api/recruitment/applications/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      toast.success("Application deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const pipelineSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const handlePipelineDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const appId = active.id as string;
    const newStageId = over.id as string;
    const app = filteredApps.find((a) => a.id === appId);
    if (!app || newStageId === app.stage) return;
    const previousApps = queryClient.getQueryData<AppRow[]>(["/api/recruitment/applications"]);
    queryClient.setQueryData<AppRow[]>(["/api/recruitment/applications"], (prev) => {
      if (!prev) return prev;
      return prev.map((a) => (a.id === appId ? { ...a, stage: newStageId } : a));
    });
    setSelectedPipelineApp((current) => (current?.id === appId ? { ...current, stage: newStageId } : current));
    apiRequest("PATCH", `/api/recruitment/applications/${appId}/stage`, { stage: newStageId })
      .then(() => {
        toast.success(`Moved to ${STAGES.find((s) => s.id === newStageId)?.label || newStageId}`);
        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      })
      .catch(() => {
        if (previousApps) queryClient.setQueryData(["/api/recruitment/applications"], previousApps);
        setSelectedPipelineApp((current) => (current?.id === appId && previousApps ? previousApps.find((a) => a.id === appId) || current : current));
        toast.error("Failed to move");
      });
  };

  return (
    <Layout>
      <input
        ref={offerLetterInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadLetterOfferId) {
            if (file.size > 10 * 1024 * 1024) {
              toast.error("File must be under 10 MB");
              e.target.value = "";
              setUploadLetterOfferId(null);
              return;
            }
            uploadLetterMutation.mutate({ offerId: uploadLetterOfferId, file });
          }
          e.target.value = "";
        }}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Recruitment</h1>
            <TabsList>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search candidates..." className="pl-9 h-9 rounded-xl border-border/80 bg-muted/30" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === "pipeline" && (
              <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setAddCandidateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Candidate
              </Button>
            )}
            {activeTab === "jobs" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" /> New Job
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setJobDialog({ open: true, job: null })}>
                    <FileEdit className="h-4 w-4 mr-2" /> Create manually
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAIGeneratorOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ==================== PIPELINE TAB ==================== */}
        <TabsContent value="pipeline" className="mt-0">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <KpiCard label="Open Jobs" value={jobs.filter((j) => j.status === "published" || j.status === "paused").length} />
            <KpiCard label="Total Candidates" value={filteredApps.length} />
            <KpiCard label="In Interview" value={filteredApps.filter((a) => a.stage === "interview").length} />
            <KpiCard label="Offers Sent" value={filteredApps.filter((a) => a.stage === "offer" && a.offer_id).length} />
            <KpiCard label="Hired" value={filteredApps.filter((a) => a.stage === "hired").length} />
          </div>

          <FilterBar
            jobFilterValue={selectedJobId || "__all__"}
            jobFilterOptions={jobs.filter((j) => j.status === "published" || j.status === "paused").map((j) => ({ value: j.id, label: `${j.title} (${j.department})` }))}
            onJobFilterChange={(v) => setSelectedJobId(v === "__all__" ? "" : v)}
            onAdvancedFiltersClick={() => toast.info("Advanced filters coming soon")}
            view={pipelineView}
            onViewChange={setPipelineView}
          />
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="sm" className="rounded-xl h-8" onClick={() => setAddAppDialog(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add application
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl h-8 text-muted-foreground" onClick={() => { refetchApplications(); toast.success("Refreshed"); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>

          {applicationsLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ height: "calc(100vh - 340px)" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-[280px] rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2.5 w-2.5 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-8 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : applications.length === 0 ? (
            <Card className="border border-dashed border-muted-foreground/30 bg-muted/20">
              <CardContent className="py-12 px-6 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <p className="text-muted-foreground font-medium">No applications in the pipeline</p>
                  <p className="text-sm text-muted-foreground">
                    The Applied, Hired, and other columns are empty because there are no application records yet.
                    Add one below, or:
                  </p>
                  <ol className="text-sm text-left list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Create a <strong>Job</strong> (Jobs tab) and set status to <strong>Published</strong> or <strong>Paused</strong>.</li>
                    <li>Add <strong>Candidates</strong> (Candidates tab) with name, email, and resume.</li>
                    <li>Use <strong>Add application</strong> to link a candidate to a job and they will appear in Applied.</li>
                  </ol>
                  <Button onClick={() => setAddAppDialog(true)} className="mt-2">
                    <UserPlus className="h-4 w-4 mr-2" /> Add application
                  </Button>
                  <p className="text-xs text-muted-foreground pt-2">
                    Applications can also come from the Career Site when candidates apply to published jobs.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <div className="min-h-[calc(100vh-320px)] rounded-lg border bg-muted/20">
              {pipelineView === "list" ? (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Name</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-muted-foreground">Last activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApps.map((app) => {
                        const stageInfo = STAGES.find((s) => s.id === app.stage);
                        const lastActivity = app.stage_updated_at ? formatDistanceToNow(new Date(app.stage_updated_at), { addSuffix: true }) : "—";
                        return (
                          <TableRow
                            key={app.id}
                            className={`cursor-pointer ${selectedPipelineApp?.id === app.id ? "bg-muted" : ""}`}
                            onClick={() => setSelectedPipelineApp(app)}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedPipelineApp(app)}
                          >
                            <TableCell className="font-medium">{app.first_name} {app.last_name}</TableCell>
                            <TableCell>{app.job_title}</TableCell>
                            <TableCell><span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${stageInfo ? "bg-muted" : ""}`}><span className={`w-1.5 h-1.5 rounded-full ${stageInfo?.color || "bg-gray-400"}`} />{stageInfo?.label || app.stage}</span></TableCell>
                            <TableCell className="text-muted-foreground text-xs">{lastActivity}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
              <div className="relative p-2">
                <p className="text-xs text-muted-foreground mb-2">Drag cards between columns. Click a card to open details.</p>
                <DndContext sensors={pipelineSensors} onDragEnd={handlePipelineDragEnd}>
                  <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth" style={{ height: "calc(100vh - 340px)", scrollbarGutter: "stable" }}>
                    {activeStages.map((stage) => {
                      const stageApps = filteredApps.filter((a) => a.stage === stage.id);
                      return (
                        <PipelineColumn
                          key={stage.id}
                          stage={stage}
                          count={stageApps.length}
                          droppableId={stage.id}
                        >
                          {stageApps.map((app) => (
                            <DraggableCard key={app.id} id={app.id}>
                              <CandidateCard
                                candidate={app as PipelineApplication}
                                isSelected={selectedPipelineApp?.id === app.id}
                                onClick={() => setSelectedPipelineApp(app)}
                                onMove={(e) => { e.stopPropagation(); setStageDialog({ open: true, app }); }}
                                onView={() => setSelectedPipelineApp(app)}
                                onEmail={(e) => { e.stopPropagation(); window.location.href = `mailto:${app.candidate_email}`; }}
                                onSchedule={(e) => { e.stopPropagation(); toast.info("Schedule interview coming soon"); }}
                              />
                            </DraggableCard>
                          ))}
                          {stageApps.length === 0 && (
                            <div className="text-center py-6 text-xs text-muted-foreground">No candidates</div>
                          )}
                        </PipelineColumn>
                      );
                    })}
                    {/* Rejected column */}
                    {(() => {
                      const rejectedApps = filteredApps.filter((a) => a.stage === "rejected");
                      const rejectedStage: PipelineStage = { id: "rejected", label: "Rejected", color: "bg-red-500" };
                      return (
                        <PipelineColumn
                          stage={rejectedStage}
                          count={rejectedApps.length}
                          droppableId="rejected"
                          isRejected
                        >
                          {rejectedApps.map((app) => (
                            <div key={app.id} className="bg-card/80 p-3 rounded-lg border border-red-200/30 shadow-sm opacity-70">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px]">{app.first_name[0]}{app.last_name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-xs">{app.first_name} {app.last_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{app.job_title}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {rejectedApps.length === 0 && (
                            <div className="text-center py-6 text-xs text-muted-foreground">No candidates</div>
                          )}
                        </PipelineColumn>
                      );
                    })()}
                  </div>
                </DndContext>
              </div>
              )}
            <CandidateDrawer
              open={!!selectedPipelineApp}
              onClose={() => setSelectedPipelineApp(null)}
              candidate={selectedPipelineApp}
              stageLabel={selectedPipelineApp ? (STAGES.find((s) => s.id === selectedPipelineApp.stage)?.label ?? selectedPipelineApp.stage) : undefined}
              onMoveStage={() => selectedPipelineApp && setStageDialog({ open: true, app: selectedPipelineApp })}
              onScheduleInterview={() => toast.info("Schedule interview coming soon")}
              onEmailCandidate={() => selectedPipelineApp && (window.location.href = `mailto:${selectedPipelineApp.candidate_email}`)}
              onOpenFullDetails={() => setFullDetailPanelOpen(true)}
            />
            <Dialog open={fullDetailPanelOpen} onOpenChange={(o) => setFullDetailPanelOpen(o)}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <PipelineDetailPanel
                  app={selectedPipelineApp}
                  onClose={() => setFullDetailPanelOpen(false)}
                  setStageDialog={setStageDialog}
                  setHireDialog={setHireDialog}
                  setOfferDialog={setOfferDialog}
                  setTentativeInitDialog={setTentativeInitDialog}
                  setTentativeReviewDialog={setTentativeReviewDialog}
                  setUploadLetterOfferId={setUploadLetterOfferId}
                  queryClient={queryClient}
                />
              </DialogContent>
            </Dialog>
          </div>
          )}
        </TabsContent>

        {/* ==================== JOBS TAB ==================== */}
        <TabsContent value="jobs">
          <div className="space-y-4">
            {/* Jobs filter bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground shrink-0">Filters:</span>
              <Select value={jobFilters.status} onValueChange={(v) => setJobFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={jobFilters.department || "__all__"} onValueChange={(v) => setJobFilters((f) => ({ ...f, department: v === "__all__" ? "" : v }))}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All departments</SelectItem>
                  {(jobFilterOptions?.departments ?? []).map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={jobFilters.location || "__all__"} onValueChange={(v) => setJobFilters((f) => ({ ...f, location: v === "__all__" ? "" : v }))}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Location / Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All locations</SelectItem>
                  {(jobFilterOptions?.locations ?? []).map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={jobFilters.employmentType || "__all__"} onValueChange={(v) => setJobFilters((f) => ({ ...f, employmentType: v === "__all__" ? "" : v }))}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Employment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {(jobFilterOptions?.employmentTypes ?? []).map((et) => (
                    <SelectItem key={et} value={et}>{(et || "").replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(jobFilters.status !== "all" || jobFilters.department || jobFilters.location || jobFilters.employmentType) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => setJobFilters({ status: "all", department: "", location: "", employmentType: "" })}>
                  Clear filters
                </Button>
              )}
            </div>

            {jobs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mb-3 opacity-40" />
                  <p className="font-medium">No job postings yet</p>
                  <p className="text-sm">Create your first job posting to start recruiting.</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="mt-4">
                        <Plus className="h-4 w-4 mr-2" /> Create Job
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                      <DropdownMenuItem onClick={() => setJobDialog({ open: true, job: null })}>
                        <FileEdit className="h-4 w-4 mr-2" /> Create manually
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAIGeneratorOpen(true)}>
                        <Sparkles className="h-4 w-4 mr-2" /> Generate with AI
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {jobs.map((job) => (
                  <Card
                    key={job.id}
                    className="cursor-pointer hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                    onClick={() => setJobDetailDialog({ open: true, job })}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-tight line-clamp-2">{job.title}</CardTitle>
                        <Badge variant={job.status === "published" ? "default" : "outline"} className={
                          "shrink-0 " + (
                            job.status === "published" ? "bg-green-100 text-green-700 border-green-200" :
                            job.status === "draft" ? "bg-slate-100 text-slate-600" :
                            job.status === "closed" ? "bg-red-100 text-red-700 border-red-200" :
                            job.status === "archived" ? "bg-slate-200 text-slate-600 border-slate-300" :
                            "bg-yellow-100 text-yellow-700 border-yellow-200"
                          )
                        }>
                          {job.status}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-1.5 text-xs mt-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {job.department}
                        {job.location && (
                          <>
                            <span className="text-muted-foreground/60">·</span>
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {job.location}
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="capitalize">{(job.employment_type || "").replace("_", " ")}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {job.application_count} applications
                        </span>
                        <span>
                          Hired {job.hired_count}/{job.headcount}
                        </span>
                      </div>
                      {job.hm_names && job.hm_names.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate" title={job.hm_names.join(", ")}>
                          HM: {job.hm_names.join(", ")}
                        </p>
                      )}
                      {job.published_at && (
                        <p className="text-xs text-muted-foreground">Published {formatDate(job.published_at)}</p>
                      )}
                      <div className="flex items-center gap-1 pt-2 mt-auto border-t border-border" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setJobDetailDialog({ open: true, job })}>
                          View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-xs"><Share2 className="h-3.5 w-3.5 mr-1" /> Share</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => {
                              const jobId = job?.id ?? (job as { id?: string })?.id;
                              const url = jobId
                                ? `${window.location.origin}/careers?job=${encodeURIComponent(jobId)}`
                                : `${window.location.origin}/careers`;
                              navigator.clipboard.writeText(url);
                              if (jobId) toast.success("Link copied — opens directly to this job's application");
                              else toast.warning("Job ID missing; general career page link copied.");
                            }}>
                              <Copy className="h-4 w-4 mr-2" /> Copy career page link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const jobId = job?.id ?? (job as { id?: string })?.id;
                              const url = jobId
                                ? `${window.location.origin}/careers?job=${encodeURIComponent(jobId)}`
                                : `${window.location.origin}/careers`;
                              window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "width=600,height=400");
                            }}>
                              <Linkedin className="h-4 w-4 mr-2" /> Share on LinkedIn
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              window.open("https://employers.indeed.com/post-job", "_blank");
                            }}>
                              <ExternalLink className="h-4 w-4 mr-2" /> Post to Indeed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setJobDialog({ open: true, job })}>Edit</Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 shrink-0" onClick={() => handleDeleteJob(job.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== CANDIDATES TAB ==================== */}
        <TabsContent value="candidates">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setAddCandidateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Add candidate
            </Button>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Applications</TableHead>
                  <TableHead>CV</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidatesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No candidates yet. Use &quot;Add candidate&quot; above for email or other applicants, or they appear here when they apply via the career site.
                    </TableCell>
                  </TableRow>
                ) : (
                  candidatesList
                    .filter((c) => !searchTerm || `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{c.first_name[0]}{c.last_name[0]}</AvatarFallback>
                            </Avatar>
                            <Link href={`/recruitment/candidates/${c.id}`} className="font-medium hover:underline">{c.first_name} {c.last_name}</Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell>{c.current_title || "-"}{c.current_company ? ` at ${c.current_company}` : ""}</TableCell>
                        <TableCell>{c.experience_years ? `${c.experience_years} years` : "-"}</TableCell>
                        <TableCell className="capitalize">{(c.source || "-").replace("_", " ")}</TableCell>
                        <TableCell className="text-center">{c.application_count}</TableCell>
                        <TableCell>
                          {c.resume_url ? (
                            <a href={c.resume_url} download={c.resume_filename || "resume.pdf"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                              <FileText className="h-4 w-4" /> Download
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(c.created_at)}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.jobs?.active_jobs ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Active Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.applications?.total_applications ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total Applications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.applications?.interviewing ?? 0}</p>
                    <p className="text-xs text-muted-foreground">In Interviews</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.applications?.hired ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Hired</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Breakdown</CardTitle>
              <CardDescription>Current status of all applications across the pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {STAGES.map((stage) => {
                  const count = applications.filter((a) => a.stage === stage.id).length;
                  const pct = applications.length > 0 ? (count / applications.length) * 100 : 0;
                  return (
                    <div key={stage.id} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium">{stage.label}</div>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-12 text-right text-sm font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {jobDialog.open && (
        <JobDialog
          open={jobDialog.open}
          onClose={() => { setJobDialog({ open: false, job: null }); setPreFillForJob(null); }}
          job={jobDialog.job}
          employees={employees}
          preFill={preFillForJob}
        />
      )}
      <AIGeneratorDialog
        open={aiGeneratorOpen}
        onClose={() => setAIGeneratorOpen(false)}
        onUseDescription={(content) => {
          setPreFillForJob(content);
          setAIGeneratorOpen(false);
          setJobDialog({ open: true, job: null });
        }}
      />
      <JobDetailDialog
        open={jobDetailDialog.open}
        onClose={() => setJobDetailDialog({ open: false, job: null })}
        job={jobDetailDialog.job}
      />
      <StageChangeDialog
        open={stageDialog.open}
        onClose={() => setStageDialog({ open: false, app: null })}
        application={stageDialog.app}
        employees={employees}
      />
      <OfferDialog
        open={offerDialog.open}
        onClose={() => setOfferDialog({ open: false, app: null })}
        application={offerDialog.app}
      />
      <HireDialog
        open={hireDialog.open}
        onClose={() => setHireDialog({ open: false, app: null })}
        application={hireDialog.app}
      />
      <TentativeInitDialog
        open={tentativeInitDialog.open}
        onClose={() => setTentativeInitDialog({ open: false, app: null })}
        application={tentativeInitDialog.app}
      />
      <TentativeReviewDialog
        open={tentativeReviewDialog.open}
        onClose={() => setTentativeReviewDialog({ open: false, app: null })}
        application={tentativeReviewDialog.app}
      />
      <Dialog open={addAppDialog} onOpenChange={(o) => { setAddAppDialog(o); if (!o) setAddAppForm({ candidateId: "", jobId: "", coverLetter: "" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add application</DialogTitle>
            <DialogDescription>Link a candidate to a job. They will appear in the Applied column. Job must be Published or Paused.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {candidatesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates yet. Add candidates in the Candidates tab first.</p>
            ) : (
              <div>
                <Label>Candidate</Label>
                <Select value={addAppForm.candidateId} onValueChange={(v) => setAddAppForm((f) => ({ ...f, candidateId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                  <SelectContent>
                    {candidatesList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(() => {
              const applicableJobs = jobs.filter((j) => j.status === "published" || j.status === "paused");
              if (applicableJobs.length === 0) return <p className="text-sm text-muted-foreground">No published or paused jobs. Create a job and set status to Published or Paused in the Jobs tab.</p>;
              return (
                <div>
                  <Label>Job</Label>
                  <Select value={addAppForm.jobId} onValueChange={(v) => setAddAppForm((f) => ({ ...f, jobId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                    <SelectContent>
                      {applicableJobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>{j.title} ({j.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div>
              <Label>Cover letter (optional)</Label>
              <Textarea value={addAppForm.coverLetter} onChange={(e) => setAddAppForm((f) => ({ ...f, coverLetter: e.target.value }))} placeholder="Optional" rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAppDialog(false)}>Cancel</Button>
            <Button
              disabled={!addAppForm.candidateId || !addAppForm.jobId || createApplicationMutation.isPending || candidatesList.length === 0 || jobs.filter((j) => j.status === "published" || j.status === "paused").length === 0}
              onClick={() => {
                if (!addAppForm.candidateId || !addAppForm.jobId) return;
                createApplicationMutation.mutate({ candidateId: addAppForm.candidateId, jobId: addAppForm.jobId, coverLetter: addAppForm.coverLetter || undefined });
              }}
            >
              {createApplicationMutation.isPending ? "Adding…" : "Add application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addCandidateDialog} onOpenChange={(o) => {
        setAddCandidateDialog(o);
        if (!o) setAddCandidateForm({
          firstName: "", lastName: "", email: "", phone: "",
          personalEmail: "", dateOfBirth: "", gender: "", maritalStatus: "", bloodGroup: "",
          street: "", city: "", state: "", zipCode: "", country: "",
          currentCompany: "", currentTitle: "", experienceYears: "", resumeUrl: "", resumeFilename: "", source: "manual", notes: "",
        });
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
            <DialogTitle>Add candidate</DialogTitle>
            <DialogDescription>Add someone who applied via email, referral, or elsewhere. Personal details and address will prefill employee profile when hired.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="flex-1 min-h-0 flex flex-col px-6 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 mb-3 flex-shrink-0">
              <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
              <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
              <TabsTrigger value="address" className="text-xs">Address</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <TabsContent value="basic" className="mt-0 space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First name *</Label>
                    <Input value={addCandidateForm.firstName} onChange={(e) => setAddCandidateForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="mt-1" />
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input value={addCandidateForm.lastName} onChange={(e) => setAddCandidateForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={addCandidateForm.email} onChange={(e) => setAddCandidateForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={addCandidateForm.phone} onChange={(e) => setAddCandidateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Current company</Label>
                    <Input value={addCandidateForm.currentCompany} onChange={(e) => setAddCandidateForm((f) => ({ ...f, currentCompany: e.target.value }))} placeholder="Optional" className="mt-1" />
                  </div>
                  <div>
                    <Label>Current title</Label>
                    <Input value={addCandidateForm.currentTitle} onChange={(e) => setAddCandidateForm((f) => ({ ...f, currentTitle: e.target.value }))} placeholder="Optional" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Experience (years)</Label>
                  <Input type="number" min={0} value={addCandidateForm.experienceYears} onChange={(e) => setAddCandidateForm((f) => ({ ...f, experienceYears: e.target.value }))} placeholder="e.g. 5" className="mt-1" />
                </div>
                <div>
                  <Label>Resume</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">Upload the resume file (e.g. from email) or paste a link. Optional.</p>
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center hover:border-primary/40 transition-colors">
                    {addCandidateForm.resumeFilename || (addCandidateForm.resumeUrl && addCandidateForm.resumeUrl.startsWith("http")) ? (
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">
                          {addCandidateForm.resumeFilename || "Link added"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setAddCandidateForm((f) => ({ ...f, resumeUrl: "", resumeFilename: "" }))}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm text-muted-foreground">Click to upload PDF (max 5MB)</p>
                        <input
                          ref={addCandidateResumeInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error("File must be under 5MB");
                              e.target.value = "";
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                              setAddCandidateForm((f) => ({ ...f, resumeUrl: reader.result as string, resumeFilename: file.name }));
                            };
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Or paste link</Label>
                    <Input
                      value={addCandidateForm.resumeUrl?.startsWith("http") ? addCandidateForm.resumeUrl : ""}
                      onChange={(e) => setAddCandidateForm((f) => ({ ...f, resumeUrl: e.target.value.trim(), resumeFilename: "" }))}
                      placeholder="https://..."
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={addCandidateForm.source} onValueChange={(v) => setAddCandidateForm((f) => ({ ...f, source: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="career_page">Career site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={addCandidateForm.notes} onChange={(e) => setAddCandidateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes" rows={2} className="mt-1" />
                </div>
              </TabsContent>
              <TabsContent value="personal" className="mt-0 space-y-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">Prefills employee profile when hired.</p>
                <div>
                  <Label>Personal email</Label>
                  <Input type="email" value={addCandidateForm.personalEmail} onChange={(e) => setAddCandidateForm((f) => ({ ...f, personalEmail: e.target.value }))} placeholder="Different from main email" className="mt-1" />
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={addCandidateForm.dateOfBirth} onChange={(e) => setAddCandidateForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={addCandidateForm.gender || "_"} onValueChange={(v) => setAddCandidateForm((f) => ({ ...f, gender: v === "_" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Marital status</Label>
                  <Select value={addCandidateForm.maritalStatus || "_"} onValueChange={(v) => setAddCandidateForm((f) => ({ ...f, maritalStatus: v === "_" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Blood group</Label>
                  <Select value={addCandidateForm.bloodGroup || "_"} onValueChange={(v) => setAddCandidateForm((f) => ({ ...f, bloodGroup: v === "_" ? "" : v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="address" className="mt-0 space-y-4 pb-4">
                <p className="text-xs text-muted-foreground mb-2">Home address; prefills employee profile when hired.</p>
                <div>
                  <Label>Street</Label>
                  <Input value={addCandidateForm.street} onChange={(e) => setAddCandidateForm((f) => ({ ...f, street: e.target.value }))} placeholder="Street address" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input value={addCandidateForm.city} onChange={(e) => setAddCandidateForm((f) => ({ ...f, city: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={addCandidateForm.state} onChange={(e) => setAddCandidateForm((f) => ({ ...f, state: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Zip code</Label>
                    <Input value={addCandidateForm.zipCode} onChange={(e) => setAddCandidateForm((f) => ({ ...f, zipCode: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={addCandidateForm.country} onChange={(e) => setAddCandidateForm((f) => ({ ...f, country: e.target.value }))} className="mt-1" />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setAddCandidateDialog(false)}>Cancel</Button>
            <Button
              disabled={!addCandidateForm.firstName.trim() || !addCandidateForm.lastName.trim() || !addCandidateForm.email.trim() || createCandidateMutation.isPending}
              onClick={() => {
                const exp = addCandidateForm.experienceYears.trim() ? parseInt(addCandidateForm.experienceYears, 10) : undefined;
                if (Number.isNaN(exp) && addCandidateForm.experienceYears.trim()) return;
                createCandidateMutation.mutate({
                  firstName: addCandidateForm.firstName.trim(),
                  lastName: addCandidateForm.lastName.trim(),
                  email: addCandidateForm.email.trim(),
                  phone: addCandidateForm.phone.trim() || undefined,
                  personalEmail: addCandidateForm.personalEmail.trim() || undefined,
                  dateOfBirth: addCandidateForm.dateOfBirth || undefined,
                  gender: addCandidateForm.gender || undefined,
                  maritalStatus: addCandidateForm.maritalStatus || undefined,
                  bloodGroup: addCandidateForm.bloodGroup || undefined,
                  street: addCandidateForm.street.trim() || undefined,
                  city: addCandidateForm.city.trim() || undefined,
                  state: addCandidateForm.state.trim() || undefined,
                  zipCode: addCandidateForm.zipCode.trim() || undefined,
                  country: addCandidateForm.country.trim() || undefined,
                  currentCompany: addCandidateForm.currentCompany.trim() || undefined,
                  currentTitle: addCandidateForm.currentTitle.trim() || undefined,
                  experienceYears: exp,
                  resumeUrl: (addCandidateForm.resumeUrl?.startsWith("data:") ? addCandidateForm.resumeUrl : addCandidateForm.resumeUrl?.trim()) || undefined,
                  resumeFilename: addCandidateForm.resumeFilename.trim() || undefined,
                  source: addCandidateForm.source || "manual",
                  notes: addCandidateForm.notes.trim() || undefined,
                });
              }}
            >
              {createCandidateMutation.isPending ? "Adding…" : "Add candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
