import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { FileEdit, Inbox, CheckCircle, XCircle, Loader2, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface ChangeRequestRow {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  requester_email: string;
  category: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      return Array.isArray(json) ? json : [];
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
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.employee_name}</span>
                      {r.employee_code && (
                        <span className="text-xs text-muted-foreground">{r.employee_code}</span>
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
                      {categoryLabel(r.category)} · <span className="font-mono text-xs">{r.field_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.old_value != null ? String(r.old_value).slice(0, 50) : "—"} →{" "}
                      {r.new_value != null ? String(r.new_value).slice(0, 50) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(r.created_at)}</p>
                  </div>
                  {isApprover && r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => approveMutation.mutate({ id: r.id })}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
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
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
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
