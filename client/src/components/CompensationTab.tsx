import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Banknote, TrendingUp, Plus, Trash2, Lock, Edit2, Eye, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

// ===================== Types =====================
interface SalaryDetail {
  id: string;
  employee_id: string;
  annual_salary: string;
  currency: string;
  start_date: string;
  is_current: string;
  reason: string | null;
  pay_rate: string | null;
  pay_rate_period: string | null;
  payout_frequency: string | null;
  pay_group: string | null;
  pay_method: string | null;
  eligible_work_hours: string | null;
  additional_details: string | null;
  notes: string | null;
  updated_at: string;
}

interface BankingDetail {
  id: string;
  employee_id: string;
  bank_name: string;
  name_on_account: string;
  bank_code: string | null;
  account_number: string;
  iban: string | null;
  is_primary: string;
}

interface Bonus {
  id: string;
  employee_id: string;
  bonus_type: string;
  amount: string;
  currency: string;
  bonus_date: string;
  notes: string | null;
}

interface StockGrant {
  id: string;
  employee_id: string;
  units: number;
  grant_date: string;
  vesting_schedule: string | null;
  notes: string | null;
}

// ===================== Helpers =====================
function formatCurrency(amount: string | number, currency: string = "PKR") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function maskAccount(acc: string) {
  if (acc.length <= 4) return acc;
  return acc;
}

// ===================== Sub-Dialogs =====================

