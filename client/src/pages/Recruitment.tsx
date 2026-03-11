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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, Briefcase, MapPin, Clock, Users, FileText, Eye, Download, Trash2, Pencil,
  ArrowRight, Send, CheckCircle, XCircle, UserPlus, BarChart3, Building2,
  Share2, Linkedin, ExternalLink, Copy, Shield, Upload, AlertTriangle, Ban,
  Link2, MailCheck, RefreshCw, Sparkles, FileEdit, LayoutGrid, List, GripVertical, X, CloudDownload,
  Mail, Phone, Paperclip, Star,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeJobHtml, isHtmlContent } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { EmployeeSelect, EmployeeMultiSelect } from "@/components/EmployeeSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

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
  current_title?: string | null;
  experience_years: number | null;
  expected_salary: string | null;
  resume_url: string | null;
  resume_filename?: string | null;
  has_resume?: boolean;
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
  /** From candidate: source (e.g. freshteam, career_page). */
  source?: string | null;
  /** From candidate: tags + skills merged (JSON array). Shown as skills in pipeline. */
  tags?: string[] | null;
  /** From candidate: city, country etc. for pipeline card. */
  location?: string | null;
  /** HR rating 1–5 for fit; null = not rated. */
  rating?: number | null;
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
  has_resume?: boolean;
  resume_filename?: string | null;
  tags?: string[] | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
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

