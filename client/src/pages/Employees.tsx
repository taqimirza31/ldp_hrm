import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal, Mail, Phone, MapPin, Users, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const employees = [
  { id: 1, name: "Neo Anderson", role: "Software Architect", dept: "Engineering", status: "Active", location: "New York", email: "neo@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 2, name: "Trinity Moss", role: "Product Manager", dept: "Product", status: "On Leave", location: "Remote", email: "trinity@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 3, name: "Morpheus King", role: "VP of Operations", dept: "Operations", status: "Active", location: "Zion", email: "morpheus@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 4, name: "Cypher Reagan", role: "Frontend Dev", dept: "Engineering", status: "Terminated", location: "Remote", email: "cypher@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 5, name: "Agent Smith", role: "Security Lead", dept: "Security", status: "Active", location: "Mainframe", email: "smith@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 6, name: "Oracle Jones", role: "HR Specialist", dept: "HR", status: "Active", location: "New York", email: "oracle@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 7, name: "Tank Dozer", role: "DevOps Engineer", dept: "Infrastructure", status: "Active", location: "Nebuchadnezzar", email: "tank@matrix.com", img: "https://github.com/shadcn.png" },
  { id: 8, name: "Switch Apoc", role: "UI Designer", dept: "Design", status: "Active", location: "Remote", email: "switch@matrix.com", img: "https://github.com/shadcn.png" },
];

export default function Employees() {
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
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            Add New Employee
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name, role, or ID..." 
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="w-full md:w-48">
             <Select>
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eng">Engineering</SelectItem>
                <SelectItem value="prod">Product</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
             <Select>
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {employees.map((employee) => (
          <div key={employee.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
            <div className="h-20 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-100 relative">
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-white/50">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="px-6 pb-6">
              <div className="relative -mt-10 mb-4 flex justify-between items-end">
                <Avatar className="h-20 w-20 border-4 border-white shadow-sm">
                  <AvatarImage src={employee.img} />
                  <AvatarFallback>NA</AvatarFallback>
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
                  {employee.dept}
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
