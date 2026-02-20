import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin,
  Clock,
  ArrowRight,
  Briefcase,
  Search,
  Upload,
  FileText,
  Menu,
  Truck,
  MapPin as LocationIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { sanitizeJobHtml, isHtmlContent } from "@/lib/utils";

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
  return t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Placeholder image per department (optional; could use real URLs later)
function getJobCardImage(department: string): string {
  const dept = (department || "").toLowerCase();
  if (dept.includes("it") || dept.includes("tech")) return "https://images.unsplash.com/photo-1551431009-a802eeec77b1?w=400&h=260&fit=crop";
  if (dept.includes("logistics") || dept.includes("operations")) return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=260&fit=crop";
  if (dept.includes("hr") || dept.includes("admin")) return "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=260&fit=crop";
  return "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=260&fit=crop";
}

export default function CareerSite() {
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [search, setSearch] = useState("");
  const [jobDetailDialog, setJobDetailDialog] = useState<{ open: boolean; job: PublishedJob | null }>({ open: false, job: null });
  const [applyDialog, setApplyDialog] = useState<{ open: boolean; job: PublishedJob | null }>({ open: false, job: null });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    personalEmail: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    currentCompany: "",
    currentTitle: "",
    experienceYears: "",
    expectedSalary: "",
    salaryCurrency: "AED",
    linkedinUrl: "",
    coverLetter: "",
  });
  const [resumeData, setResumeData] = useState<{ url: string; filename: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterAccepted, setNewsletterAccepted] = useState(false);

  useEffect(() => {
    fetch("/api/recruitment/jobs/published")
      .then((r) => r.json())
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Open apply form directly when URL has ?job=JOB_ID (e.g. from Webflow link)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const jobId = params.get("job");
    if (!jobId || jobs.length === 0) return;
    const job = jobs.find((j) => j.id === jobId);
    if (job) setApplyDialog({ open: true, job });
  }, [jobs]);

  const filteredJobs = jobs.filter(
    (j) =>
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.department.toLowerCase().includes(search.toLowerCase())
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
      const candidateRes = await fetch("/api/recruitment/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone || null,
          personalEmail: form.personalEmail.trim() || null,
          dateOfBirth: form.dateOfBirth || null,
          gender: form.gender || null,
          maritalStatus: form.maritalStatus || null,
          bloodGroup: form.bloodGroup || null,
          street: form.street.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zipCode: form.zipCode.trim() || null,
          country: form.country.trim() || null,
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
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        personalEmail: "",
        dateOfBirth: "",
        gender: "",
        maritalStatus: "",
        bloodGroup: "",
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
        currentCompany: "",
        currentTitle: "",
        experienceYears: "",
        expectedSalary: "",
        salaryCurrency: "AED",
        linkedinUrl: "",
        coverLetter: "",
      });
      setResumeData(null);
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) {
      toast.error("Please enter your email");
      return;
    }
    if (!newsletterAccepted) {
      toast.error("Please accept the privacy policy & terms of service");
      return;
    }
    toast.success("Thanks for subscribing!");
    setNewsletterEmail("");
    setNewsletterAccepted(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      {/* ========== TOP BAR (dark grey) ========== */}
      <div className="bg-[#1f2937] text-slate-300 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <a href="tel:+17322189958" className="hover:text-white transition-colors">(732) 218-9958</a>
            <a href="mailto:info@ldplogistics.com" className="hover:text-white transition-colors">info@ldplogistics.com</a>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors uppercase tracking-wide">Facebook</a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors uppercase tracking-wide">LinkedIn</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors uppercase tracking-wide">Twitter</a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors uppercase tracking-wide">Instagram</a>
            <span className="text-slate-400">368 Washington Rd., Suite 4, Sayreville, NJ 08872</span>
          </div>
        </div>
      </div>

      {/* ========== MAIN HEADER (white) ========== */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded bg-[#B91C1C] text-white">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight text-slate-900">LDP LOGISTICS</span>
                <p className="text-xs text-slate-500 -mt-0.5">technology driven</p>
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#hero" className="hover:text-[#B91C1C] transition-colors">Home</a>
            <a href="#benefits" className="hover:text-[#B91C1C] transition-colors">About</a>
            <a href="#jobs" className="hover:text-[#B91C1C] transition-colors">Open Positions</a>
            <a href="#cta" className="hover:text-[#B91C1C] transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              className="rounded-none bg-[#B91C1C] hover:bg-[#991B1B] text-white font-semibold px-6"
              onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}
            >
              View Roles
            </Button>
            <button type="button" className="md:hidden p-2 border border-slate-300 rounded" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section id="hero" className="bg-white py-16 lg:py-24 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            Join our ever <span className="text-[#B91C1C]">Growing team!</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            We offer a dynamic and rewarding work environment where your skills and expertise can make a significant impact. Join us and be a part of a growing company that values innovation, teamwork, and professional growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for roles..."
                className="w-full h-12 pl-11 pr-4 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#B91C1C] focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              className="h-12 px-6 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-semibold rounded"
              onClick={() => document.getElementById("jobs")?.scrollIntoView({ behavior: "smooth" })}
            >
              Search Jobs
            </Button>
          </div>
        </div>
      </section>

      {/* ========== ABOUT / WHY JOIN US ========== */}
      <section id="benefits" className="bg-white py-12 lg:py-16 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 text-center">Why join LDP?</h2>
          <p className="text-slate-600 text-center max-w-2xl mx-auto mb-8">
            We value innovation, teamwork, and professional growth. Join a team where your contribution matters.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="p-4">
              <div className="h-10 w-10 rounded bg-red-100 text-[#B91C1C] flex items-center justify-center mx-auto mb-3">
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Expert logistics</h3>
              <p className="text-sm text-slate-500">Technology-driven solutions you can grow with.</p>
            </div>
            <div className="p-4">
              <div className="h-10 w-10 rounded bg-red-100 text-[#B91C1C] flex items-center justify-center mx-auto mb-3">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Growth & development</h3>
              <p className="text-sm text-slate-500">We invest in our people and their careers.</p>
            </div>
            <div className="p-4">
              <div className="h-10 w-10 rounded bg-red-100 text-[#B91C1C] flex items-center justify-center mx-auto mb-3">
                <LocationIcon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Multiple locations</h3>
              <p className="text-sm text-slate-500">Pakistan Office, US, and remote opportunities.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== JOB LISTINGS (card style like LDP) ========== */}
      <section id="jobs" className="bg-slate-50 py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Open Positions</h2>
          <p className="text-slate-600 mb-10">Find your next role at LDP Logistics.</p>

          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
              <Briefcase className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-600">No open positions at the moment</p>
              <p className="text-sm text-slate-500 mt-1">Check back soon for new opportunities!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  className="overflow-hidden border border-slate-200 rounded-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group bg-white"
                  onClick={() => setJobDetailDialog({ open: true, job })}
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Left: image */}
                    <div className="md:w-72 flex-shrink-0 h-48 md:h-auto bg-slate-200 overflow-hidden">
                      <img
                        src={getJobCardImage(job.department)}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    {/* Right: details */}
                    <CardContent className="flex-1 p-6 flex flex-col justify-center">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#B91C1C] transition-colors mb-1">
                        {job.title}
                      </h3>
                      <p className="text-sm text-slate-500 mb-3">
                        {formatType(job.employment_type) || "Opportunity"} – {job.title}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
                        {job.employment_type && (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-4 w-4" /> {formatType(job.employment_type)}
                          </span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin className="h-4 w-4" /> {job.location}
                          </span>
                        )}
                        {!job.location && job.department && (
                          <span className="flex items-center gap-1.5 font-medium">
                            <Briefcase className="h-4 w-4" /> {job.department}
                          </span>
                        )}
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setJobDetailDialog({ open: true, job });
                        }}
                        className="inline-flex items-center gap-1 text-[#B91C1C] font-semibold hover:underline"
                      >
                        Read more <ArrowRight className="h-4 w-4" />
                      </a>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========== CTA SECTION ========== */}
      <section id="cta" className="bg-white py-16 lg:py-20 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Get started with expert logistics <span className="text-[#B91C1C]">solutions!</span>
          </h2>
          <Button
            variant="outline"
            className="rounded-none border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white font-semibold px-8 py-6 text-base"
            asChild
          >
            <a href="https://ldplogistics.com" target="_blank" rel="noopener noreferrer">
              Get a quote <ArrowRight className="h-4 w-4 ml-1 inline" />
            </a>
          </Button>
        </div>
      </section>

      {/* ========== FOOTER (dark grey, multi-column) ========== */}
      <footer className="bg-[#1f2937] text-slate-300 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Column 1: Company */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-9 h-9 rounded bg-[#B91C1C] text-white">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-white text-lg">LDP LOGISTICS</span>
                  <p className="text-xs text-slate-400 -mt-0.5">technology driven</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#hero" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#benefits" className="hover:text-white transition-colors">About</a></li>
                <li><a href="https://ldplogistics.com/blog" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#jobs" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="https://ldplogistics.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#cta" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>

            {/* Column 2: Our Services */}
            <div>
              <h3 className="font-bold text-white mb-4">Our Services</h3>
              <ul className="space-y-2 text-sm">
                <li>Domestic Transportation</li>
                <li>LDP / DDP Services</li>
                <li>OOG & Heavy Haul</li>
                <li>Warehousing & Distribution</li>
                <li>Amazon FBA Prep</li>
              </ul>
            </div>

            {/* Column 3: Newsletter */}
            <div>
              <h3 className="font-bold text-white mb-4">Subscribe to our newsletter</h3>
              <p className="text-sm text-slate-400 mb-4">For insights, tips, and exclusive offers.</p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 rounded-none"
                />
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newsletterAccepted}
                    onChange={(e) => setNewsletterAccepted(e.target.checked)}
                    className="mt-1 rounded border-slate-500"
                  />
                  <span>By subscribing you accept our privacy policy & terms of service</span>
                </label>
                <Button type="submit" className="w-full rounded-none bg-[#B91C1C] hover:bg-[#991B1B] text-white">
                  Submit
                </Button>
              </form>
              <div className="flex gap-3 mt-4">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">Facebook</a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">Twitter</a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">Instagram</a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">LinkedIn</a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors text-sm">Youtube</a>
              </div>
            </div>

            {/* Column 4: Contact */}
            <div>
              <h3 className="font-bold text-white mb-4">Contact</h3>
              <p className="text-sm mb-1"><span className="text-slate-400">Email</span><br />info@ldplogistics.com</p>
              <p className="text-sm mb-1 mt-3"><span className="text-slate-400">Phone</span><br />(732) 218-9958</p>
              <p className="text-sm mt-3"><span className="text-slate-400">Location</span><br />368 Washington Rd., Suite 4, Sayreville, NJ 08872</p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <a href="#jobs" className="text-[#B91C1C] font-semibold hover:underline inline-flex items-center gap-1">
              Be a Part of Our Team <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-sm text-slate-500">LDP Logistics © {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>

      {/* ========== JOB DETAIL DIALOG ========== */}
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
                {isHtmlContent(jobDetailDialog.job.description) ? (
                  <div
                    className="text-sm text-slate-600 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0 prose-strong:font-semibold"
                    dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(jobDetailDialog.job.description) }}
                  />
                ) : (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{jobDetailDialog.job.description}</p>
                )}
              </div>
            )}
            {jobDetailDialog.job?.requirements && (
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Requirements</h4>
                {isHtmlContent(jobDetailDialog.job.requirements) ? (
                  <div
                    className="text-sm text-slate-600 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-0 prose-strong:font-semibold"
                    dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(jobDetailDialog.job.requirements) }}
                  />
                ) : (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{jobDetailDialog.job.requirements}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDetailDialog({ open: false, job: null })}>Close</Button>
            <Button
              className="bg-[#B91C1C] hover:bg-[#991B1B] text-white"
              onClick={() => {
                setApplyDialog({ open: true, job: jobDetailDialog.job });
                setJobDetailDialog({ open: false, job: null });
              }}
            >
              Apply for this position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== APPLY DIALOG ========== */}
      <Dialog open={applyDialog.open} onOpenChange={(open) => { if (!open) setApplyDialog({ open: false, job: null }); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 732 218 9958" />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-slate-900 mb-3">Personal Details</p>
              <p className="text-xs text-slate-500 mb-3">Optional. Used to prefill your employee profile if you are hired.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Gender</Label>
                  <Select value={form.gender || "_"} onValueChange={(v) => setForm({ ...form, gender: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Marital Status</Label>
                  <Select value={form.maritalStatus || "_"} onValueChange={(v) => setForm({ ...form, maritalStatus: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Blood Group</Label>
                  <Select value={form.bloodGroup || "_"} onValueChange={(v) => setForm({ ...form, bloodGroup: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                <div className="space-y-2 col-span-2">
                  <Label className="text-muted-foreground">Personal Email</Label>
                  <Input type="email" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} placeholder="Optional; different from main email" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Resume / CV *</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-[#B91C1C]/50 transition-colors">
                {resumeData ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-[#B91C1C]" />
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
            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-slate-900 mb-3">Home Address</p>
              <p className="text-xs text-slate-500 mb-3">Optional. Used to prefill your employee profile if you are hired.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label className="text-muted-foreground">Street</Label>
                  <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Street address" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">State</Label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Zip Code</Label>
                  <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
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
            <Button onClick={handleApply} disabled={loading} className="bg-[#B91C1C] hover:bg-[#991B1B] text-white">
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