function ApplicationRatingStars({
  applicationId,
  rating,
  onRate,
  disabled,
  size = "sm",
}: {
  applicationId: string;
  rating: number | null | undefined;
  onRate: (rating: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const value = rating != null && rating >= 1 && rating <= 5 ? rating : 0;
  const starClass = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onRate(value === n ? null : n)}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-50 disabled:pointer-events-none text-amber-500 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={`Rate ${n} out of 5`}
          title={`${value === n ? "Clear rating" : `Rate ${n}`}`}
        >
          <Star
            className={`${starClass} ${n <= value ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
      {value > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRate(null)}
          className="ml-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Clear
        </button>
      )}
    </span>
  );
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
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  application: AppRow | null;
  employees: { id: string; first_name: string; last_name: string; department?: string; employee_id?: string; work_email?: string }[];
  onSuccess?: (updatedApp: AppRow) => void;
}) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState(application?.stage || "applied");
  const [notes, setNotes] = useState("");
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!application) return;
    setStage(application.stage || "applied");
    setNotes("");
    setRejectReason("");
    setSelectedInterviewerIds([]);
    setScheduledDate("");
    setScheduledTime("");
    setInterviewType("");
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const interviewerNames = selectedInterviewerIds
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `${e!.first_name} ${e!.last_name}`)
    .join(", ");

  const updateApplicationsCache = (updatedApp: AppRow) => {
    queryClient.setQueriesData(
      { queryKey: ["/api/recruitment/applications"] },
      (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((a: AppRow) => (a.id === updatedApp.id ? { ...a, ...updatedApp } : a));
        if (typeof old === "object" && old !== null && "applications" in old && Array.isArray((old as { applications: AppRow[] }).applications)) {
          const data = old as { applications: AppRow[]; total: number };
          return { ...data, applications: data.applications.map((a) => (a.id === updatedApp.id ? { ...a, ...updatedApp } : a)) };
        }
        return old;
      }
    );
  };

  const handleSave = async () => {
    if (!application) return;
    // When moving to interview with date/time: build scheduledAt ISO string
    let scheduledAt: string | null = null;
    if ((stage === "interview" || stage === "screening") && scheduledDate && scheduledTime) {
      const combined = `${scheduledDate}T${scheduledTime}:00`;
      const d = new Date(combined);
      if (!Number.isNaN(d.getTime())) scheduledAt = d.toISOString();
    }
    setLoading(true);
    onClose();
    try {
      const res = await apiRequest("PATCH", `/api/recruitment/applications/${application.id}/stage`, {
        stage,
        notes: notes || null,
        interviewerNames: interviewerNames || null,
        interviewerIds: selectedInterviewerIds.length > 0 ? selectedInterviewerIds : null,
        scheduledAt,
        interviewType: (stage === "interview" || stage === "screening") && interviewType ? interviewType : null,
        rejectReason: stage === "rejected" ? rejectReason : null,
      });
      const updatedApp = (await res.json()) as AppRow;
      updateApplicationsCache(updatedApp);
      onSuccess?.(updatedApp);
      const label = STAGES.find((s) => s.id === stage)?.label || stage;
      toast.success(scheduledAt && stage === "interview" ? `Interview scheduled & ${label}` : `Moved to ${label}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stage");
    } finally {
      setLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      if (application?.id) queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications", application.id, "history"] });
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
            <>
              <div className="space-y-2">
                <Label>Interviewer(s) *</Label>
                <EmployeeMultiSelect
                  value={selectedInterviewerIds}
                  onChange={setSelectedInterviewerIds}
                  employees={employees as any}
                  placeholder="Select employees..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Interview type</Label>
                <Select value={interviewType || "_"} onValueChange={(v) => setInterviewType(v === "_" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Screening">Screening</SelectItem>
                    <SelectItem value="Panel">Panel</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
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

  useEffect(() => {
    if (open) {
      setForm({
        salary: "",
        salaryCurrency: "AED",
        jobTitle: application?.job_title || "",
        department: application?.job_department || "",
        startDate: "",
        employmentType: "full_time",
        terms: "",
        status: "draft",
      });
    }
  }, [open, application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [successPortalUrl, setSuccessPortalUrl] = useState<string | null>(null);

  const handleInitiate = async () => {
    if (!application) return;
    setLoading(true);
    setSuccessPortalUrl(null);
    try {
      const res = await apiRequest("POST", "/api/tentative/initiate", {
        applicationId: application.id,
        isFirstJob,
      });
      const raw = await res.json();
      const payload = raw?.data ?? raw;
      const portalPath = payload?.portalUrl ?? payload?.portal_url;
      const fullUrl = portalPath && !String(portalPath).includes("undefined")
        ? `${window.location.origin}${portalPath}`
        : null;
      setSuccessPortalUrl(fullUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      if (application.job_id) queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs", application.job_id] });
      if (fullUrl) {
        navigator.clipboard.writeText(fullUrl);
        toast.success("Tentative initiated — link copied to clipboard");
      } else {
        toast.success("Tentative initiated. Open this candidate and click \"Review Docs\" to copy the portal link.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate tentative");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccessPortalUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-yellow-600" /> Initiate Tentative Hiring</DialogTitle>
          <DialogDescription>
            {application ? `${application.first_name} ${application.last_name} — Start document verification before final hire.` : ""}
          </DialogDescription>
        </DialogHeader>

        {application?.tentative_status ? (
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Tentative has already been initiated for this candidate. Use <strong>Review Docs</strong> to manage documents and copy the portal link.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : successPortalUrl ? (
          <div className="space-y-4 py-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-sm text-green-800 dark:text-green-200 mb-2">Document checklist created</h4>
              <p className="text-xs text-green-700 dark:text-green-300 mb-3">Send this link to the candidate so they can upload documents (no login required):</p>
              <div className="flex flex-col gap-3">
                <Input
                  readOnly
                  value={successPortalUrl}
                  className="text-xs"
                />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(successPortalUrl);
                    toast.success("Portal link copied to clipboard");
                  }}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Copy portal link
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
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
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleInitiate} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                <Shield className="h-4 w-4 mr-2" /> {loading ? "Initiating..." : "Start Tentative"}
              </Button>
            </DialogFooter>
          </>
        )}
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
      const raw = await r.json();
      return raw?.data ?? raw;
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
              {(tentative?.portal_token ?? (tentative as any)?.portalToken) && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs p-0 h-auto ml-2"
                  onClick={() => {
                    const token = tentative.portal_token ?? (tentative as any)?.portalToken;
                    navigator.clipboard.writeText(`${window.location.origin}/tentative-portal/${token}`);
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

                    {/* View / Download uploaded file */}
                    {["uploaded", "verified", "rejected"].includes(doc.status) && (
                      <div className="mt-2 flex items-center gap-3">
                        <a
                          href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/tentative/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> View
                        </a>
                        <a
                          href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/tentative/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={(doc.file_name || doc.document_type || "document").replace(/\s+/g, "-")}
                          className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> Download
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
                  {isHtmlContent(jobDetail.description) ? (
                    <div
                      className="text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0"
                      dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(jobDetail.description) }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobDetail.description}</p>
                  )}
                </div>
              )}
              {jobDetail?.requirements && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Requirements</h4>
                  {isHtmlContent(jobDetail.requirements) ? (
                    <div
                      className="text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0"
                      dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(jobDetail.requirements) }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{jobDetail.requirements}</p>
                  )}
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
              {(app.resume_url || app.has_resume) && (
                            <span className="flex items-center gap-1.5">
                              <a href={app.resume_url || `/api/recruitment/candidates/${app.candidate_id}/resume`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => { e.preventDefault(); window.open(app.resume_url || `/api/recruitment/candidates/${app.candidate_id}/resume`, "_blank", "noopener,noreferrer"); }}><FileText className="h-3.5 w-3.5" /> View</a>
                            </span>
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
  onDeleteApplication,
  onApplicationUpdated,
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
  onDeleteApplication?: () => void;
  onApplicationUpdated?: (updated: AppRow) => void;
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
              <AvatarFallback>{app.first_name?.[0] ?? ""}{app.last_name?.[0] ?? ""}</AvatarFallback>
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
            <div className="pt-1">
              <p className="text-muted-foreground mb-0.5">Rating</p>
              <ApplicationRatingStars
                applicationId={app.id}
                rating={app.rating}
                onRate={async (newRating) => {
                  try {
                    await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/rating`, { rating: newRating });
                    onApplicationUpdated?.({ ...app, rating: newRating });
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                    if (app.job_id) queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs", app.job_id] });
                    toast.success(newRating != null ? `Rated ${newRating} star${newRating === 1 ? "" : "s"}` : "Rating cleared");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed to update rating");
                  }
                }}
              />
            </div>
          </div>
          {(app.resume_url || app.has_resume) && (
            <span className="flex items-center gap-2">
              <a href={app.resume_url || `/api/recruitment/candidates/${app.candidate_id}/resume`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => { e.preventDefault(); window.open(app.resume_url || `/api/recruitment/candidates/${app.candidate_id}/resume`, "_blank", "noopener,noreferrer"); }}><FileText className="h-3.5 w-3.5" /> View CV</a>
            </span>
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
                    const res = await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/stage`, { stage: "verbally_accepted" });
                    const updatedApp = await res.json() as AppRow;
                    toast.success("Marked as verbally accepted");
                    onApplicationUpdated?.(updatedApp);
                  } catch { toast.error("Failed"); }
                }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Verbal Acceptance</Button>
              )}
              {app.stage === "verbally_accepted" && !app.tentative_status && (
                <Button variant="outline" size="sm" className="text-xs text-yellow-600" onClick={() => setTentativeInitDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Initiate Tentative</Button>
              )}
              {app.stage === "offer" && app.offer_id && (app.offer_status === "draft" || app.offer_status === "sent") && app.offer_approval_status !== "rejected" && (
                <>
                  <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={async () => {
                    try {
                      await apiRequest("PATCH", "/api/recruitment/offers/" + app.offer_id + "/approve");
                      toast.success("Offer approved");
                      onApplicationUpdated?.({ ...app, offer_approval_status: "approved" });
                    } catch { toast.error("Failed"); }
                  }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                  <Button variant="outline" size="sm" className="text-xs text-red-500" onClick={async () => {
                    try {
                      await apiRequest("PATCH", "/api/recruitment/offers/" + app.offer_id + "/reject");
                      toast.success("Rejected");
                      onApplicationUpdated?.({ ...app, offer_approval_status: "rejected" });
                    } catch { toast.error("Failed"); }
                  }}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                </>
              )}
              {app.stage === "offer" && app.offer_id && app.offer_approval_status === "approved" && (
                <>
                  {app.offer_letter_url ? (
                    <span className="inline-flex items-center gap-2">
                      <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/recruitment/offers/${app.offer_id}/letter`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 text-xs px-3 rounded-md border bg-muted/50 hover:bg-muted"><FileText className="h-3.5 w-3.5 mr-1" /> View letter</a>
                      <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/recruitment/offers/${app.offer_id}/letter`} target="_blank" rel="noopener noreferrer" download={app.offer_letter_filename || "offer-letter.pdf"} className="inline-flex items-center h-8 text-xs px-3 rounded-md border border-border hover:bg-muted/50 text-muted-foreground">Download</a>
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" className="text-xs text-amber-700" onClick={() => setUploadLetterOfferId(app.offer_id!)}><Upload className="h-3.5 w-3.5 mr-1" /> Upload letter (PDF)</Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs text-blue-600" onClick={async () => {
                    try { const res = await apiRequest("GET", "/api/recruitment/offers/" + app.offer_id + "/link"); const data = await res.json(); await navigator.clipboard.writeText(data.url); toast.success("Link copied"); } catch { toast.error("Failed"); }
                  }}><Link2 className="h-3.5 w-3.5 mr-1" /> Copy link</Button>
                  <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={() => setHireDialog({ open: true, app })}><UserPlus className="h-3.5 w-3.5 mr-1" /> Direct hire</Button>
                </>
              )}
              {app.stage === "offer" && !app.offer_id && (
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })} disabled={!!(app.tentative_status && app.tentative_status !== "cleared")}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>
              )}
              {app.stage === "tentative" && app.tentative_status === "cleared" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>}
              {app.stage === "tentative" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setTentativeReviewDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Review Docs</Button>}
              {onDeleteApplication && (
                <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDeleteApplication}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove from pipeline
                </Button>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ==================== JOB APPLICANT PIPELINE VIEW (full-screen: sidebar + tabs) ====================

function JobApplicantPipelineView({
  app,
  jobTitle,
  onBack,
  setStageDialog,
  setHireDialog,
  setOfferDialog,
  setTentativeInitDialog,
  setTentativeReviewDialog,
  setUploadLetterOfferId,
  queryClient,
  onDeleteApplication,
  onApplicationUpdated,
}: {
  app: AppRow;
  jobTitle: string;
  onBack: () => void;
  setStageDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setHireDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setOfferDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setTentativeInitDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setTentativeReviewDialog: (v: { open: boolean; app: AppRow | null }) => void;
  setUploadLetterOfferId: (id: string | null) => void;
  queryClient: ReturnType<typeof useQueryClient>;
  onDeleteApplication: () => void;
  onApplicationUpdated?: (updated: AppRow) => void;
}) {
  const [detailTab, setDetailTab] = useState<"summary" | "profile" | "timeline" | "emails" | "comments" | "interviews" | "tasks">("summary");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const emailFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedThreadEmail, setSelectedThreadEmail] = useState<{
    id: string;
    direction: string;
    from_email: string;
    to_email: string;
    subject: string;
    body_plain: string | null;
    body_html: string | null;
    sent_at: string | null;
    received_at: string | null;
    created_at: string;
  } | null>(null);
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENTS_BYTES = 8 * 1024 * 1024;
  const stageLabel = STAGES.find((s) => s.id === app.stage)?.label || app.stage;
  const currentStageIndex = STAGES.findIndex((s) => s.id === app.stage);
  const { data: candidateProfile, isLoading: profileLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/recruitment/candidates", app.candidate_id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recruitment/candidates/${app.candidate_id}`);
      return res.json();
    },
    enabled: detailTab === "summary" || detailTab === "profile",
  });
  type StageHistoryEntry = {
    id?: string;
    from_stage: string | null;
    to_stage: string;
    notes: string | null;
    created_at: string;
    moved_by_email?: string;
    scheduled_at?: string | null;
    meeting_link?: string | null;
    interviewer_names?: string | null;
    interviewer_ids?: string[] | null;
    interview_type?: string | null;
  };
  const { data: history = [], isLoading: historyLoading } = useQuery<StageHistoryEntry[]>({
    queryKey: ["/api/recruitment/applications", app.id, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/recruitment/applications/${app.id}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: detailTab === "timeline" || detailTab === "interviews",
  });
  const scheduledInterviews = (history as StageHistoryEntry[]).filter(
    (h) => (h.to_stage === "interview" || h.to_stage === "screening") && (h.scheduled_at != null || h.meeting_link != null)
  );

  const { data: emails = [], isLoading: emailsLoading } = useQuery<{ id: string; direction: string; from_email: string; to_email: string; subject: string; body_plain: string | null; body_html: string | null; sent_at: string | null; received_at: string | null; created_at: string }[]>({
    queryKey: ["/api/recruitment/applications", app.id, "emails"],
    queryFn: async () => {
      const res = await fetch(`/api/recruitment/applications/${app.id}/emails`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load emails");
      return res.json();
    },
    enabled: detailTab === "emails",
    refetchInterval: detailTab === "emails" ? 15_000 : false,
    refetchOnWindowFocus: true,
  });
  const sendEmailMutation = useMutation({
    mutationFn: async (payload: { to?: string; subject: string; body: string; attachments?: Array<{ filename: string; content: string }> }) => {
      const res = await apiRequest("POST", `/api/recruitment/applications/${app.id}/emails`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications", app.id, "emails"] });
    },
  });
  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const res = await apiRequest("DELETE", `/api/recruitment/applications/${app.id}/emails/${emailId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? err?.detail ?? "Failed to delete email");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications", app.id, "emails"] });
      setSelectedThreadEmail(null);
      toast.success("Email removed from thread");
    },
    onError: (e: Error) => toast.error(e?.message ?? "Failed to delete email"),
  });

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result as string;
        const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
        resolve(base64);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back</Button>
        <span className="text-sm text-muted-foreground truncate">Pipeline for this application</span>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-72 shrink-0 border-r bg-muted/20 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg">{app.first_name?.[0] ?? ""}{app.last_name?.[0] ?? ""}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <Link href={`/recruitment/candidates/${app.candidate_id}`} className="font-semibold hover:underline block truncate">{app.first_name} {app.last_name}</Link>
                <p className="text-xs text-muted-foreground truncate">{app.current_company ? `${app.current_title || "—"} @ ${app.current_company}` : (app.current_title || "—")}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 truncate"><MailCheck className="h-4 w-4 shrink-0" /><a href={`mailto:${app.candidate_email}`} className="text-primary hover:underline truncate">{app.candidate_email}</a></p>
              <p className="text-muted-foreground">Applied {app.applied_at ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true }) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">APPLICANTS · Inbound</p>
              <div className="flex flex-wrap gap-1">
                {STAGES.map((s, i) => (
                  <span
                    key={s.id}
                    className={`inline-flex h-6 w-6 rounded-full items-center justify-center text-[10px] font-medium ${i <= currentStageIndex ? s.color + " text-white" : "bg-muted text-muted-foreground"}`}
                    title={s.label}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Stage: {stageLabel}</p>
            </div>
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Rating</p>
              <ApplicationRatingStars
                applicationId={app.id}
                rating={app.rating}
                onRate={async (newRating) => {
                  try {
                    await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/rating`, { rating: newRating });
                    onApplicationUpdated?.({ ...app, rating: newRating });
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                    if (app.job_id) queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs", app.job_id] });
                    toast.success(newRating != null ? `Rated ${newRating} star${newRating === 1 ? "" : "s"}` : "Rating cleared");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Failed to update rating");
                  }
                }}
              />
            </div>
            <div className="text-xs">
              <p className="font-medium text-muted-foreground">Job</p>
              <p className="flex items-center gap-1 mt-0.5"><Briefcase className="h-3.5 w-3.5 shrink-0" /> {jobTitle}</p>
            </div>
            {(app.resume_url || app.has_resume) && (
              <a href={app.resume_url || `/api/recruitment/candidates/${app.candidate_id}/resume`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <FileText className="h-4 w-4" /> View CV
              </a>
            )}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Actions</p>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setStageDialog({ open: true, app })}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1" /> Advance
                </Button>
                {app.stage === "interview" && (
                  <Button variant="outline" size="sm" className="text-xs text-teal-600" onClick={async () => {
                    try {
                      const res = await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/stage`, { stage: "verbally_accepted" });
                      const updatedApp = await res.json() as AppRow;
                      toast.success("Marked as verbally accepted");
                      onApplicationUpdated?.(updatedApp);
                      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
                    } catch { toast.error("Failed"); }
                  }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Verbal acceptance</Button>
                )}
                {app.stage === "verbally_accepted" && !app.tentative_status && (
                  <Button variant="outline" size="sm" className="text-xs text-yellow-600" onClick={() => setTentativeInitDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Initiate Tentative</Button>
                )}
                {app.stage === "offer" && app.offer_id && (app.offer_status === "draft" || app.offer_status === "sent") && app.offer_approval_status !== "rejected" && (
                  <>
                    <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={async () => {
                      try {
                        await apiRequest("PATCH", "/api/recruitment/offers/" + app.offer_id + "/approve");
                        toast.success("Offer approved");
                        onApplicationUpdated?.({ ...app, offer_approval_status: "approved" });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/offers"] });
                      } catch { toast.error("Failed"); }
                    }}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                    <Button variant="outline" size="sm" className="text-xs text-red-500" onClick={async () => {
                      try {
                        await apiRequest("PATCH", "/api/recruitment/offers/" + app.offer_id + "/reject");
                        toast.success("Rejected");
                        onApplicationUpdated?.({ ...app, offer_approval_status: "rejected" });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/offers"] });
                      } catch { toast.error("Failed"); }
                    }}><XCircle className="h-3.5 w-3.5 mr-1" /> Reject</Button>
                  </>
                )}
                {app.stage === "offer" && app.offer_id && app.offer_approval_status === "approved" && (
                  <>
                    {app.offer_letter_url ? (
                      <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/api/recruitment/offers/${app.offer_id}/letter`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 text-xs px-3 rounded-md border bg-muted/50 hover:bg-muted">View letter</a>
                    ) : (
                      <Button variant="outline" size="sm" className="text-xs text-amber-700" onClick={() => setUploadLetterOfferId(app.offer_id!)}><Upload className="h-3.5 w-3.5 mr-1" /> Upload letter</Button>
                    )}
                    <Button variant="outline" size="sm" className="text-xs text-green-600" onClick={() => setHireDialog({ open: true, app })}><UserPlus className="h-3.5 w-3.5 mr-1" /> Hire</Button>
                  </>
                )}
                {app.stage === "offer" && !app.offer_id && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })} disabled={!!(app.tentative_status && app.tentative_status !== "cleared")}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>
                )}
                {app.stage === "tentative" && app.tentative_status === "cleared" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setOfferDialog({ open: true, app })}><Send className="h-3.5 w-3.5 mr-1" /> Create Offer</Button>}
                {app.stage === "tentative" && <Button variant="outline" size="sm" className="text-xs" onClick={() => setTentativeReviewDialog({ open: true, app })}><Shield className="h-3.5 w-3.5 mr-1" /> Review Docs</Button>}
                <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDeleteApplication}><Trash2 className="h-3.5 w-3.5 mr-1" /> Remove</Button>
              </div>
            </div>
          </div>
        </div>
        {/* Right: tabs */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as typeof detailTab)} className="flex-1 flex flex-col">
            <div className="flex border-b px-4 gap-1 shrink-0">
              {(["summary", "profile", "timeline", "emails", "comments", "interviews", "tasks"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${detailTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setDetailTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <ScrollArea className="flex-1 p-4">
              {detailTab === "summary" && (
                <div className="space-y-4">
                  {profileLoading ? (
                    <p className="text-sm text-muted-foreground">Loading summary…</p>
                  ) : candidateProfile ? (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Experience</h4>
                        <p className="text-sm text-muted-foreground">
                          {(candidateProfile.current_title as string) || "—"} {(candidateProfile.current_company as string) ? `at ${candidateProfile.current_company}` : ""}
                          {candidateProfile.experience_years != null ? ` · ${candidateProfile.experience_years} years experience` : ""}
                        </p>
                        {!!(candidateProfile.city || candidateProfile.state || candidateProfile.country) && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Location: {[candidateProfile.city, candidateProfile.state, candidateProfile.country].filter(Boolean).map(String).join(", ")}
                          </p>
                        )}
                        {candidateProfile.expected_salary != null && candidateProfile.expected_salary !== "" && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Expected salary: {candidateProfile.salary_currency ? `${candidateProfile.salary_currency} ` : ""}{Number(candidateProfile.expected_salary).toLocaleString()}
                          </p>
                        )}
                        {Array.isArray(candidateProfile.tags) && (candidateProfile.tags as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(candidateProfile.tags as string[]).slice(0, 10).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs font-normal">{tag}</Badge>
                            ))}
                            {(candidateProfile.tags as string[]).length > 10 && (
                              <Badge variant="outline" className="text-xs">+{(candidateProfile.tags as string[]).length - 10}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Resume</h4>
                        {(candidateProfile.resume_url || (candidateProfile as any).has_resume) ? (
                          <a href={(candidateProfile.resume_url as string) || `/api/recruitment/candidates/${app.candidate_id}/resume`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                            <FileText className="h-4 w-4" /> {(candidateProfile.resume_filename as string) || "View CV"}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground">No resume uploaded.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Feedback Snapshot</h4>
                        {candidateProfile.notes ? (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(candidateProfile.notes)}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">
                        <Link href={`/recruitment/candidates/${app.candidate_id}`} className="text-primary hover:underline">Open full profile</Link> for applications history and more.
                      </p>
                    </>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Experience</h4>
                        <p className="text-sm text-muted-foreground">
                          {app.current_title || "—"} {app.current_company ? `at ${app.current_company}` : ""}
                          {app.experience_years != null ? ` · ${app.experience_years} years experience` : ""}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Feedback Snapshot</h4>
                        <p className="text-sm text-muted-foreground">—</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              {detailTab === "profile" && (
                <div className="space-y-4">
                  {profileLoading ? (
                    <p className="text-sm text-muted-foreground">Loading profile…</p>
                  ) : candidateProfile ? (
                    <>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 shrink-0" /><a href={`mailto:${(candidateProfile.email as string) || ""}`} className="text-primary hover:underline">{(candidateProfile.email as string) || "—"}</a></span>
                        {!!candidateProfile.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 shrink-0" /> {String(candidateProfile.phone)}</span>}
                        {!!candidateProfile.linkedin_url && <a href={String(candidateProfile.linkedin_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline"><Linkedin className="h-4 w-4 shrink-0" /> LinkedIn</a>}
                      </div>
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Candidate info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {!!candidateProfile.current_title && <div className="flex justify-between py-1"><span className="text-muted-foreground">Current role</span><span className="font-medium">{String(candidateProfile.current_title)}{candidateProfile.current_company ? ` at ${String(candidateProfile.current_company)}` : ""}</span></div>}
                          {candidateProfile.experience_years != null && <div className="flex justify-between py-1"><span className="text-muted-foreground">Experience</span><span className="font-medium">{String(candidateProfile.experience_years)} years</span></div>}
                          {candidateProfile.expected_salary != null && candidateProfile.expected_salary !== "" && <div className="flex justify-between py-1"><span className="text-muted-foreground">Expected salary</span><span className="font-medium">{candidateProfile.salary_currency ? `${String(candidateProfile.salary_currency)} ` : ""}{Number(candidateProfile.expected_salary).toLocaleString()}</span></div>}
                          {!!(candidateProfile.city || candidateProfile.state || candidateProfile.country) && <div className="flex justify-between py-1"><span className="text-muted-foreground">Location</span><span className="font-medium">{[candidateProfile.city, candidateProfile.state, candidateProfile.country].filter(Boolean).map(String).join(", ")}</span></div>}
                          {!!candidateProfile.source && <div className="flex justify-between py-1"><span className="text-muted-foreground">Source</span><span className="font-medium capitalize">{String(candidateProfile.source).replace("_", " ")}</span></div>}
                          {!!candidateProfile.date_of_birth && <div className="flex justify-between py-1"><span className="text-muted-foreground">Date of birth</span><span className="font-medium">{formatDate(candidateProfile.date_of_birth as string)}</span></div>}
                          {!!candidateProfile.gender && <div className="flex justify-between py-1"><span className="text-muted-foreground">Gender</span><span className="font-medium capitalize">{String(candidateProfile.gender)}</span></div>}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Resume</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {(candidateProfile.resume_url || (candidateProfile as any).has_resume) ? (
                            <a href={(candidateProfile.resume_url as string) || `/api/recruitment/candidates/${app.candidate_id}/resume`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                              <FileText className="h-4 w-4" /> {(candidateProfile.resume_filename as string) || "View CV"}
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">No resume uploaded.</p>
                          )}
                        </CardContent>
                      </Card>
                      {candidateProfile.notes && (
                        <Card>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm">Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(candidateProfile.notes)}</p>
                          </CardContent>
                        </Card>
                      )}
                      <p className="text-xs text-muted-foreground pt-2">
                        <Link href={`/recruitment/candidates/${app.candidate_id}`} className="text-primary hover:underline">Open full profile page</Link> for applications history and more.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Could not load profile.</p>
                  )}
                </div>
              )}
              {detailTab === "timeline" && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Pipeline timeline</h4>
                  <p className="text-xs text-muted-foreground">All stage changes for this application, in order.</p>
                  {historyLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No history yet. Stage changes will appear here as the candidate moves through the pipeline.</p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((h, i) => {
                        const isInterviewStep = (h.to_stage === "interview" || h.to_stage === "screening") && (h.scheduled_at != null || h.meeting_link != null);
                        return (
                          <li key={h.id ?? `${h.created_at}-${i}`} className="text-sm">
                            <div className="flex gap-2 flex-wrap">
                              <span className="text-muted-foreground shrink-0">{new Date(h.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                              <span>
                                {h.from_stage ?? "—"} → <strong>{h.to_stage}</strong>
                                {h.notes ? ` · ${h.notes}` : ""}
                                {h.moved_by_email ? ` (${h.moved_by_email})` : ""}
                              </span>
                            </div>
                            {isInterviewStep && (
                              <div className="ml-0 mt-1 pl-0 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                                {h.scheduled_at && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {new Date(h.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                  </span>
                                )}
                                {h.interview_type && <span>Type: {h.interview_type}</span>}
                                {(h.interviewer_names || (Array.isArray(h.interviewer_ids) && h.interviewer_ids.length > 0)) && (
                                  <span>With: {h.interviewer_names || `${h.interviewer_ids?.length} interviewer(s)`}</span>
                                )}
                                {h.meeting_link && (
                                  <a href={h.meeting_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                    <ExternalLink className="h-3.5 w-3.5" /> Join meeting
                                  </a>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {detailTab === "emails" && (
                <div className="flex flex-col min-h-0">
                  {/* Single card: scrollable thread + fixed compose at bottom */}
                  <Card className="flex flex-col min-h-[480px]">
                    <CardHeader className="py-3 shrink-0">
                      <CardTitle className="text-sm">Conversation</CardTitle>
                      <CardDescription className="text-xs">With {app.candidate_email}</CardDescription>
                    </CardHeader>
                    {/* Scrollable thread */}
                    <div className="flex-1 min-h-0 px-6">
                      {emailsLoading ? (
                        <div className="py-4 text-sm text-muted-foreground">Loading…</div>
                      ) : emails.length === 0 ? (
                        <div className="py-4 text-sm text-muted-foreground text-center">No messages yet. Send one below or they will appear here when the candidate replies.</div>
                      ) : (
                        <ScrollArea className="h-[260px] w-full">
                          <div className="flex flex-col gap-2 pr-3 pb-2">
                            {[...emails].sort((a, b) => {
                              const ta = a.sent_at ?? a.received_at ?? a.created_at ?? "";
                              const tb = b.sent_at ?? b.received_at ?? b.created_at ?? "";
                              return new Date(ta).getTime() - new Date(tb).getTime();
                            }).map((e) => {
                              const isSent = e.direction === "sent";
                              return (
                                <div
                                  key={e.id}
                                  className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedThreadEmail(e)}
                                    className={`max-w-[85%] text-left rounded-2xl px-4 py-2.5 shadow-sm border transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                                      isSent
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-muted rounded-bl-md"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-xs opacity-90 mb-0.5">
                                      <span>{isSent ? "You" : e.from_email}</span>
                                      <span>
                                        {e.sent_at ? formatDistanceToNow(new Date(e.sent_at), { addSuffix: true }) : e.received_at ? formatDistanceToNow(new Date(e.received_at), { addSuffix: true }) : formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                                      </span>
                                    </div>
                                    {e.subject ? <p className="font-medium text-sm mb-0.5">{e.subject}</p> : null}
                                    <p className="text-sm whitespace-pre-wrap line-clamp-3 break-words">{e.body_plain || e.body_html?.replace(/<[^>]+>/g, "") || "—"}</p>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                    {/* Compose area — always visible at bottom of card */}
                    <div className="shrink-0 border-t bg-muted/30 px-6 py-4 rounded-b-lg space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Subject</Label>
                        <Input
                          placeholder="Subject"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Message</Label>
                        <Textarea
                          placeholder="Type your message…"
                          rows={3}
                          className="resize-none text-sm"
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={emailFileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          accept="*/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            e.target.value = "";
                            const current = emailAttachments;
                            const total = current.reduce((s, f) => s + f.size, 0);
                            const toAdd: File[] = [];
                            for (const f of files) {
                              if (current.length + toAdd.length >= MAX_ATTACHMENTS) break;
                              if (total + toAdd.reduce((s, x) => s + x.size, 0) + f.size > MAX_ATTACHMENTS_BYTES) {
                                toast.error("Attachments exceed 8MB total");
                                break;
                              }
                              toAdd.push(f);
                            }
                            setEmailAttachments((prev) => [...prev, ...toAdd]);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => emailFileInputRef.current?.click()}
                          disabled={emailAttachments.length >= MAX_ATTACHMENTS}
                        >
                          <Paperclip className="h-3.5 w-3 mr-1" />
                          Attach
                        </Button>
                        {emailAttachments.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs border">
                            <span className="max-w-[100px] truncate" title={f.name}>{f.name}</span>
                            <button type="button" aria-label="Remove" onClick={() => setEmailAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <span className="text-xs text-muted-foreground">max {MAX_ATTACHMENTS} files, 8MB</span>
                        <Button
                          size="sm"
                          disabled={sendEmailMutation.isPending}
                          className="ml-auto"
                          onClick={async () => {
                            const sub = emailSubject.trim();
                            if (!sub) { toast.error("Subject is required"); return; }
                            let attachments: Array<{ filename: string; content: string }> | undefined;
                            if (emailAttachments.length > 0) {
                              try {
                                attachments = await Promise.all(
                                  emailAttachments.map(async (f) => ({ filename: f.name, content: await readFileAsBase64(f) }))
                                );
                              } catch (e) {
                                toast.error("Failed to read attachments");
                                return;
                              }
                            }
                            sendEmailMutation.mutate(
                              { to: app.candidate_email, subject: sub, body: emailBody.trim(), attachments },
                              {
                                onSuccess: (data: { delivered?: boolean }) => {
                                  if (data?.delivered) {
                                    toast.success("Email sent");
                                  } else {
                                    toast.success("Email saved to thread (not sent — set RESEND_API_KEY in .env)");
                                  }
                                  setEmailSubject("");
                                  setEmailBody("");
                                  setEmailAttachments([]);
                                },
                                onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
                              }
                            );
                          }}
                        >
                          {sendEmailMutation.isPending ? "Sending…" : "Send"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                  <Dialog open={!!selectedThreadEmail} onOpenChange={(open) => !open && setSelectedThreadEmail(null)}>
                    <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="text-base">Email</DialogTitle>
                      </DialogHeader>
                      {selectedThreadEmail && (
                        <>
                          <ScrollArea className="flex-1 min-h-0 pr-4 -mx-1">
                            <div className="space-y-3 text-sm">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>{selectedThreadEmail.direction === "sent" ? "Sent" : "Received"}</span>
                                <span>
                                  {selectedThreadEmail.sent_at
                                    ? new Date(selectedThreadEmail.sent_at).toLocaleString()
                                    : selectedThreadEmail.received_at
                                      ? new Date(selectedThreadEmail.received_at).toLocaleString()
                                      : new Date(selectedThreadEmail.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p><span className="text-muted-foreground">From:</span> {selectedThreadEmail.from_email}</p>
                              <p><span className="text-muted-foreground">To:</span> {selectedThreadEmail.to_email}</p>
                              <p className="font-medium">{selectedThreadEmail.subject || "(No subject)"}</p>
                              <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm">
                                {selectedThreadEmail.body_plain || (selectedThreadEmail.body_html ? selectedThreadEmail.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "—")}
                              </div>
                            </div>
                          </ScrollArea>
                          <DialogFooter className="flex-row justify-between sm:justify-between border-t pt-4 mt-2">
                            <Button variant="destructive" size="sm" disabled={deleteEmailMutation.isPending} onClick={() => deleteEmailMutation.mutate(selectedThreadEmail.id)}>
                              {deleteEmailMutation.isPending ? "Deleting…" : "Delete from thread"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedThreadEmail(null)}>Close</Button>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              {detailTab === "interviews" && (
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : scheduledInterviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No scheduled interviews yet. When you move this candidate to Interview (or Screening) and set a date, time, and interviewer(s), the interview will appear here automatically.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {scheduledInterviews.map((h, idx) => (
                        <li key={h.id ?? `${h.created_at}-${idx}`}>
                          <Card>
                            <CardContent className="pt-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="font-medium flex items-center gap-2">
                                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    {h.scheduled_at
                                      ? (() => {
                                          const d = new Date(h.scheduled_at);
                                          return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                                        })()
                                      : "Scheduled (no date set)"}
                                  </p>
                                  {h.interview_type && (
                                    <p className="text-sm text-muted-foreground">Type: {h.interview_type}</p>
                                  )}
                                  {(h.interviewer_names || (Array.isArray(h.interviewer_ids) && h.interviewer_ids.length > 0)) && (
                                    <p className="text-sm text-muted-foreground">
                                      Interviewer(s): {h.interviewer_names || (Array.isArray(h.interviewer_ids) ? h.interviewer_ids.length + " selected" : "—")}
                                    </p>
                                  )}
                                  {h.notes && <p className="text-sm text-muted-foreground">{h.notes}</p>}
                                </div>
                                {h.meeting_link && (
                                  <a
                                    href={h.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
                                  >
                                    <ExternalLink className="h-4 w-4" /> Join meeting
                                  </a>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {(detailTab === "comments" || detailTab === "tasks") && (
                <p className="text-sm text-muted-foreground">Coming soon.</p>
              )}
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

function parseRecruitmentSearch(): { tab: string; job: string; applicant: string } {
  if (typeof window === "undefined") return { tab: "jobs", job: "", applicant: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    tab: params.get("tab") || "jobs",
    job: params.get("job") || "",
    applicant: params.get("applicant") || "",
  };
}

export default function Recruitment() {
  const queryClient = useQueryClient();
  const { effectiveRole } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("jobs");

  const updateApplicationsCache = (updatedApp: AppRow) => {
    queryClient.setQueriesData(
      { queryKey: ["/api/recruitment/applications"] },
      (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map((a: AppRow) => (a.id === updatedApp.id ? { ...a, ...updatedApp } : a));
        if (typeof old === "object" && old !== null && "applications" in old && Array.isArray((old as { applications: AppRow[] }).applications)) {
          const data = old as { applications: AppRow[]; total: number };
          return { ...data, applications: data.applications.map((a) => (a.id === updatedApp.id ? { ...a, ...updatedApp } : a)) };
        }
        return old;
      }
    );
  };
  const [viewingJob, setViewingJob] = useState<JobPosting | null>(null);
  const [selectedAppInJobView, setSelectedAppInJobView] = useState<AppRow | null>(null);
  const applicantIdFromUrlRef = useRef<string | null>(null);
  const hasInitializedFromUrlRef = useRef(false);
  const skipNextSyncToUrlRef = useRef(true);

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
  const [applicantsPage, setApplicantsPage] = useState(1);
  const APPLICANTS_PER_PAGE = 50;
  // When on Jobs tab: selectedJobId + viewingJob = job we're viewing applicants for; selectedAppInJobView = applicant we're viewing pipeline for
  const [addAppDialog, setAddAppDialog] = useState(false);
  const [addAppForm, setAddAppForm] = useState<{ candidateId: string; jobId: string; coverLetter: string }>({ candidateId: "", jobId: "", coverLetter: "" });
  const [addAppCandidateSearch, setAddAppCandidateSearch] = useState("");
  const [addAppSelectedCandidateLabel, setAddAppSelectedCandidateLabel] = useState("");
  const [addAppCandidateSearchDebounced, setAddAppCandidateSearchDebounced] = useState("");
  useEffect(() => {
    if (!addAppDialog) return;
    const t = setTimeout(() => setAddAppCandidateSearchDebounced(addAppCandidateSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [addAppDialog, addAppCandidateSearch]);
  const [uploadLetterOfferId, setUploadLetterOfferId] = useState<string | null>(null);
  const [uploadLetterFile, setUploadLetterFile] = useState<File | null>(null);
  const [addCandidateDialog, setAddCandidateDialog] = useState(false);
  const [selectedPipelineApp, setSelectedPipelineApp] = useState<AppRow | null>(null);
  const [fullDetailPanelOpen, setFullDetailPanelOpen] = useState(false);
  const [migrateJobsLoading, setMigrateJobsLoading] = useState(false);
  const [migrateCandidatesLoading, setMigrateCandidatesLoading] = useState(false);
  const [migratePhase2Loading, setMigratePhase2Loading] = useState(false);
  const [phase2ResumeAfter, setPhase2ResumeAfter] = useState("");
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
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandidateForm, setEditCandidateForm] = useState<{
    firstName: string; lastName: string; email: string; phone: string;
    currentCompany: string; currentTitle: string; experienceYears: string; source: string; notes: string;
  }>({ firstName: "", lastName: "", email: "", phone: "", currentCompany: "", currentTitle: "", experienceYears: "", source: "manual", notes: "" });

  const [jobFilters, setJobFilters] = useState<{
    status: string[];
    department: string[];
    location: string[];
    employmentType: string[];
  }>({
    status: [],
    department: [],
    location: [],
    employmentType: [],
  });
  const prevOfferStatusRef = useRef<Map<string, string>>(new Map());
  const offerLetterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadLetterOfferId) offerLetterInputRef.current?.click();
  }, [uploadLetterOfferId]);

  // Restore checkpoint from URL on mount (so refresh keeps job/applicant pipeline)
  useEffect(() => {
    if (hasInitializedFromUrlRef.current) return;
    hasInitializedFromUrlRef.current = true;
    const { tab, job, applicant } = parseRecruitmentSearch();
    if (tab && tab !== "jobs") setActiveTab(tab);
    if (job) setSelectedJobId(job);
    if (applicant) applicantIdFromUrlRef.current = applicant;
  }, []);

  // Sync state -> URL when user changes tab, job, or selected applicant (enables refresh checkpoint)
  useEffect(() => {
    if (skipNextSyncToUrlRef.current) {
      skipNextSyncToUrlRef.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (activeTab && activeTab !== "jobs") params.set("tab", activeTab);
    if (selectedJobId) params.set("job", selectedJobId);
    if (selectedAppInJobView?.id) params.set("applicant", selectedAppInJobView.id);
    const search = params.toString();
    setLocation(`/recruitment${search ? `?${search}` : ""}`);
  }, [activeTab, selectedJobId, selectedAppInJobView?.id, setLocation]);

  const jobsQueryParams = new URLSearchParams();
  if (jobFilters.status.length) jobsQueryParams.set("status", jobFilters.status.join(","));
  if (jobFilters.department.length) jobsQueryParams.set("department", jobFilters.department.join(","));
  if (jobFilters.location.length) jobsQueryParams.set("location", jobFilters.location.join(","));
  if (jobFilters.employmentType.length) jobsQueryParams.set("employmentType", jobFilters.employmentType.join(","));
  jobsQueryParams.set("limit", "500");
  jobsQueryParams.set("offset", "0");
  const jobsQueryString = jobsQueryParams.toString();

  const hasActiveFilters =
    jobFilters.status.length > 0 ||
    jobFilters.department.length > 0 ||
    jobFilters.location.length > 0 ||
    jobFilters.employmentType.length > 0;

  const { data: jobsData } = useQuery<{ jobs: JobPosting[]; total: number }>({
    queryKey: ["/api/recruitment/jobs", jobFilters.status.join(","), jobFilters.department.join(","), jobFilters.location.join(","), jobFilters.employmentType.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/recruitment/jobs?${jobsQueryString}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Jobs: ${res.status}`);
      const data = await res.json();
      if (data && typeof data.total === "number" && Array.isArray(data.jobs)) return data;
      return { jobs: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0 };
    },
    placeholderData: keepPreviousData,
  });
  const jobs = jobsData?.jobs ?? [];
  const { data: jobFilterOptions } = useQuery<{ departments: string[]; locations: string[]; employmentTypes: string[] }>({
    queryKey: ["/api/recruitment/jobs/filter-options"],
    enabled: activeTab === "jobs",
  });
  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<{ applications: AppRow[]; total: number } | AppRow[]>({
    queryKey: ["/api/recruitment/applications", selectedJobId || "", applicantsPage],
    queryFn: async ({ queryKey }) => {
      const [, jobId, page] = queryKey as [string, string, number];
      const params = new URLSearchParams();
      params.set("limit", jobId ? String(APPLICANTS_PER_PAGE) : "200");
      params.set("offset", jobId ? String((Number(page) - 1) * APPLICANTS_PER_PAGE) : "0");
      if (jobId) params.set("jobId", jobId);
      const res = await fetch(`/api/recruitment/applications?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Applications: ${res.status}`);
      const raw = await res.json();
      const data = raw?.data ?? raw;
      // Server returns { applications, total } when jobId is in the request; otherwise array
      if (data && typeof data === "object" && !Array.isArray(data) && "applications" in data) {
        const list = Array.isArray((data as any).applications) ? (data as any).applications : [];
        const total = Number((data as any).total);
        return { applications: list, total: Number.isFinite(total) ? total : list.length };
      }
      const list = Array.isArray(data) ? data : [];
      return { applications: list, total: list.length };
    },
    enabled: activeTab === "jobs" && !!selectedJobId,
    refetchInterval: 8000,
    staleTime: 4000,
    placeholderData: keepPreviousData,
  });
  const applications = Array.isArray(applicationsData) ? applicationsData : (applicationsData?.applications ?? []);
  const applicantsTotal = Array.isArray(applicationsData) ? applicationsData.length : (Number(applicationsData?.total) || 0);
  const applicantsTotalPages = Math.max(1, Math.ceil(applicantsTotal / APPLICANTS_PER_PAGE));

  // When restored from URL (selectedJobId set), resolve viewingJob once jobs have loaded
  useEffect(() => {
    if (!selectedJobId || !jobs.length) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (job && (!viewingJob || viewingJob.id !== selectedJobId)) setViewingJob(job);
  }, [selectedJobId, jobs, viewingJob?.id]);

  // When restored from URL (applicant= in URL), resolve selectedAppInJobView once applications have loaded
  useEffect(() => {
    const applicantId = applicantIdFromUrlRef.current;
    if (!applicantId || !applications.length) return;
    const app = applications.find((a) => a.id === applicantId);
    if (app) {
      setSelectedAppInJobView(app);
      applicantIdFromUrlRef.current = null;
    }
  }, [applications]);

  useEffect(() => {
    setApplicantsPage(1);
  }, [selectedJobId]);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [candidatesPerPage, setCandidatesPerPage] = useState(50);
  useEffect(() => {
    setCandidatesPage(1);
  }, [searchTerm]);
  const candidatesSearch = searchTerm.trim();
  const { data: candidatesData } = useQuery<{ candidates: CandidateRow[]; total: number }>({
    queryKey: ["/api/recruitment/candidates", candidatesPage, candidatesPerPage, candidatesSearch],
    queryFn: async ({ queryKey }) => {
      const [, page, perPage, search] = queryKey as [string, number, number, string];
      const params = new URLSearchParams();
      params.set("limit", String(perPage));
      params.set("offset", String((Number(page) - 1) * Number(perPage)));
      if (search) params.set("search", search);
      const res = await fetch(`/api/recruitment/candidates?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Candidates: ${res.status}`);
      const data = await res.json();
      if (data && typeof data.total === "number" && Array.isArray(data.candidates)) return data;
      return { candidates: Array.isArray(data) ? data : [], total: Array.isArray(data) ? data.length : 0 };
    },
    enabled: activeTab === "candidates",
    placeholderData: keepPreviousData,
  });
  const candidatesList = candidatesData?.candidates ?? [];
  const candidatesTotal = candidatesData?.total ?? 0;
  const candidatesTotalPages = Math.max(1, Math.ceil(candidatesTotal / candidatesPerPage));
  const { data: addAppCandidateSearchResult, isLoading: addAppCandidateSearchLoading } = useQuery<{ candidates: CandidateRow[]; total: number }>({
    queryKey: ["/api/recruitment/candidates", "addAppSearch", addAppCandidateSearchDebounced],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (addAppCandidateSearchDebounced) params.set("search", addAppCandidateSearchDebounced);
      const res = await fetch(`/api/recruitment/candidates?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Candidates: ${res.status}`);
      const data = await res.json();
      if (data && typeof data.total === "number" && Array.isArray(data.candidates)) return data;
      return { candidates: Array.isArray(data) ? data : [], total: 0 };
    },
    enabled: addAppDialog && addAppCandidateSearchDebounced.length >= 2,
    staleTime: 30000,
  });
  const addAppSearchCandidates = addAppCandidateSearchResult?.candidates ?? [];
  const addAppSearchTotal = addAppCandidateSearchResult?.total ?? 0;
  const { data: stats } = useQuery<any>({ queryKey: ["/api/recruitment/stats"] });
  // Only fetch employees when a dialog that needs them is open (Job = hiring managers, Stage = interviewers)
  const needsEmployees = jobDialog.open || stageDialog.open;
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: needsEmployees,
  });

  const { data: editingCandidateData } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/recruitment/candidates/detail", editingCandidateId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recruitment/candidates/${editingCandidateId}`);
      return res.json();
    },
    enabled: !!editingCandidateId,
  });
  useEffect(() => {
    if (editingCandidateData && editingCandidateId) {
      const d = editingCandidateData as any;
      setEditCandidateForm({
        firstName: d.first_name ?? "",
        lastName: d.last_name ?? "",
        email: d.email ?? "",
        phone: d.phone ?? "",
        currentCompany: d.current_company ?? "",
        currentTitle: d.current_title ?? "",
        experienceYears: d.experience_years != null ? String(d.experience_years) : "",
        source: d.source ?? "manual",
        notes: d.notes ?? "",
      });
    }
  }, [editingCandidateData, editingCandidateId]);

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

  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await apiRequest("PATCH", `/api/recruitment/candidates/${id}`, body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      setEditingCandidateId(null);
      toast.success("Candidate updated");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update candidate"),
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
    if (!confirm("Remove this application from the pipeline? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/recruitment/applications/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      toast.success("Application removed from pipeline");
    } catch { toast.error("Failed to remove"); }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm("Delete this candidate and all their applications? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/recruitment/candidates/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      toast.success("Candidate deleted");
    } catch { toast.error("Failed to delete candidate"); }
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
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-display font-bold text-foreground">Recruitment</h1>
            </div>
            <TabsList>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search candidates..." className="pl-9 h-9 rounded-xl border-border/80 bg-muted/30" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === "jobs" && (
              <>
                {effectiveRole === "admin" && (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={migrateJobsLoading}
                    onClick={async () => {
                      setMigrateJobsLoading(true);
                      try {
                        const res = await apiRequest("POST", "/api/recruitment/migrate-freshteam-jobs");
                        const data = await res.json();
                        if (data.error) {
                          toast.error(data.message || data.error);
                          return;
                        }
                        toast.success(
                          `Migrated: ${data.totalProcessed ?? 0} processed, ${data.created ?? 0} created, ${data.updated ?? 0} updated.`
                        );
                        if (data.errors?.length) toast.warning(`${data.errors.length} job(s) had errors.`);
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs/filter-options"] });
                      } catch (e: any) {
                        toast.error(e?.message || "Migration failed");
                      } finally {
                        setMigrateJobsLoading(false);
                      }
                    }}
                  >
                    {migrateJobsLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CloudDownload className="h-4 w-4 mr-2" />
                    )}
                    Migrate from FreshTeam
                  </Button>
                )}
                {effectiveRole === "admin" && (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={migratePhase2Loading}
                    onClick={async () => {
                      setMigratePhase2Loading(true);
                      toast.info("Syncing applicants from FreshTeam to current jobs…", { duration: 5000 });
                      try {
                        const res = await fetch("/api/recruitment/migrate-freshteam-candidates", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ phase2Only: true }),
                        });
                        if (!res.ok) {
                          const text = await res.text();
                          let errMsg = `${res.status}: ${text || res.statusText}`;
                          if (res.status === 409) errMsg = "A migration is already running. Wait for it to finish.";
                          throw new Error(errMsg);
                        }
                        const data = await res.json();
                        if (data.error) {
                          toast.error(data.message || data.error);
                          return;
                        }
                        toast.success(`Applicants synced: ${data.applicationsCreated ?? 0} application(s) linked to jobs.`);
                        if (data.errors?.length) toast.warning(`${data.errors.length} error(s) — check server console.`);
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
                      } catch (e: any) {
                        toast.error(e?.message || "Sync failed");
                      } finally {
                        setMigratePhase2Loading(false);
                      }
                    }}
                  >
                    {migratePhase2Loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Sync applicants to jobs
                  </Button>
                )}
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
              </>
            )}
          </div>
        </div>

        <TabsContent value="jobs" className="mt-0">
          <>
          {activeTab === "jobs" && selectedAppInJobView ? (
            <JobApplicantPipelineView
              app={selectedAppInJobView}
              jobTitle={viewingJob?.title ?? selectedAppInJobView.job_title}
              onBack={() => setSelectedAppInJobView(null)}
              setStageDialog={setStageDialog}
              setHireDialog={setHireDialog}
              setOfferDialog={setOfferDialog}
              setTentativeInitDialog={setTentativeInitDialog}
              setTentativeReviewDialog={setTentativeReviewDialog}
              setUploadLetterOfferId={setUploadLetterOfferId}
              queryClient={queryClient}
              onDeleteApplication={() => {
                handleDeleteApp(selectedAppInJobView.id);
                setSelectedAppInJobView(null);
              }}
              onApplicationUpdated={(updatedApp) => {
                updateApplicationsCache(updatedApp);
                setSelectedAppInJobView((prev) => (prev?.id === updatedApp.id ? { ...prev, ...updatedApp } : prev));
              }}
            />
          ) : activeTab === "jobs" && viewingJob && selectedJobId ? (
            /* View 2: Applicants list for the selected job */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setSelectedJobId(""); setViewingJob(null); }}>
                  <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back to jobs
                </Button>
                <h2 className="text-lg font-semibold truncate">Applicants for {viewingJob.title}</h2>
                <Button
                  variant="default"
                  size="sm"
                  className="shrink-0 ml-auto"
                  disabled={viewingJob.status !== "published" && viewingJob.status !== "paused"}
                  title={viewingJob.status !== "published" && viewingJob.status !== "paused" ? "Publish or pause this job to add applicants" : undefined}
                  onClick={() => {
                    if (viewingJob.status !== "published" && viewingJob.status !== "paused") return;
                    setAddAppForm((f) => ({ ...f, jobId: selectedJobId, candidateId: "", coverLetter: "" }));
                    setAddAppDialog(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" /> Add candidate
                </Button>
              </div>
              {(viewingJob.status !== "published" && viewingJob.status !== "paused") && (
                <p className="text-xs text-muted-foreground">Publish or pause this job to add applicants manually.</p>
              )}
              {applicationsLoading ? (
                <div className="flex items-center justify-center py-12"><Skeleton className="h-8 w-48" /></div>
              ) : applications.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No applicants yet for this job.</CardContent></Card>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/20 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead className="text-muted-foreground w-[120px]">Rating</TableHead>
                          <TableHead className="text-muted-foreground">Last activity</TableHead>
                          <TableHead className="w-[60px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app) => {
                          const stageInfo = STAGES.find((s) => s.id === app.stage);
                          const lastActivity = app.stage_updated_at ? formatDistanceToNow(new Date(app.stage_updated_at), { addSuffix: true }) : "—";
                          return (
                            <TableRow
                              key={app.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedAppInJobView(app)}
                              onKeyDown={(e) => e.key === "Enter" && setSelectedAppInJobView(app)}
                            >
                              <TableCell className="font-medium">{app.first_name} {app.last_name}</TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs ${stageInfo ? "bg-muted" : ""}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stageInfo?.color || "bg-gray-400"}`} />
                                  {stageInfo?.label || app.stage}
                                </span>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <ApplicationRatingStars
                                  applicationId={app.id}
                                  rating={app.rating}
                                  size="sm"
                                  onRate={async (newRating) => {
                                    try {
                                      await apiRequest("PATCH", `/api/recruitment/applications/${app.id}/rating`, { rating: newRating });
                                      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                                      if (app.job_id) queryClient.invalidateQueries({ queryKey: ["/api/recruitment/jobs", app.job_id] });
                                      setSelectedAppInJobView((prev) => prev?.id === app.id ? { ...prev, rating: newRating } : prev);
                                      toast.success(newRating != null ? `Rated ${newRating} star${newRating === 1 ? "" : "s"}` : "Rating cleared");
                                    } catch (e: any) {
                                      toast.error(e?.message ?? "Failed to update rating");
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">{lastActivity}</TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remove from pipeline"
                                  onClick={() => { handleDeleteApp(app.id); if (selectedAppInJobView?.id === app.id) setSelectedAppInJobView(null); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {applicantsTotal > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(applicantsPage - 1) * APPLICANTS_PER_PAGE + 1}–{Math.min(applicantsPage * APPLICANTS_PER_PAGE, applicantsTotal)} of {applicantsTotal} applicants
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={applicantsPage <= 1}
                          onClick={() => setApplicantsPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="px-3 text-sm text-muted-foreground">
                          Page {applicantsPage} of {applicantsTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={applicantsPage >= applicantsTotalPages}
                          onClick={() => setApplicantsPage((p) => Math.min(applicantsTotalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
          /* View 3: Job postings list */
          <div className="space-y-4">
            {/* Jobs filter bar – multi-select */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground shrink-0">Filters:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-[130px] justify-between font-normal">
                    {jobFilters.status.length === 0 ? "Status" : `Status (${jobFilters.status.length})`}
                    <span className="opacity-50">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  {["draft", "published", "paused", "closed", "archived"].map((s) => (
                    <label key={s} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                      <Checkbox
                        checked={jobFilters.status.includes(s)}
                        onCheckedChange={(checked) => {
                          setJobFilters((f) => ({
                            ...f,
                            status: checked ? [...f.status, s] : f.status.filter((x) => x !== s),
                          }));
                        }}
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-[160px] justify-between font-normal">
                    {jobFilters.department.length === 0 ? "Department" : `Department (${jobFilters.department.length})`}
                    <span className="opacity-50">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                  {(jobFilterOptions?.departments ?? []).map((d) => (
                    <label key={d} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                      <Checkbox
                        checked={jobFilters.department.includes(d)}
                        onCheckedChange={(checked) => {
                          setJobFilters((f) => ({
                            ...f,
                            department: checked ? [...f.department, d] : f.department.filter((x) => x !== d),
                          }));
                        }}
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-[160px] justify-between font-normal">
                    {jobFilters.location.length === 0 ? "Location" : `Location (${jobFilters.location.length})`}
                    <span className="opacity-50">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 max-h-64 overflow-auto p-2" align="start">
                  {(jobFilterOptions?.locations ?? []).map((loc) => (
                    <label key={loc} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                      <Checkbox
                        checked={jobFilters.location.includes(loc)}
                        onCheckedChange={(checked) => {
                          setJobFilters((f) => ({
                            ...f,
                            location: checked ? [...f.location, loc] : f.location.filter((x) => x !== loc),
                          }));
                        }}
                      />
                      <span>{loc}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-[140px] justify-between font-normal">
                    {jobFilters.employmentType.length === 0 ? "Employment" : `Employment (${jobFilters.employmentType.length})`}
                    <span className="opacity-50">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  {(jobFilterOptions?.employmentTypes ?? []).map((et) => (
                    <label key={et} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                      <Checkbox
                        checked={jobFilters.employmentType.includes(et)}
                        onCheckedChange={(checked) => {
                          setJobFilters((f) => ({
                            ...f,
                            employmentType: checked ? [...f.employmentType, et] : f.employmentType.filter((x) => x !== et),
                          }));
                        }}
                      />
                      <span>{(et || "").replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => setJobFilters({ status: [], department: [], location: [], employmentType: [] })}>
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
                    onClick={() => { setSelectedJobId(job.id); setViewingJob(job); }}
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
          )}
          </>
        </TabsContent>

        {/* ==================== CANDIDATES TAB ==================== */}
        <TabsContent value="candidates">
          <div className="mb-4 flex justify-end gap-2">
            {effectiveRole === "admin" && (
              <>
              <Button
                variant="outline"
                disabled={migrateCandidatesLoading || migratePhase2Loading}
                onClick={async () => {
                  setMigrateCandidatesLoading(true);
                  toast.info("Migration started. This can take 5–15+ minutes depending on candidate count. Check the server console for progress.", { duration: 8000 });
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000); // 15 min
                  try {
                    const res = await fetch("/api/recruitment/migrate-freshteam-candidates", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                      signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (!res.ok) {
                      const text = await res.text();
                      let errMsg = `${res.status}: ${text || res.statusText}`;
                      if (res.status === 409) errMsg = "A migration is already running. Wait for it to finish or check the server console.";
                      throw new Error(errMsg);
                    }
                    const data = await res.json();
                    if (data.error) {
                      toast.error(data.message || data.error);
                      return;
                    }
                    toast.success(
                      `Candidates: ${data.candidatesCreated ?? 0} created, ${data.candidatesUpdated ?? 0} updated. Applications: ${data.applicationsCreated ?? 0} created.`
                    );
                    if (data.errors?.length) toast.warning(`${data.errors.length} error(s) during migration.`);
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/candidates"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
                  } catch (e: any) {
                    clearTimeout(timeoutId);
                    if (e?.name === "AbortError") toast.error("Migration timed out after 15 minutes. Check server logs; migration may still be running.");
                    else toast.error(e?.message || "Migration failed");
                  } finally {
                    setMigrateCandidatesLoading(false);
                  }
                }}
              >
                {migrateCandidatesLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudDownload className="h-4 w-4 mr-2" />
                )}
                Migrate candidates from FreshTeam
              </Button>
              <Button
                variant="outline"
                disabled={migrateCandidatesLoading || migratePhase2Loading}
                onClick={async () => {
                  setMigratePhase2Loading(true);
                  const resumeN = phase2ResumeAfter.trim() && /^\d+$/.test(phase2ResumeAfter.trim()) ? parseInt(phase2ResumeAfter.trim(), 10) : 0;
                  toast.info(resumeN ? `Resuming Phase 2 from applicant ${resumeN + 1}. Check the server console.` : "Linking applicants to jobs (Phase 2 only). Check the server console for progress.", { duration: 6000 });
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);
                  try {
                    const res = await fetch("/api/recruitment/migrate-freshteam-candidates", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        phase2Only: true,
                        ...(phase2ResumeAfter.trim() && /^\d+$/.test(phase2ResumeAfter.trim())
                          ? { phase2ResumeAfterProcessed: parseInt(phase2ResumeAfter.trim(), 10) }
                          : {}),
                      }),
                      signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (!res.ok) {
                      const text = await res.text();
                      let errMsg = `${res.status}: ${text || res.statusText}`;
                      if (res.status === 409) errMsg = "A migration is already running. Wait for it to finish or check the server console.";
                      throw new Error(errMsg);
                    }
                    const data = await res.json();
                    if (data.error) {
                      toast.error(data.message || data.error);
                      return;
                    }
                    toast.success(`Applications: ${data.applicationsCreated ?? 0} created.`);
                    if (data.errors?.length) toast.warning(`${data.errors.length} error(s).`);
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
                  } catch (e: any) {
                    clearTimeout(timeoutId);
                    if (e?.name === "AbortError") toast.error("Phase 2 timed out. Check server logs.");
                    else toast.error(e?.message || "Phase 2 failed");
                  } finally {
                    setMigratePhase2Loading(false);
                  }
                }}
              >
                {migratePhase2Loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Link applicants (Phase 2 only)
              </Button>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <label htmlFor="phase2-resume-after">Resume after:</label>
                <input
                  id="phase2-resume-after"
                  type="number"
                  min={0}
                  placeholder="e.g. 5575"
                  className="w-24 rounded border border-input bg-background px-2 py-1 text-sm"
                  value={phase2ResumeAfter}
                  onChange={(e) => setPhase2ResumeAfter(e.target.value.replace(/\D/g, "").slice(0, 8))}
                />
                <span>applicants (optional)</span>
              </span>
              </>
            )}
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
                  <TableHead>Tags</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Applications</TableHead>
                  <TableHead>CV</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidatesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      No candidates yet. Use &quot;Add candidate&quot; above for email or other applicants, or they appear here when they apply via the career site.
                    </TableCell>
                  </TableRow>
                ) : (
                  candidatesList.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{c.first_name?.[0] ?? ""}{c.last_name?.[0] ?? ""}</AvatarFallback>
                            </Avatar>
                            <Link href={`/recruitment/candidates/${c.id}`} className="font-medium hover:underline">{c.first_name} {c.last_name}</Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.email}</TableCell>
                        <TableCell>{c.current_title || "-"}{c.current_company ? ` at ${c.current_company}` : ""}</TableCell>
                        <TableCell>{c.experience_years != null ? `${c.experience_years} years` : "-"}</TableCell>
                        <TableCell>{Array.isArray(c.tags) && c.tags.length > 0 ? c.tags.slice(0, 3).join(", ") : (c.tags ? String(c.tags) : "-")}</TableCell>
                        <TableCell>{[c.city, c.state, c.country].filter(Boolean).join(", ") || "-"}</TableCell>
                        <TableCell className="capitalize">{(c.source || "-").replace("_", " ")}</TableCell>
                        <TableCell className="text-center">{c.application_count}</TableCell>
                        <TableCell>
                          {c.resume_url || c.has_resume ? (
                            <span className="flex items-center gap-2">
                              <a href={c.resume_url || `/api/recruitment/candidates/${c.id}/resume`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm" onClick={(e) => { e.preventDefault(); window.open(c.resume_url || `/api/recruitment/candidates/${c.id}/resume`, "_blank", "noopener,noreferrer"); }}><FileText className="h-4 w-4" /> View</a>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCandidateId(c.id)} title="Edit candidate">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCandidate(c.id)} title="Delete candidate">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
          {candidatesTotal > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border mt-4">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(candidatesPage - 1) * candidatesPerPage + 1}–{Math.min(candidatesPage * candidatesPerPage, candidatesTotal)} of {candidatesTotal} candidates
                </p>
                <Select
                  value={String(candidatesPerPage)}
                  onValueChange={(v) => {
                    setCandidatesPerPage(Number(v));
                    setCandidatesPage(1);
                  }}
                >
                  <SelectTrigger className="w-[110px] h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                    <SelectItem value="200">200 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={candidatesPage <= 1}
                  onClick={() => setCandidatesPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-3 text-sm text-muted-foreground">
                  Page {candidatesPage} of {candidatesTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={candidatesPage >= candidatesTotalPages}
                  onClick={() => setCandidatesPage((p) => Math.min(candidatesTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
        onSuccess={(updatedApp) => {
          setSelectedAppInJobView((prev) => (prev?.id === updatedApp.id ? { ...prev, ...updatedApp } : prev));
        }}
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
      <Dialog open={addAppDialog} onOpenChange={(o) => {
        setAddAppDialog(o);
        if (!o) {
          setAddAppForm({ candidateId: "", jobId: "", coverLetter: "" });
          setAddAppCandidateSearch("");
          setAddAppSelectedCandidateLabel("");
          setAddAppCandidateSearchDebounced("");
        }
      }}>
        <DialogContent className="max-w-md w-full min-w-0">
          <DialogHeader>
            <DialogTitle>Add application</DialogTitle>
            <DialogDescription>Link a candidate to this job. They will appear in Applied.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1 min-w-0 overflow-hidden">
            {/* Candidate: search or selected */}
            <div className="space-y-2 min-w-0">
              <Label>Candidate</Label>
              {addAppForm.candidateId ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 min-w-0">
                  <span className="text-sm flex-1 min-w-0 truncate">{addAppSelectedCandidateLabel || "Selected"}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => { setAddAppForm((f) => ({ ...f, candidateId: "" })); setAddAppSelectedCandidateLabel(""); }}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search by name or email…"
                    value={addAppCandidateSearch}
                    onChange={(e) => setAddAppCandidateSearch(e.target.value)}
                    className="h-9 w-full min-w-0"
                    autoComplete="off"
                  />
                  {addAppCandidateSearchDebounced.length < 2 && (
                    <p className="text-xs text-muted-foreground">Enter at least 2 characters to search.</p>
                  )}
                  {addAppCandidateSearchDebounced.length >= 2 && addAppCandidateSearchLoading && (
                    <p className="text-xs text-muted-foreground">Searching…</p>
                  )}
                  {addAppCandidateSearchDebounced.length >= 2 && !addAppCandidateSearchLoading && (
                    <div className="rounded-lg border bg-muted/20 max-h-[200px] overflow-y-auto min-w-0">
                      {addAppSearchCandidates.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center px-3">No matches. Try a different search.</p>
                      ) : (
                        <div className="py-1">
                          {addAppSearchCandidates.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 focus:bg-muted/60 focus:outline-none rounded-none first:rounded-t-md last:rounded-b-md"
                              onClick={() => {
                                setAddAppForm((f) => ({ ...f, candidateId: c.id }));
                                setAddAppSelectedCandidateLabel(`${c.first_name} ${c.last_name} (${c.email})`);
                              }}
                            >
                              <span className="font-medium">{c.first_name} {c.last_name}</span>
                              <span className="text-muted-foreground"> · {c.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {addAppSearchCandidates.length > 0 && (
                        <p className="text-[11px] text-muted-foreground px-3 py-1.5 border-t bg-muted/30 rounded-b-lg">
                          {addAppSearchTotal > 50 ? `Showing 50 of ${addAppSearchTotal} — click to select` : `${addAppSearchTotal} match(es)`}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Job: compact when pre-selected, else dropdown */}
            {(() => {
              const applicableJobs = jobs.filter((j) => j.status === "published" || j.status === "paused");
              if (applicableJobs.length === 0) {
                return <p className="text-sm text-muted-foreground">No published or paused jobs. Publish a job in the Jobs tab first.</p>;
              }
              const preSelectedJob = applicableJobs.find((j) => j.id === addAppForm.jobId);
              if (preSelectedJob) {
                return (
                  <div className="space-y-2 min-w-0">
                    <Label>Job</Label>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 min-w-0">
                      <span className="text-sm flex-1 min-w-0 truncate">{preSelectedJob.title} {preSelectedJob.department ? `(${preSelectedJob.department})` : ""}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => setAddAppForm((f) => ({ ...f, jobId: "" }))}>
                        Change
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="space-y-2 min-w-0">
                  <Label>Job</Label>
                  <Select value={addAppForm.jobId} onValueChange={(v) => setAddAppForm((f) => ({ ...f, jobId: v }))}>
                    <SelectTrigger className="h-9 w-full min-w-0"><SelectValue placeholder="Select job" /></SelectTrigger>
                    <SelectContent>
                      {applicableJobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>{j.title} ({j.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div className="space-y-2 min-w-0">
              <Label className="text-muted-foreground font-normal">Cover letter (optional)</Label>
              <Textarea value={addAppForm.coverLetter} onChange={(e) => setAddAppForm((f) => ({ ...f, coverLetter: e.target.value }))} placeholder="Paste or type…" rows={2} className="resize-none min-h-[60px] w-full min-w-0" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setAddAppDialog(false)}>Cancel</Button>
            <Button
              disabled={!addAppForm.candidateId || !addAppForm.jobId || createApplicationMutation.isPending || jobs.filter((j) => j.status === "published" || j.status === "paused").length === 0}
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

      {/* Edit candidate dialog */}
      <Dialog open={!!editingCandidateId} onOpenChange={(open) => { if (!open) setEditingCandidateId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit candidate</DialogTitle>
            <DialogDescription>Update candidate details.</DialogDescription>
          </DialogHeader>
          {editingCandidateId && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const exp = editCandidateForm.experienceYears.trim();
                updateCandidateMutation.mutate({
                  id: editingCandidateId,
                  body: {
                    firstName: editCandidateForm.firstName.trim(),
                    lastName: editCandidateForm.lastName.trim(),
                    email: editCandidateForm.email.trim(),
                    phone: editCandidateForm.phone.trim() || undefined,
                    currentCompany: editCandidateForm.currentCompany.trim() || undefined,
                    currentTitle: editCandidateForm.currentTitle.trim() || undefined,
                    experienceYears: exp === "" ? undefined : parseInt(exp, 10),
                    source: editCandidateForm.source || "manual",
                    notes: editCandidateForm.notes.trim() || undefined,
                  },
                });
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First name</Label>
                  <Input value={editCandidateForm.firstName} onChange={(e) => setEditCandidateForm((f) => ({ ...f, firstName: e.target.value }))} className="mt-1" required />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={editCandidateForm.lastName} onChange={(e) => setEditCandidateForm((f) => ({ ...f, lastName: e.target.value }))} className="mt-1" required />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={editCandidateForm.email} onChange={(e) => setEditCandidateForm((f) => ({ ...f, email: e.target.value }))} className="mt-1" required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={editCandidateForm.phone} onChange={(e) => setEditCandidateForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Current company</Label>
                  <Input value={editCandidateForm.currentCompany} onChange={(e) => setEditCandidateForm((f) => ({ ...f, currentCompany: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Current title</Label>
                  <Input value={editCandidateForm.currentTitle} onChange={(e) => setEditCandidateForm((f) => ({ ...f, currentTitle: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Experience (years)</Label>
                  <Input type="number" min={0} value={editCandidateForm.experienceYears} onChange={(e) => setEditCandidateForm((f) => ({ ...f, experienceYears: e.target.value }))} className="mt-1" placeholder="e.g. 5" />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={editCandidateForm.source} onValueChange={(v) => setEditCandidateForm((f) => ({ ...f, source: v }))}>
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
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editCandidateForm.notes} onChange={(e) => setEditCandidateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes" rows={2} className="mt-1" />
              </div>
              <DialogFooter className="px-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingCandidateId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateCandidateMutation.isPending}>
                  {updateCandidateMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
