import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, MapPin, Clock, ArrowRight, Briefcase, Globe, Users, TrendingUp, Zap, CheckCircle2, PlayCircle, Upload, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface PublishedJob {
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
  published_at: string | null;
}

function formatType(t: string | null) {
  if (!t) return "";
  return t.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function CareerSite() {
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [search, setSearch] = useState("");
  const [jobDetailDialog, setJobDetailDialog] = useState<{ open: boolean; job: PublishedJob | null }>({ open: false, job: null });
  const [applyDialog, setApplyDialog] = useState<{ open: boolean; job: PublishedJob | null }>({ open: false, job: null });
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentCompany: "", currentTitle: "", experienceYears: "",
    expectedSalary: "", salaryCurrency: "AED",
    linkedinUrl: "", coverLetter: "",
  });
  const [resumeData, setResumeData] = useState<{ url: string; filename: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/recruitment/jobs/published")
      .then((r) => r.json())
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const filteredJobs = jobs.filter((j) =>
    !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
  );

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setResumeData({ url: reader.result as string, filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!resumeData) {
      toast.error("Please upload your resume");
      return;
    }
    if (!applyDialog.job) return;

    setLoading(true);
    try {
      // 1. Create or update candidate
      const candidateRes = await fetch("/api/recruitment/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone || null,
          linkedinUrl: form.linkedinUrl || null,
          currentCompany: form.currentCompany || null,
          currentTitle: form.currentTitle || null,
          experienceYears: form.experienceYears ? parseInt(form.experienceYears) : null,
          expectedSalary: form.expectedSalary ? parseFloat(form.expectedSalary) : null,
          salaryCurrency: form.salaryCurrency || null,
          resumeUrl: resumeData.url,
          resumeFilename: resumeData.filename,
          source: "career_page",
        }),
      });
      if (!candidateRes.ok) {
        const errData = await candidateRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit application");
      }
      const candidate = await candidateRes.json();

      // 2. Create application
      const appRes = await fetch("/api/recruitment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          jobId: applyDialog.job.id,
          coverLetter: form.coverLetter || null,
          referralSource: "career_page",
        }),
      });
      if (!appRes.ok) {
        const errData = await appRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit application");
      }

      toast.success("Application submitted!", { description: "We'll review your profile and get back to you." });
      setApplyDialog({ open: false, job: null });
      setForm({ firstName: "", lastName: "", email: "", phone: "", currentCompany: "", currentTitle: "", experienceYears: "", expectedSalary: "", salaryCurrency: "AED", linkedinUrl: "", coverLetter: "" });
      setResumeData(null);
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg font-bold tracking-tight">AL</div>
            <span className="font-bold text-xl tracking-tight">Admani Logistics</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#benefits" className="hover:text-blue-600 transition-colors">Benefits</a>
            <a href="#jobs" className="hover:text-blue-600 transition-colors">Open Positions</a>
          </div>
          <Button className="rounded-full px-6 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20" onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}>
            View Roles
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 py-32 lg:py-48">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
          <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[80%] rounded-full bg-blue-600 blur-[120px]"></div>
          <div className="absolute top-[40%] -left-[10%] w-[40%] h-[60%] rounded-full bg-purple-600 blur-[100px]"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-blue-200 text-sm font-medium mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            {jobs.length > 0 ? `${jobs.length} open position${jobs.length > 1 ? "s" : ""}` : "We're hiring!"}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-8 max-w-4xl mx-auto leading-[1.1]">
            Shape the future of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">global logistics.</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
            Join a team of visionaries, engineers, and creators working together to solve the world's most complex supply chain challenges.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for roles..."
                className="w-full h-14 pl-12 pr-4 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              size="lg"
              className="h-14 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-600/30 transition-all hover:scale-105"
              onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}
            >
              Search Jobs
            </Button>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div id="benefits" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Admani?</h2>
            <p className="text-lg text-slate-500">We take care of our people so they can take care of the world.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: "Remote-First", desc: "Work from anywhere in the world. We believe in output, not hours." },
              { icon: TrendingUp, title: "Growth Budget", desc: "$2,000 annual stipend for courses, conferences, and books." },
              { icon: Users, title: "Health & Wellness", desc: "Comprehensive health coverage and monthly wellness allowance." },
              { icon: Zap, title: "Cutting Edge Tech", desc: "Latest MacBook Pro and budget for your perfect home office setup." },
              { icon: CheckCircle2, title: "Flexible Time Off", desc: "Unlimited PTO policy with a mandatory minimum of 3 weeks." },
              { icon: PlayCircle, title: "Team Retreats", desc: "Bi-annual company-wide retreats in exciting locations." },
            ].map((benefit, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                    <benefit.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{benefit.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div id="jobs" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Open Positions</h2>
              <p className="text-slate-500">Find your next role at Admani.</p>
            </div>
          </div>
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No open positions at the moment</p>
                <p className="text-sm mt-1">Check back soon for new opportunities!</p>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer"
                  onClick={() => setJobDetailDialog({ open: true, job })}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {job.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-2">
                        <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {job.department}</span>
                        {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {job.location}</span>}
                        {job.employment_type && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatType(job.employment_type)}</span>}
                      </div>
                      {job.salary_range_min && job.salary_range_max && (
                        <p className="text-sm text-slate-400">
                          {job.salary_currency || ""} {Number(job.salary_range_min).toLocaleString()} – {Number(job.salary_range_max).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-end">
                      <div className="h-10 w-10 rounded-full bg-slate-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Dialog */}
      <Dialog open={jobDetailDialog.open} onOpenChange={(open) => { if (!open) setJobDetailDialog({ open: false, job: null }); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{jobDetailDialog.job?.title}</DialogTitle>
            <DialogDescription>
              {jobDetailDialog.job?.department}
              {jobDetailDialog.job?.location ? ` · ${jobDetailDialog.job.location}` : ""}
              {jobDetailDialog.job?.employment_type ? ` · ${formatType(jobDetailDialog.job.employment_type)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {jobDetailDialog.job?.salary_range_min && jobDetailDialog.job?.salary_range_max && (
              <p className="text-sm font-medium text-slate-600">
                {jobDetailDialog.job.salary_currency || ""} {Number(jobDetailDialog.job.salary_range_min).toLocaleString()} – {Number(jobDetailDialog.job.salary_range_max).toLocaleString()}
              </p>
            )}
            {jobDetailDialog.job?.description && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">About the role</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{jobDetailDialog.job.description}</p>
              </div>
            )}
            {jobDetailDialog.job?.requirements && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Requirements</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{jobDetailDialog.job.requirements}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDetailDialog({ open: false, job: null })}>Close</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
              setApplyDialog({ open: true, job: jobDetailDialog.job });
              setJobDetailDialog({ open: false, job: null });
            }}>
              Apply for this position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={applyDialog.open} onOpenChange={(open) => { if (!open) setApplyDialog({ open: false, job: null }); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for {applyDialog.job?.title}</DialogTitle>
            <DialogDescription>
              {applyDialog.job?.department}{applyDialog.job?.location ? ` · ${applyDialog.job.location}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 50 123 4567" />
            </div>
            <div className="space-y-2">
              <Label>Resume / CV *</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                {resumeData ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{resumeData.filename}</span>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setResumeData(null)}>Remove</Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to upload (PDF, max 5MB)</p>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleResumeChange} />
                  </label>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Company</Label>
                <Input value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Current Title</Label>
                <Input value={form.currentTitle} onChange={(e) => setForm({ ...form, currentTitle: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Expected Salary</Label>
                <Input type="number" value={form.expectedSalary} onChange={(e) => setForm({ ...form, expectedSalary: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <div className="space-y-2">
              <Label>Cover Letter</Label>
              <Textarea value={form.coverLetter} onChange={(e) => setForm({ ...form, coverLetter: e.target.value })} rows={3} placeholder="Tell us why you're a great fit..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog({ open: false, job: null })}>Cancel</Button>
            <Button onClick={handleApply} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white p-1 rounded font-bold">AL</div>
              <span className="font-bold text-xl text-white tracking-tight">Admani Logistics</span>
            </div>
            <p className="text-sm">&copy; 2026 Admani Logistics. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