/** Dialog to view full salary details (like the Freshteams screenshot) */
function SalaryDetailDialog({ salary, open, onOpenChange }: { salary: SalaryDetail | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!salary) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Salary Details
            <span className="text-xs text-muted-foreground font-normal">Updated on {formatDate(salary.updated_at)}</span>
          </DialogTitle>
          <DialogDescription>Detailed view of the compensation record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Overview */}
          <div>
            <h4 className="font-bold text-sm mb-3">Overview</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Annual salary</p>
                <p className="font-bold text-lg">{formatCurrency(salary.annual_salary, salary.currency)}</p>
                {salary.is_current === "true" && <Badge variant="outline" className="bg-teal-100 text-teal-700 mt-1">Current</Badge>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-medium">{formatDate(salary.start_date)}</p>
              </div>
            </div>
            {salary.reason && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="font-medium text-sm">{salary.reason}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Additional Details */}
          <div>
            <h4 className="font-bold text-sm mb-3">Additional Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Pay Rate</p>
                <p className="font-medium text-sm">{salary.pay_rate ? `${salary.currency} ${parseFloat(salary.pay_rate).toLocaleString()} / ${salary.pay_rate_period || "Monthly"}` : "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payout Frequency</p>
                <p className="font-medium text-sm">{salary.payout_frequency || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pay Group</p>
                <p className="font-medium text-sm">{salary.pay_group || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pay Method</p>
                <p className="font-medium text-sm flex items-center gap-1"><CreditCard className="h-3 w-3" /> {salary.pay_method || "Direct Deposit"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Eligible Work Hours</p>
                <p className="font-medium text-sm">{salary.eligible_work_hours || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Additional Details on Compensation</p>
                <p className="font-medium text-sm">{salary.additional_details || "-"}</p>
              </div>
            </div>
          </div>

          {salary.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Add Summary/Notes</p>
                <p className="text-sm">{salary.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Form dialog for adding/editing salary */
function AddSalaryDialog({ employeeId, open, onOpenChange }: { employeeId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    annualSalary: "", currency: "PKR", startDate: "", reason: "", payRate: "",
    payRatePeriod: "Monthly", payoutFrequency: "Monthly", payGroup: "", payMethod: "Direct Deposit",
    eligibleWorkHours: "", additionalDetails: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.annualSalary || !form.startDate) { toast.error("Annual salary and start date are required"); return; }
    setSaving(true);
    try {
      const resp = await fetch(`/api/compensation/${employeeId}/salary`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Salary details added");
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/salary`] });
      onOpenChange(false);
      setForm({ annualSalary: "", currency: "PKR", startDate: "", reason: "", payRate: "", payRatePeriod: "Monthly", payoutFrequency: "Monthly", payGroup: "", payMethod: "Direct Deposit", eligibleWorkHours: "", additionalDetails: "", notes: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Salary Revision</DialogTitle>
          <DialogDescription>This will become the current salary and previous entries will be marked as history.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Annual Salary *</Label>
            <Input type="number" placeholder="e.g. 840000" value={form.annualSalary} onChange={(e) => setForm({ ...form, annualSalary: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PKR">PKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date *</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New Inductee">New Inductee</SelectItem>
                <SelectItem value="Annual Appraisal">Annual Appraisal</SelectItem>
                <SelectItem value="Promotion">Promotion</SelectItem>
                <SelectItem value="Salary Correction">Salary Correction</SelectItem>
                <SelectItem value="Probation Completion">Probation Completion</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pay Rate</Label>
            <Input type="number" placeholder="e.g. 70000" value={form.payRate} onChange={(e) => setForm({ ...form, payRate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Pay Rate Period</Label>
            <Select value={form.payRatePeriod} onValueChange={(v) => setForm({ ...form, payRatePeriod: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Hourly">Hourly</SelectItem>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payout Frequency</Label>
            <Select value={form.payoutFrequency} onValueChange={(v) => setForm({ ...form, payoutFrequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">Monthly</SelectItem>
                <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pay Method</Label>
            <Select value={form.payMethod} onValueChange={(v) => setForm({ ...form, payMethod: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Direct Deposit">Direct Deposit</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pay Group</Label>
            <Input placeholder="e.g. Pakistan Monthly Payroll" value={form.payGroup} onChange={(e) => setForm({ ...form, payGroup: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Eligible Work Hours</Label>
            <Input placeholder="e.g. 9 Per Day" value={form.eligibleWorkHours} onChange={(e) => setForm({ ...form, eligibleWorkHours: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Additional Details on Compensation</Label>
            <Input placeholder="e.g. Base: 63000 Fuel: 7000 probation End: 2 May 2026" value={form.additionalDetails} onChange={(e) => setForm({ ...form, additionalDetails: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Summary / Notes</Label>
            <Textarea placeholder="Any notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Salary Details"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Form dialog for banking */
function AddBankDialog({ employeeId, open, onOpenChange }: { employeeId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ bankName: "", nameOnAccount: "", bankCode: "", accountNumber: "", iban: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.bankName || !form.nameOnAccount || !form.accountNumber) { toast.error("Bank name, account holder, and account number are required"); return; }
    setSaving(true);
    try {
      const resp = await fetch(`/api/compensation/${employeeId}/banking`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, isPrimary: true }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Banking details added");
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/banking`] });
      onOpenChange(false);
      setForm({ bankName: "", nameOnAccount: "", bankCode: "", accountNumber: "", iban: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Banking Details</DialogTitle>
          <DialogDescription>Employee bank account for salary disbursement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Bank Name *</Label>
            <Input placeholder="e.g. Meezan Bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Name As Per Bank Account *</Label>
            <Input placeholder="Account holder name" value={form.nameOnAccount} onChange={(e) => setForm({ ...form, nameOnAccount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bank Code</Label>
              <Input placeholder="e.g. 0030" value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Account Number *</Label>
              <Input placeholder="Account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input placeholder="e.g. PK71MEZN000030011417..." value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Banking Details"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Form dialog for bonus */
function AddBonusDialog({ employeeId, open, onOpenChange }: { employeeId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ bonusType: "", amount: "", currency: "PKR", bonusDate: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.bonusType || !form.amount || !form.bonusDate) { toast.error("Type, amount, and date are required"); return; }
    setSaving(true);
    try {
      const resp = await fetch(`/api/compensation/${employeeId}/bonuses`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Bonus added");
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/bonuses`] });
      onOpenChange(false);
      setForm({ bonusType: "", amount: "", currency: "PKR", bonusDate: "", notes: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Bonus</DialogTitle>
          <DialogDescription>Record a bonus for this employee.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Bonus Type *</Label>
            <Select value={form.bonusType} onValueChange={(v) => setForm({ ...form, bonusType: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Performance">Performance</SelectItem>
                <SelectItem value="Holiday">Holiday</SelectItem>
                <SelectItem value="Signing">Signing</SelectItem>
                <SelectItem value="Spot">Spot</SelectItem>
                <SelectItem value="Eid">Eid</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount *</Label>
            <Input type="number" placeholder="e.g. 50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PKR">PKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="AED">AED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" value={form.bonusDate} onChange={(e) => setForm({ ...form, bonusDate: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Bonus"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Form dialog for stock grant */
function AddStockGrantDialog({ employeeId, open, onOpenChange }: { employeeId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ units: "", grantDate: "", vestingSchedule: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.units || !form.grantDate) { toast.error("Units and grant date are required"); return; }
    setSaving(true);
    try {
      const resp = await fetch(`/api/compensation/${employeeId}/stock-grants`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ ...form, units: parseInt(form.units) }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      toast.success("Stock grant added");
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/stock-grants`] });
      onOpenChange(false);
      setForm({ units: "", grantDate: "", vestingSchedule: "", notes: "" });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Stock Grant</DialogTitle>
          <DialogDescription>Record stock/equity grant for this employee.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Units *</Label>
            <Input type="number" placeholder="e.g. 1000" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Grant Date *</Label>
            <Input type="date" value={form.grantDate} onChange={(e) => setForm({ ...form, grantDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vesting Schedule</Label>
            <Input placeholder="e.g. 4 years quarterly" value={form.vestingSchedule} onChange={(e) => setForm({ ...form, vestingSchedule: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Stock Grant"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================== MAIN COMPONENT =====================

export function CompensationTab({ employeeId, canEdit }: { employeeId?: string; canEdit: boolean }) {
  const queryClient = useQueryClient();

  // Dialog state
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showAddBonus, setShowAddBonus] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [viewSalary, setViewSalary] = useState<SalaryDetail | null>(null);

  // Queries
  const { data: salaries = [] } = useQuery<SalaryDetail[]>({
    queryKey: [`/api/compensation/${employeeId}/salary`],
    queryFn: async () => {
      const resp = await fetch(`/api/compensation/${employeeId}/salary`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!employeeId,
    placeholderData: keepPreviousData,
  });

  const { data: bankAccounts = [] } = useQuery<BankingDetail[]>({
    queryKey: [`/api/compensation/${employeeId}/banking`],
    queryFn: async () => {
      const resp = await fetch(`/api/compensation/${employeeId}/banking`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!employeeId,
    placeholderData: keepPreviousData,
  });

  const { data: bonusList = [] } = useQuery<Bonus[]>({
    queryKey: [`/api/compensation/${employeeId}/bonuses`],
    queryFn: async () => {
      const resp = await fetch(`/api/compensation/${employeeId}/bonuses`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!employeeId,
    placeholderData: keepPreviousData,
  });

  const { data: stockGrants = [] } = useQuery<StockGrant[]>({
    queryKey: [`/api/compensation/${employeeId}/stock-grants`],
    queryFn: async () => {
      const resp = await fetch(`/api/compensation/${employeeId}/stock-grants`, { credentials: "include" });
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: !!employeeId,
    placeholderData: keepPreviousData,
  });

  // Delete helpers
  const deleteSalary = async (id: string) => {
    if (!confirm("Delete this salary record?")) return;
    try {
      await fetch(`/api/compensation/salary/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/salary`] });
      toast.success("Salary record deleted");
    } catch { toast.error("Failed to delete"); }
  };
  const deleteBank = async (id: string) => {
    if (!confirm("Delete this bank account?")) return;
    try {
      await fetch(`/api/compensation/banking/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/banking`] });
      toast.success("Bank account deleted");
    } catch { toast.error("Failed to delete"); }
  };
  const deleteBonus = async (id: string) => {
    if (!confirm("Delete this bonus?")) return;
    try {
      await fetch(`/api/compensation/bonuses/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/bonuses`] });
      toast.success("Bonus deleted");
    } catch { toast.error("Failed to delete"); }
  };
  const deleteStock = async (id: string) => {
    if (!confirm("Delete this stock grant?")) return;
    try {
      await fetch(`/api/compensation/stock-grants/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: [`/api/compensation/${employeeId}/stock-grants`] });
      toast.success("Stock grant deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const currentSalary = salaries.find((s) => s.is_current === "true");
  const totalStockUnits = stockGrants.reduce((sum, g) => sum + Number(g.units), 0);

  if (!employeeId) return <TabsContent value="compensation"><p className="text-muted-foreground">No employee data.</p></TabsContent>;

  return (
    <TabsContent value="compensation" className="space-y-6">
      {/* ==================== SALARY DETAILS (top section, like Freshteams screenshot) ==================== */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Salary Details</CardTitle>
            <Lock className="h-3.5 w-3.5 text-red-400" />
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowAddSalary(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add New
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {salaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No salary records yet. {canEdit ? "Click 'Add New' to enter the first salary details." : "HR will add salary details."}
            </div>
          ) : (
            <div className="space-y-0">
              {/* Current salary as highlight card */}
              {currentSalary && (
                <div
                  className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200/60 cursor-pointer hover:shadow-md transition-shadow mb-4"
                  onClick={() => setViewSalary(currentSalary)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Current Salary (Annual)</p>
                      <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                        {formatCurrency(currentSalary.annual_salary, currentSalary.currency)}
                      </h2>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Effective: {formatDate(currentSalary.start_date)} {currentSalary.reason ? `- ${currentSalary.reason}` : ""}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-green-900/40 p-2 rounded-full shadow-sm">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-green-500 mt-3 underline">Click for breakdown details</p>
                </div>
              )}

              {/* Salary timeline / history */}
              {salaries.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">Salary History</h4>
                  <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-6 pl-6 pb-2">
                    {salaries.map((s, i) => {
                      const prevSalary = salaries[i + 1];
                      let change = "";
                      if (prevSalary) {
                        const pct = ((parseFloat(s.annual_salary) - parseFloat(prevSalary.annual_salary)) / parseFloat(prevSalary.annual_salary) * 100);
                        change = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
                      }
                      return (
                        <div key={s.id} className="relative group">
                          <div className={`absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${s.is_current === "true" ? "bg-green-500" : "bg-blue-500"}`} />
                          <div className="flex justify-between items-start">
                            <div
                              className="cursor-pointer hover:underline"
                              onClick={() => setViewSalary(s)}
                            >
                              <p className="font-bold text-sm">{formatCurrency(s.annual_salary, s.currency)}</p>
                              <p className="text-xs text-muted-foreground">{s.reason || "Salary entry"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-xs font-medium">{formatDate(s.start_date)}</p>
                                {change && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parseFloat(change) >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>{change}</span>
                                )}
                              </div>
                              {canEdit && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteSalary(s.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== BANKING DETAILS ==================== */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Banking Details</CardTitle>
            <Lock className="h-3.5 w-3.5 text-red-400" />
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowAddBank(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No banking details on record.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9">Bank Name</TableHead>
                  <TableHead className="h-9">Name As Per Bank Account</TableHead>
                  <TableHead className="h-9">Bank Code</TableHead>
                  <TableHead className="h-9">Account Number</TableHead>
                  {canEdit && <TableHead className="h-9 w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-sm font-medium">{b.bank_name}</TableCell>
                    <TableCell className="text-sm">{b.name_on_account}</TableCell>
                    <TableCell className="text-sm">{b.bank_code || "-"}</TableCell>
                    <TableCell className="text-sm font-mono">{b.account_number}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBank(b.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {bankAccounts.length > 0 && bankAccounts[0].iban && (
            <div className="mt-3 px-1">
              <p className="text-xs text-muted-foreground">IBAN</p>
              <p className="text-sm font-mono font-medium">{bankAccounts[0].iban}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== BONUSES + STOCK GRANTS (side by side) ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bonuses */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Bonuses</CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowAddBonus(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {bonusList.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No Records</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8">Date</TableHead>
                    <TableHead className="h-8">Type</TableHead>
                    <TableHead className="h-8 text-right">Amount</TableHead>
                    {canEdit && <TableHead className="h-8 w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusList.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs">{formatDate(b.bonus_date)}</TableCell>
                      <TableCell className="text-xs">{b.bonus_type}</TableCell>
                      <TableCell className="text-xs font-bold text-right">{formatCurrency(b.amount, b.currency)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteBonus(b.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stock Grants */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Stock Grants</CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowAddStock(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {stockGrants.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No Records</div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Units</p>
                    <p className="font-bold text-lg">{totalStockUnits.toLocaleString()}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8">Date</TableHead>
                      <TableHead className="h-8">Units</TableHead>
                      <TableHead className="h-8">Vesting</TableHead>
                      {canEdit && <TableHead className="h-8 w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockGrants.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="text-xs">{formatDate(g.grant_date)}</TableCell>
                        <TableCell className="text-xs font-bold">{Number(g.units).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{g.vesting_schedule || "-"}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteStock(g.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ==================== Dialogs ==================== */}
      <SalaryDetailDialog salary={viewSalary} open={!!viewSalary} onOpenChange={(v) => !v && setViewSalary(null)} />
      {employeeId && <AddSalaryDialog employeeId={employeeId} open={showAddSalary} onOpenChange={setShowAddSalary} />}
      {employeeId && <AddBankDialog employeeId={employeeId} open={showAddBank} onOpenChange={setShowAddBank} />}
      {employeeId && <AddBonusDialog employeeId={employeeId} open={showAddBonus} onOpenChange={setShowAddBonus} />}
      {employeeId && <AddStockGrantDialog employeeId={employeeId} open={showAddStock} onOpenChange={setShowAddStock} />}
    </TabsContent>
  );
}
