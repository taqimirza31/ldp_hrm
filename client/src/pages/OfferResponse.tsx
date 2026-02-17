import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, XCircle, Clock, Briefcase, MapPin, Calendar,
  DollarSign, FileText, Building2, AlertTriangle, PartyPopper,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";

// ==================== TYPES ====================

interface OfferData {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  department: string | null;
  jobPostingTitle: string;
  location: string | null;
  salary: string;
  salaryCurrency: string | null;
  startDate: string | null;
  employmentType: string | null;
  terms: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
}

// ==================== HELPERS ====================

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatSalary(amount: string, currency: string | null) {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${currency || "USD"} ${formatted}`;
}

function formatEmploymentType(type: string | null) {
  if (!type) return "—";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==================== MAIN COMPONENT ====================

export default function OfferResponse() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [responding, setResponding] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"accept" | "reject" | null>(null);

  const { data: offer, isLoading, error } = useQuery<OfferData>({
    queryKey: [`/api/recruitment/offer-response/${token}`],
    enabled: !!token,
    retry: false,
  });

  const respondMutation = useMutation({
    mutationFn: async (action: "accept" | "reject") => {
      const res = await apiRequest("POST", `/api/recruitment/offer-response/${token}`, { action });
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: [`/api/recruitment/offer-response/${token}`] });
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to process response");
    },
    onSettled: () => {
      setResponding(false);
    },
  });

  const handleResponse = (action: "accept" | "reject") => {
    setResponding(true);
    respondMutation.mutate(action);
  };

  // ==================== LOADING / ERROR ====================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-lg">
          <CardContent className="py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading offer details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-xl shadow-lg">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Offer Not Found</h2>
            <p className="text-muted-foreground">
              This offer link is invalid, has expired, or has already been used.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== ALREADY RESPONDED ====================

  const isResponded = offer.status !== "sent";
  const isAccepted = offer.status === "accepted";
  const isRejected = offer.status === "rejected";
  const isWithdrawn = offer.status === "withdrawn";

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Offer Letter</h1>
          <p className="text-muted-foreground">
            Hello <span className="font-medium text-foreground">{offer.candidateName}</span>,
            {isResponded
              ? " here are the details of your offer."
              : " please review the offer below and respond."}
          </p>
        </div>

        {/* Status Banner */}
        {isResponded && (
          <Card className={`border-2 ${isAccepted ? "border-green-300 bg-green-50 dark:bg-green-950/30" : isRejected ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"}`}>
            <CardContent className="py-4 flex items-center gap-3">
              {isAccepted && <PartyPopper className="h-6 w-6 text-green-600" />}
              {isRejected && <XCircle className="h-6 w-6 text-red-600" />}
              {isWithdrawn && <AlertTriangle className="h-6 w-6 text-amber-600" />}
              <div>
                <p className="font-semibold">
                  {isAccepted && "Offer Accepted"}
                  {isRejected && "Offer Declined"}
                  {isWithdrawn && "Offer Withdrawn"}
                  {!isAccepted && !isRejected && !isWithdrawn && `Status: ${offer.status}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isAccepted && "Congratulations! The HR team will reach out with next steps."}
                  {isRejected && "You have declined this offer. Thank you for your consideration."}
                  {isWithdrawn && "This offer has been withdrawn by the company."}
                </p>
                {offer.respondedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Responded on {formatDate(offer.respondedAt)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Offer Details */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {offer.jobTitle}
            </CardTitle>
            <CardDescription>
              Position: {offer.jobPostingTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{offer.department || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{offer.location || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Salary</p>
                  <p className="font-medium text-lg">{formatSalary(offer.salary, offer.salaryCurrency)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium">{formatEmploymentType(offer.employmentType)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Proposed Start Date</p>
                  <p className="font-medium">{formatDate(offer.startDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Offer Sent</p>
                  <p className="font-medium">{formatDate(offer.sentAt)}</p>
                </div>
              </div>
            </div>

            {/* Terms */}
            {offer.terms && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Terms & Conditions</h3>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-md p-4">
                    {offer.terms}
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons (only if not yet responded) */}
            {!isResponded && (
              <>
                <Separator />

                {!confirmAction ? (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
                      onClick={() => setConfirmAction("accept")}
                    >
                      <CheckCircle className="h-5 w-5" /> Accept Offer
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 gap-2 px-8"
                      onClick={() => setConfirmAction("reject")}
                    >
                      <XCircle className="h-5 w-5" /> Decline Offer
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-2">
                    <div className={`p-4 rounded-lg border-2 ${confirmAction === "accept" ? "border-green-200 bg-green-50 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:bg-red-950/30"}`}>
                      <p className="font-semibold mb-1">
                        {confirmAction === "accept"
                          ? "Are you sure you want to accept this offer?"
                          : "Are you sure you want to decline this offer?"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {confirmAction === "accept"
                          ? "Once accepted, the HR team will proceed with the next steps."
                          : "This action cannot be undone."}
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Button
                        size="lg"
                        disabled={responding}
                        className={confirmAction === "accept" ? "bg-green-600 hover:bg-green-700 text-white gap-2" : "bg-red-600 hover:bg-red-700 text-white gap-2"}
                        onClick={() => handleResponse(confirmAction)}
                      >
                        {responding ? (
                          <Clock className="h-4 w-4 animate-spin" />
                        ) : confirmAction === "accept" ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {responding ? "Processing..." : confirmAction === "accept" ? "Yes, Accept" : "Yes, Decline"}
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        disabled={responding}
                        onClick={() => setConfirmAction(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          This is a confidential communication. If you received this link by mistake, please disregard it.
        </p>
      </div>
    </div>
  );
}
