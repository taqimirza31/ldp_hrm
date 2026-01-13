import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DollarSign, FileText, CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { useStore, Loan } from "@/store/useStore";
import { toast } from "sonner";

export default function Loans() {
  const { loans, addLoan } = useStore();
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<Loan['type']>("Personal Loan");
  const [tenure, setTenure] = useState("");
  const [reason, setReason] = useState("");

  const handleRequest = () => {
    if (!amount || !tenure || !reason) {
      toast.error("Please fill in all details");
      return;
    }

    addLoan({
      userId: 1, // Mock user ID
      type,
      amount: Number(amount),
      paid: 0,
      tenure: Number(tenure),
      interest: type === "Personal Loan" ? 5 : 0,
      status: "Pending",
      startDate: new Date().toISOString().split('T')[0],
      monthlyEmi: Number(amount) / Number(tenure),
      reason
    });

    toast.success("Loan request submitted for approval");
    setIsRequestOpen(false);
    setAmount("");
    setTenure("");
    setReason("");
  };

  const activeLoans = loans.filter(l => l.status === 'Active');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.amount - l.paid), 0);
  const nextEmi = activeLoans.reduce((sum, l) => sum + l.monthlyEmi, 0);

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Loans & Advances</h1>
          <p className="text-muted-foreground text-sm">Manage employee loans, EMI schedules, and salary advances.</p>
        </div>
        <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Request Loan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request New Loan / Advance</DialogTitle>
              <DialogDescription>Apply for a company loan or salary advance. Subject to approval.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select value={type} onValueChange={(val: Loan['type']) => setType(val)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal Loan">Personal Loan</SelectItem>
                    <SelectItem value="Salary Advance">Salary Advance</SelectItem>
                    <SelectItem value="Equipment Loan">Equipment Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Amount ($)</Label>
                <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-3" placeholder="5000" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tenure" className="text-right">Tenure (Months)</Label>
                <Input id="tenure" type="number" value={tenure} onChange={e => setTenure(e.target.value)} className="col-span-3" placeholder="12" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="reason" className="text-right">Reason</Label>
                <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} className="col-span-3" placeholder="Medical emergency, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRequest}>Submit Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-none">
          <CardContent className="p-6">
             <div className="flex justify-between items-start mb-4">
               <div>
                 <p className="text-blue-100 text-sm font-medium">Total Outstanding</p>
                 <h3 className="text-3xl font-bold mt-1">${totalOutstanding.toLocaleString()}</h3>
               </div>
               <div className="bg-white/20 p-2 rounded-lg">
                 <DollarSign className="h-6 w-6 text-white" />
               </div>
             </div>
             <div className="flex gap-4 text-sm text-blue-100">
               <div>
                 <span className="block opacity-70 text-xs">Next EMI Total</span>
                 <span className="font-bold">${nextEmi.toFixed(2)}</span>
               </div>
               <div>
                 <span className="block opacity-70 text-xs">Due Date</span>
                 <span className="font-bold">Dec 01, 2024</span>
               </div>
             </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4">Loan Eligibility</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Max Limit</span>
                  <span className="font-bold text-foreground">$15,000</span>
                </div>
                <Progress value={((totalOutstanding + 2000) / 15000) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">You can avail up to ${(15000 - totalOutstanding).toLocaleString()} more based on your tenure and salary.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Active Loans</p>
                <p className="text-xl font-bold text-foreground">{activeLoans.length}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Completed</p>
                <p className="text-xl font-bold text-foreground">{loans.filter(l => l.status === 'Completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-lg text-foreground">My Loans</h3>
        {loans.map((loan) => (
          <Card key={loan.id} className="border border-border shadow-sm hover:border-primary/50 transition-colors group">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${loan.type === 'Personal Loan' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'}`}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-lg">{loan.type}</h4>
                    <p className="text-sm text-muted-foreground">ID: LN-{2024000 + loan.id} • {loan.interest}% Interest</p>
                    <div className="flex gap-2 mt-2">
                       <Badge variant="outline" className={loan.status === 'Active' ? 'bg-green-500/10 text-green-700 border-green-200' : 'bg-yellow-500/10 text-yellow-700 border-yellow-200'}>
                         {loan.status}
                       </Badge>
                       <span className="text-xs flex items-center text-muted-foreground">
                         <Clock className="h-3 w-3 mr-1" /> {loan.startDate}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-1 min-w-[150px]">
                   <p className="text-sm text-muted-foreground">Principal Amount</p>
                   <p className="text-2xl font-bold text-foreground">${loan.amount.toLocaleString()}</p>
                </div>

                <div className="flex flex-col gap-2 min-w-[200px]">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Repayment Progress</span>
                    <span className="text-foreground">{Math.round((loan.paid / loan.amount) * 100)}%</span>
                  </div>
                  <Progress value={(loan.paid / loan.amount) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">${loan.paid.toLocaleString()} paid of ${loan.amount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}