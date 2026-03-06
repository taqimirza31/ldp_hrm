import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { FileEdit, Inbox, CheckCircle, XCircle, Loader2, User, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Match backend ChangeRequestResponseDTO (camelCase)
interface ChangeRequestRow {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  requesterEmail?: string;
  category: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}

function formatDate(s: string | null | undefined) {
  if (s == null || s === "") return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format old/new value for display; use consistent date format for date-like values. */
function formatChangeValue(value: string | null | undefined, maxLen = 50): string {
  if (value == null || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
    return hasTime
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function categoryLabel(cat: string) {
  const labels: Record<string, string> = {
    personal_details: "Personal details",
    address: "Address",
    contact: "Contact",
    dependents: "Dependents",
    emergency_contacts: "Emergency contacts",
    bank_details: "Bank details",
  };
  return labels[cat] || cat;
}

export default function ChangeRequests() {
  const { user, isAdmin, isHR } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading, error } = useQuery<ChangeRequestRow[]>({
    queryKey: ["/api/change-requests"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/change-requests");
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, reviewNotes }: { id: string; reviewNotes?: string }) => {
      const res = await apiRequest("PATCH", `/api/change-requests/${id}/approve`, { reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      toast.success("Change request approved");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reviewNotes }: { id: string; reviewNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/change-requests/${id}/reject`, { reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      toast.success("Change request rejected");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to reject"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/change-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      toast.success("Change request deleted");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete"),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const isApprover = isAdmin || isHR;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Change requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isApprover
            ? "Review and approve or reject profile change requests from employees."
            : "View your profile change requests and their status."}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileEdit className="h-5 w-5" />
              {isApprover ? "All change requests" : "My change requests"}
            </CardTitle>
            <CardDescription>
              {isApprover
                ? `${pending.length} pending · ${requests.length} total`
                : `${requests.length} request(s)`}
            </CardDescription>
          </div>
          {user?.employeeId && (
            <Link href={`/employees/${user.employeeId}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                My profile — request a change
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-4">Failed to load change requests.</p>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">No change requests</p>
              <p className="text-sm mt-1">
                {user?.employeeId
                  ? "Go to your profile and edit Personal details, Address, Dependents, or Emergency contacts to submit a change request for HR approval."
                  : "No requests to show."}
              </p>
              {user?.employeeId && (
                <Link href={`/employees/${user.employeeId}`}>
                  <Button variant="outline" size="sm" className="mt-4 gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Open my profile
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="max-h-[min(70vh,600px)] overflow-y-auto overflow-x-hidden space-y-3 pr-1">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.employeeName ?? "—"}</span>
                      {r.employeeCode && (
                        <span className="text-xs text-muted-foreground">{r.employeeCode}</span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          r.status === "pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : r.status === "approved"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {r.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {categoryLabel(r.category)} · <span className="font-mono text-xs">{r.fieldName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatChangeValue(r.oldValue)} → {formatChangeValue(r.newValue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(r.createdAt)}</p>
                  </div>
                  {isApprover && (
                    <div className="flex gap-2 flex-shrink-0">
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => approveMutation.mutate({ id: r.id })}
                            disabled={approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => {
                              const notes = window.prompt("Rejection reason (required):");
                              if (notes?.trim()) rejectMutation.mutate({ id: r.id, reviewNotes: notes.trim() });
                              else if (notes !== null) toast.error("Rejection reason is required");
                            }}
                            disabled={approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                        onClick={() => {
                          if (window.confirm("Delete this change request? This cannot be undone.")) deleteMutation.mutate(r.id);
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending}
                        title="Delete request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
