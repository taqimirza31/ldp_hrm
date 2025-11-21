import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal, Mail, Phone, MapPin, Users } from "lucide-react";

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
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Employee Directory</h1>
          <p className="text-muted-foreground font-tech">Manage your workforce across the galaxy.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search employees..." 
              className="pl-9 bg-white/5 border-white/10 w-64 focus:border-primary/50 focus:bg-white/10 text-white placeholder:text-muted-foreground/50 font-tech"
            />
          </div>
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-primary">
            <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold font-tech uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            Add New
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {employees.map((employee) => (
          <div key={employee.id} className="glass-panel rounded-xl p-6 flex flex-col items-center relative group hover:border-primary/30 transition-all duration-300">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative mb-4">
              <Avatar className="h-24 w-24 border-2 border-white/10 group-hover:border-primary transition-colors duration-300 shadow-lg">
                <AvatarImage src={employee.img} />
                <AvatarFallback>NA</AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background ${
                employee.status === 'Active' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 
                employee.status === 'Terminated' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
            </div>

            <h3 className="text-lg font-display font-bold text-white mb-1">{employee.name}</h3>
            <p className="text-primary font-tech text-sm uppercase tracking-wider mb-4">{employee.role}</p>

            <div className="w-full space-y-3 mb-6">
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-2 text-accent" />
                {employee.location}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Mail className="h-3 w-3 mr-2 text-accent" />
                {employee.email}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="h-3 w-3 mr-2 text-accent" />
                {employee.dept}
              </div>
            </div>

            <div className="mt-auto w-full pt-4 border-t border-white/5 flex gap-2">
              <Button variant="ghost" className="flex-1 text-xs font-tech uppercase text-muted-foreground hover:text-white hover:bg-white/5">
                Profile
              </Button>
              <Button variant="ghost" className="flex-1 text-xs font-tech uppercase text-primary hover:text-primary hover:bg-primary/10">
                Message
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
