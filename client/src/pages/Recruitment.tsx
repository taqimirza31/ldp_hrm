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
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { EmployeeSelect, EmployeeMultiSelect } from "@/components/EmployeeSelect";

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
  { id: "offer", label: "Offer", color: "bg-emerald-500" },
  { id: "tentative", label: "Tentative", color: "bg-yellow-500" },
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
}: {
  open: boolean;
  onClose: () => void;
  job: JobPosting | null;
  employees: any[];
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
    setLoading(true);
    try {
      await apiRequest("PATCH", `/api/recruitment/applications/${application.id}/stage`, {
        stage,
        notes: notes || null,
        interviewerNames: interviewerNames || null,
        interviewerIds: selectedInterviewerIds.length > 0 ? selectedInterviewerIds : null,
        rejectReason: stage === "rejected" ? rejectReason : null,
      });
      toast.success(`Moved to ${STAGES.find((s) => s.id === stage)?.label || stage}`);
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruitment/stats"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update stage");
    } finally {
      setLoading(false);
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
  const [workEmail, setWorkEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleHire = async () => {
    if (!application || !employeeId.trim() || !workEmail.trim()) {
      toast.error("Employee ID and Work Email are required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/recruitment/applications/${application.id}/hire`, {
        employeeId: employeeId.trim(),
        workEmail: workEmail.trim(),
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
            {application ? `Convert ${application.first_name} ${application.last_name} to an employee. Creates employee record with status "onboarding". HR must start onboarding from the employee profile.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Employee ID *</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. AH-0042" />
            <p className="text-xs text-muted-foreground">Unique identifier for the employee.</p>
          </div>
          <div className="space-y-2">
            <Label>Work Email *</Label>
            <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="e.g. john.doe@admani.com" />
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
            <ScrollArea className="flex-1 pr-4">
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

                    {/* View uploaded file */}
                    {doc.file_url && doc.status !== "not_applicable" && (
                      <div className="mt-2">
                        <a
                          href={doc.file_url}
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
            </ScrollArea>
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
  const [workEmail, setWorkEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!employeeId.trim() || !workEmail.trim()) {
      toast.error("Employee ID and Work Email are required");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/tentative/${tentativeId}/confirm-hire`, {
        employeeId: employeeId.trim(),
        workEmail: workEmail.trim(),
      });
      const data = await res.json();
      toast.success(`${application?.first_name} ${application?.last_name} has been hired!`, {
        description: "Employee created. Start onboarding from their profile.",
      });
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
            Tentative cleared — all documents verified. Employee will be created with status "onboarding".
          </div>
          <div className="space-y-2">
            <Label>Employee ID *</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. AH-0042" />
          </div>
          <div className="space-y-2">
            <Label>Work Email *</Label>
            <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="e.g. john.doe@company.com" />
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN COMPONENT ====================

export default function Recruitment() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pipeline");

  // Dialogs
  const [jobDialog, setJobDialog] = useState<{ open: boolean; job: JobPosting | null }>({ open: false, job: null });
  const [jobDetailDialog, setJobDetailDialog] = useState<{ open: boolean; job: JobPosting | null }>({ open: false, job: null });
  const [stageDialog, setStageDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [offerDialog, setOfferDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [hireDialog, setHireDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [tentativeInitDialog, setTentativeInitDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [tentativeReviewDialog, setTentativeReviewDialog] = useState<{ open: boolean; app: AppRow | null }>({ open: false, app: null });
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const [includeArchived, setIncludeArchived] = useState(false);
  // Data fetching
  const { data: jobs = [] } = useQuery<JobPosting[]>({
    queryKey: ["/api/recruitment/jobs", includeArchived],
    queryFn: async () => {
      const res = await fetch(`/api/recruitment/jobs${includeArchived ? "?includeArchived=1" : ""}`, { credentials: "include" });
      return res.json();
    },
  });
  const { data: applications = [] } = useQuery<AppRow[]>({ queryKey: ["/api/recruitment/applications"] });
  const { data: candidatesList = [] } = useQuery<CandidateRow[]>({ queryKey: ["/api/recruitment/candidates"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/recruitment/stats"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

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

  return (
    <Layout>
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
          <div className="flex gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {activeTab === "jobs" && (
              <>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="rounded" />
                  Show archived
                </label>
                <Button onClick={() => setJobDialog({ open: true, job: null })}>
                  <Plus className="h-4 w-4 mr-2" /> New Job
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ==================== PIPELINE TAB ==================== */}
        <TabsContent value="pipeline" className="mt-0">
          <div className="mb-4 flex items-center gap-3">
            <Label className="text-sm text-muted-foreground shrink-0">Filter by Job:</Label>
            <Select value={selectedJobId || "__all__"} onValueChange={(v) => setSelectedJobId(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[300px]"><SelectValue placeholder="All Jobs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Jobs</SelectItem>
                {jobs.filter((j) => j.status === "published" || j.status === "paused").map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.title} ({j.department})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedJobId && <Button variant="ghost" size="sm" onClick={() => setSelectedJobId("")}>Clear</Button>}
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 320px)" }}>
            {activeStages.map((stage) => {
              const stageApps = filteredApps.filter((a) => a.stage === stage.id);
              return (
                <div key={stage.id} className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl border border-border">
                  <div className="p-3 flex items-center justify-between border-b border-border bg-muted/50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                      <h3 className="font-semibold text-sm">{stage.label}</h3>
                      <Badge variant="secondary" className="text-xs">{stageApps.length}</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {stageApps.map((app) => (
                        <div
                          key={app.id}
                          className="bg-card p-3 rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">{app.first_name[0]}{app.last_name[0]}</AvatarFallback>
                              </Avatar>
                              <div>
                                <Link href={`/recruitment/candidates/${app.candidate_id}`} className="font-semibold text-sm leading-none hover:underline block">{app.first_name} {app.last_name}</Link>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{app.job_title}</p>
                              </div>
                            </div>
                          </div>
                          {app.current_company && (
                            <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {app.current_company}
                              {app.experience_years ? ` · ${app.experience_years}y` : ""}
                            </p>
                          )}
                          {app.resume_url && (
                            <a href={app.resume_url} download target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
                              <FileText className="h-3 w-3" /> CV
                            </a>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-border/50">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setStageDialog({ open: true, app })}>
                              <ArrowRight className="h-3 w-3 mr-1" /> Move
                            </Button>
                            {stage.id === "interview" || stage.id === "shortlisted" || stage.id === "assessment" ? (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setOfferDialog({ open: true, app })}>
                                <Send className="h-3 w-3 mr-1" /> Offer
                              </Button>
                            ) : null}
                            {stage.id === "offer" && app.offer_id && app.offer_status === "sent" && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={async () => {
                                try {
                                  await apiRequest("PATCH", `/api/recruitment/offers/${app.offer_id}`, { status: "accepted" });
                                  toast.success("Offer marked as accepted");
                                  queryClient.invalidateQueries({ queryKey: ["/api/recruitment/applications"] });
                                } catch { toast.error("Failed to accept offer"); }
                              }}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Accept
                              </Button>
                            )}
                            {stage.id === "offer" && app.offer_id && app.offer_status === "accepted" && (
                              <>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-yellow-600" onClick={() => setTentativeInitDialog({ open: true, app })}>
                                  <Shield className="h-3 w-3 mr-1" /> Tentative
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-green-600" onClick={() => setHireDialog({ open: true, app })}>
                                  <UserPlus className="h-3 w-3 mr-1" /> Direct Hire
                                </Button>
                              </>
                            )}
                            {stage.id === "offer" && !app.offer_id && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setOfferDialog({ open: true, app })}>
                                <Send className="h-3 w-3 mr-1" /> Create Offer
                              </Button>
                            )}
                            {stage.id === "tentative" && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-yellow-600" onClick={() => setTentativeReviewDialog({ open: true, app })}>
                                <Shield className="h-3 w-3 mr-1" /> Review Docs
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {stageApps.length === 0 && (
                        <div className="text-center py-6 text-xs text-muted-foreground">No candidates</div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}

            {/* Rejected column (collapsed) */}
            {(() => {
              const rejectedApps = filteredApps.filter((a) => a.stage === "rejected");
              return (
                <div className="flex-shrink-0 w-72 flex flex-col bg-red-50/30 dark:bg-red-950/10 rounded-xl border border-red-200/50 dark:border-red-800/30">
                  <div className="p-3 flex items-center justify-between border-b border-red-200/50 dark:border-red-800/30 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">Rejected</h3>
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">{rejectedApps.length}</Badge>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
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
                    </div>
                  </ScrollArea>
                </div>
              );
            })()}
          </div>
        </TabsContent>

        {/* ==================== JOBS TAB ==================== */}
        <TabsContent value="jobs">
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mb-3 opacity-40" />
                  <p className="font-medium">No job postings yet</p>
                  <p className="text-sm">Create your first job posting to start recruiting.</p>
                  <Button className="mt-4" onClick={() => setJobDialog({ open: true, job: null })}>
                    <Plus className="h-4 w-4 mr-2" /> Create Job
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hiring Manager(s)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Applications</TableHead>
                      <TableHead className="text-center">Hired</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setJobDetailDialog({ open: true, job })}>
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell>{job.department}</TableCell>
                        <TableCell>{job.location || "-"}</TableCell>
                        <TableCell className="capitalize">{(job.employment_type || "").replace("_", " ")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                          {job.hm_names && job.hm_names.length > 0 ? job.hm_names.join(", ") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.status === "published" ? "default" : "outline"} className={
                            job.status === "published" ? "bg-green-100 text-green-700 border-green-200" :
                            job.status === "draft" ? "bg-slate-100 text-slate-600" :
                            job.status === "closed" ? "bg-red-100 text-red-700 border-red-200" :
                            job.status === "archived" ? "bg-slate-200 text-slate-600 border-slate-300" :
                            "bg-yellow-100 text-yellow-700 border-yellow-200"
                          }>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{job.application_count}</TableCell>
                        <TableCell className="text-center">{job.hired_count}/{job.headcount}</TableCell>
                        <TableCell>{formatDate(job.published_at)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setJobDetailDialog({ open: true, job }); }}>View</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm"><Share2 className="h-3.5 w-3.5 mr-1" />Share</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  const url = `${window.location.origin}/careers`;
                                  navigator.clipboard.writeText(url);
                                  toast.success("Career page link copied");
                                }}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy career page link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const url = `${window.location.origin}/careers`;
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
                            <Button variant="ghost" size="sm" onClick={() => setJobDialog({ open: true, job })}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteJob(job.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ==================== CANDIDATES TAB ==================== */}
        <TabsContent value="candidates">
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
                      No candidates yet. They appear here when they apply via the career site.
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
          onClose={() => setJobDialog({ open: false, job: null })}
          job={jobDialog.job}
          employees={employees}
        />
      )}
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
    </Layout>
  );
}
