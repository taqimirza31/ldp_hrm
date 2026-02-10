import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Upload, CheckCircle, XCircle, Clock, FileText, AlertTriangle,
  Shield, User, Ban,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";

// ==================== TYPES ====================

interface TentativeDoc {
  id: string;
  document_type: string;
  label: string;
  required: boolean;
  status: string;
  file_name: string | null;
  rejection_reason: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
}

interface TentativePortalData {
  id: string;
  status: string;
  is_first_job: boolean;
  first_name: string;
  last_name: string;
  email: string;
  documents: TentativeDoc[];
  message?: string;
}

// ==================== HELPERS ====================

function docStatusIcon(status: string) {
  switch (status) {
    case "verified": return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "uploaded": return <Clock className="h-5 w-5 text-blue-500" />;
    case "rejected": return <XCircle className="h-5 w-5 text-red-500" />;
    case "not_applicable": return <Ban className="h-5 w-5 text-slate-400" />;
    default: return <Upload className="h-5 w-5 text-amber-500" />;
  }
}

function docStatusBadge(status: string) {
  const cfg: Record<string, { label: string; cls: string }> = {
    pending: { label: "Awaiting Upload", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    uploaded: { label: "Under Review", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    verified: { label: "Verified", cls: "bg-green-100 text-green-700 border-green-200" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
    not_applicable: { label: "Not Applicable", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const c = cfg[status] || { label: status, cls: "" };
  return <Badge variant="outline" className={c.cls}>{c.label}</Badge>;
}

// ==================== MAIN COMPONENT ====================

export default function TentativePortal() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<TentativePortalData>({
    queryKey: ["/api/tentative/portal", token],
    queryFn: async () => {
      const r = await fetch(`/api/tentative/portal/${token}`);
      if (!r.ok) throw new Error((await r.json()).error || "Failed to load");
      return r.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground text-sm">
              This document portal link is no longer valid. Please contact HR for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "cleared") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">All Clear!</h2>
            <p className="text-muted-foreground text-sm">
              Your documents have been verified. The hiring process will continue shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Verification Failed</h2>
            <p className="text-muted-foreground text-sm">
              Unfortunately, the document verification process could not be completed. Please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const docs = data.documents || [];
  const requiredDocs = docs.filter((d) => d.required);
  const optionalDocs = docs.filter((d) => !d.required && d.status !== "not_applicable");
  const notApplicable = docs.filter((d) => d.status === "not_applicable");

  const completedRequired = requiredDocs.filter((d) => d.status === "verified" || d.status === "not_applicable").length;
  const progress = requiredDocs.length > 0 ? (completedRequired / requiredDocs.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Document Verification Portal</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{data.first_name} {data.last_name}</span>
            <span className="text-slate-300">·</span>
            <span>{data.email}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">Required Documents</span>
              <span className="text-sm text-muted-foreground">{completedRequired} / {requiredDocs.length} verified</span>
            </div>
            <Progress value={progress} className="h-2" />
            {requiredDocs.some((d) => d.status === "rejected") && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Some documents were rejected. Please re-upload.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Required Documents */}
        <div>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Required Documents</h2>
          <div className="space-y-3">
            {requiredDocs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} token={token!} queryClient={queryClient} />
            ))}
          </div>
        </div>

        {/* Optional Documents */}
        {optionalDocs.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Optional Documents</h2>
            <div className="space-y-3">
              {optionalDocs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} token={token!} queryClient={queryClient} />
              ))}
            </div>
          </div>
        )}

        {/* Not Applicable */}
        {notApplicable.length > 0 && (
          <div>
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">Not Applicable</h2>
            <div className="space-y-2">
              {notApplicable.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 border border-slate-200">
                  <Ban className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-500">{doc.label}</span>
                  <Badge variant="outline" className="ml-auto bg-slate-100 text-slate-500 text-xs">N/A</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground pt-4">
          Accepted formats: PDF, JPG, PNG · Max size: 5MB per file
        </p>
      </div>
    </div>
  );
}

// ==================== DOCUMENT CARD ====================

function DocumentCard({
  doc,
  token,
  queryClient,
}: {
  doc: TentativeDoc;
  token: string;
  queryClient: any;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = doc.status === "pending" || doc.status === "rejected";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, JPG, and PNG files are accepted");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      // Convert to base64 data URL for storage
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch(`/api/tentative/portal/${token}/upload/${doc.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl: reader.result as string,
              fileName: file.name,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
          }
          toast.success(`${doc.label} uploaded successfully`);
          queryClient.invalidateQueries({ queryKey: ["/api/tentative/portal", token] });
        } catch (err: any) {
          toast.error(err?.message || "Upload failed");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
      toast.error("Failed to read file");
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className={`transition-all ${doc.status === "rejected" ? "border-red-200 bg-red-50/30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="pt-0.5">{docStatusIcon(doc.status)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm">{doc.label}</h3>
                {doc.required && <span className="text-[10px] text-red-500 font-medium uppercase">Required</span>}
              </div>
              {docStatusBadge(doc.status)}
            </div>

            {doc.status === "rejected" && doc.rejection_reason && (
              <div className="mt-2 text-xs text-red-600 bg-red-100 rounded-md px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span><strong>Rejected:</strong> {doc.rejection_reason}</span>
              </div>
            )}

            {doc.file_name && doc.status !== "pending" && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <FileText className="h-3 w-3" /> {doc.file_name}
                {doc.uploaded_at && <span>· Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>}
              </p>
            )}

            {canUpload && (
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  size="sm"
                  variant={doc.status === "rejected" ? "default" : "outline"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {uploading ? "Uploading..." : doc.status === "rejected" ? "Re-upload" : "Upload"}
                </Button>
              </div>
            )}

            {doc.status === "uploaded" && (
              <p className="text-xs text-blue-600 mt-2">HR is reviewing this document...</p>
            )}

            {doc.status === "verified" && doc.verified_at && (
              <p className="text-xs text-green-600 mt-1">Verified on {new Date(doc.verified_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
