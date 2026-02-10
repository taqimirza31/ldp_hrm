import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail, Phone, MapPin, Linkedin, Download, Calendar,
  ArrowLeft, FileText, Briefcase, Clock, Building2,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const STAGE_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700",
  longlisted: "bg-indigo-100 text-indigo-700",
  screening: "bg-purple-100 text-purple-700",
  shortlisted: "bg-cyan-100 text-cyan-700",
  assessment: "bg-amber-100 text-amber-700",
  interview: "bg-orange-100 text-orange-700",
  offer: "bg-emerald-100 text-emerald-700",
  hired: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CandidateProfile() {
  const [, params] = useRoute("/recruitment/candidates/:id");
  const [, setLocation] = useLocation();
  const candidateId = params?.id;

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["/api/recruitment/candidates", candidateId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/recruitment/candidates/${candidateId}`);
      return res.json();
    },
    enabled: !!candidateId,
  });

  if (isLoading || !candidate) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </Layout>
    );
  }

  const applications = candidate.applications || [];

  return (
    <Layout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-4" onClick={() => setLocation("/recruitment")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Recruitment
        </Button>

        {/* Header */}
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-between bg-card p-8 rounded-2xl border border-border shadow-sm">
          <div className="flex gap-6">
            <Avatar className="h-20 w-20 border-4 border-muted shadow-sm">
              <AvatarFallback className="text-2xl bg-muted">{candidate.first_name?.[0]}{candidate.last_name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold mb-1">{candidate.first_name} {candidate.last_name}</h1>
              {candidate.current_title && (
                <p className="text-lg text-muted-foreground font-medium mb-3">
                  {candidate.current_title}{candidate.current_company ? ` at ${candidate.current_company}` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {candidate.email}</span>
                {candidate.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {candidate.phone}</span>}
                {candidate.linkedin_url && (
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-[180px] text-sm">
            {candidate.experience_years && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Experience</span>
                <span className="font-medium">{candidate.experience_years} years</span>
              </div>
            )}
            {candidate.expected_salary && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Expected Salary</span>
                <span className="font-medium">{candidate.salary_currency || ""} {Number(candidate.expected_salary).toLocaleString()}</span>
              </div>
            )}
            {candidate.source && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium capitalize">{candidate.source.replace("_", " ")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="applications" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
            </TabsList>

            <TabsContent value="applications" className="space-y-4 mt-4">
              {applications.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No applications yet.</p>
                  </CardContent>
                </Card>
              ) : (
                applications.map((app: any) => (
                  <Card key={app.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-base">{app.job_title}</h3>
                          <p className="text-sm text-muted-foreground">{app.job_department}{app.job_location ? ` · ${app.job_location}` : ""}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs ${STAGE_COLORS[app.stage] || ""}`}>
                          {app.stage?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Applied {formatDate(app.applied_at)}</span>
                        {app.stage_updated_at && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {formatDate(app.stage_updated_at)}</span>
                        )}
                      </div>
                      {app.reject_reason && (
                        <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">Rejection reason: {app.reject_reason}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="resume" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {candidate.resume_url ? (
                    candidate.resume_url.startsWith("data:") ? (
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium mb-1">{candidate.resume_filename || "Resume"}</p>
                        <a href={candidate.resume_url} download={candidate.resume_filename || "resume.pdf"}>
                          <Button variant="outline" className="mt-3">
                            <Download className="h-4 w-4 mr-2" /> Download
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium">{candidate.resume_filename || "Resume"}</p>
                        <p className="text-sm text-muted-foreground mt-1">{candidate.resume_url}</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p>No resume uploaded.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Candidate Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate ml-4">{candidate.email}</span>
              </div>
              {candidate.phone && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{candidate.phone}</span>
                </div>
              )}
              {candidate.current_company && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{candidate.current_company}</span>
                </div>
              )}
              {candidate.experience_years && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Experience</span>
                  <span className="font-medium">{candidate.experience_years} years</span>
                </div>
              )}
              {candidate.current_salary && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Current Salary</span>
                  <span className="font-medium">{candidate.salary_currency} {Number(candidate.current_salary).toLocaleString()}</span>
                </div>
              )}
              {candidate.expected_salary && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Expected Salary</span>
                  <span className="font-medium">{candidate.salary_currency} {Number(candidate.expected_salary).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {candidate.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
