import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal, Mail, Phone, MapPin, Users, Download, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, Employee } from "@/store/useStore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function Employees() {
  const { employees, addEmployee, deleteEmployee } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form State
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    name: "",
    role: "",
    department: "",
    email: "",
    location: "",
    status: "Active",
    joinDate: new Date().toISOString().split('T')[0],
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
  });

  const handleAddEmployee = () => {
    if (!newEmployee.name || !newEmployee.role || !newEmployee.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    addEmployee({
      name: newEmployee.name!,
      role: newEmployee.role!,
      department: newEmployee.department || "Engineering",
      email: newEmployee.email!,
      location: newEmployee.location || "Remote",
      status: (newEmployee.status as any) || "Active",
      joinDate: newEmployee.joinDate || new Date().toISOString().split('T')[0],
      avatar: newEmployee.avatar
    });

    toast.success("Employee added successfully");
    setIsAddDialogOpen(false);
    setNewEmployee({
      name: "",
      role: "",
      department: "",
      email: "",
      location: "",
      status: "Active",
      joinDate: new Date().toISOString().split('T')[0],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`
    });
  };

  const handleDeleteEmployee = (id: number) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      deleteEmployee(id);
      toast.success("Employee deleted");
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === "all" || emp.department === departmentFilter;
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Employee Directory</h1>
          <p className="text-slate-500 text-sm">Manage your workforce and view profiles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
                <Plus className="h-4 w-4 mr-2" /> Add New Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Enter the details of the new team member. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Role</Label>
                  <Input id="role" value={newEmployee.role} onChange={e => setNewEmployee({...newEmployee, role: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="department" className="text-right">Dept</Label>
                  <Select onValueChange={(val) => setNewEmployee({...newEmployee, department: val})}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddEmployee}>Save Employee</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name, role, or ID..." 
              className="pl-9 bg-slate-50 border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
             <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
            <div className="h-20 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-100 relative">
              <div className="absolute top-2 right-2 flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-white/50" onClick={() => handleDeleteEmployee(employee.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-white/50">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="px-6 pb-6">
              <div className="relative -mt-10 mb-4 flex justify-between items-end">
                <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <Badge variant="outline" className={`
                  ${employee.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 
                    employee.status === 'Terminated' ? 'bg-red-50 text-red-700 border-red-200' : 
                    'bg-yellow-50 text-yellow-700 border-yellow-200'}
                `}>
                  {employee.status}
                </Badge>
              </div>

              <h3 className="text-lg font-bold text-slate-900">{employee.name}</h3>
              <p className="text-blue-600 text-sm font-medium mb-4">{employee.role}</p>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5 mr-2.5 text-slate-400" />
                  {employee.location}
                </div>
                <div className="flex items-center text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5 mr-2.5 text-slate-400" />
                  {employee.email}
                </div>
                <div className="flex items-center text-sm text-slate-500">
                  <Users className="h-3.5 w-3.5 mr-2.5 text-slate-400" />
                  {employee.department}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-9">
                  View Profile
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
