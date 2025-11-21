import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Receipt, DollarSign, Plus, Check, X, Filter, FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const expenses = [
  { id: 1, user: "John Wick", description: "Client Dinner", amount: 245.00, category: "Meals", date: "Nov 20", status: "Pending", img: "https://github.com/shadcn.png" },
  { id: 2, user: "Trinity Moss", description: "Figma Subscription", amount: 45.00, category: "Software", date: "Nov 18", status: "Approved", img: "https://github.com/shadcn.png" },
  { id: 3, user: "Neo Anderson", description: "AWS Server Costs", amount: 1250.00, category: "Infrastructure", date: "Nov 15", status: "Approved", img: "https://github.com/shadcn.png" },
  { id: 4, user: "Sarah Connor", description: "Team Offsite", amount: 850.00, category: "Events", date: "Nov 12", status: "Rejected", img: "https://github.com/shadcn.png" },
];

export default function Expenses() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Expense Reimbursement</h1>
          <p className="text-slate-500 text-sm">Track, approve, and manage company spending.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> New Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Pending Approval</p>
            <h3 className="text-3xl font-bold text-slate-900">$245.00</h3>
            <p className="text-xs text-orange-600 mt-2 font-medium">3 requests waiting</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">This Month</p>
            <h3 className="text-3xl font-bold text-slate-900">$4,285.00</h3>
            <p className="text-xs text-green-600 mt-2 font-medium">+12% vs last month</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Avg Processing</p>
            <h3 className="text-3xl font-bold text-slate-900">1.5 Days</h3>
            <p className="text-xs text-blue-600 mt-2 font-medium">Within SLA</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
          <CardTitle>Recent Requests</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-3 w-3 mr-2" /> Status
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <FileText className="h-3 w-3 mr-2" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={expense.img} />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{expense.description}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{expense.user}</span>
                      <span>•</span>
                      <span>{expense.category}</span>
                      <span>•</span>
                      <span>{expense.date}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className="font-bold text-slate-900 w-20 text-right">${expense.amount.toFixed(2)}</span>
                  <Badge className={`w-24 justify-center
                    ${expense.status === 'Approved' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                      expense.status === 'Rejected' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 
                      'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}
                  `}>
                    {expense.status}
                  </Badge>
                  <div className="flex gap-1">
                    {expense.status === 'Pending' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                      <Receipt className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
