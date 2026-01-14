import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Clock, ArrowRight, Briefcase } from "lucide-react";
import { Link } from "wouter";

const jobs = [
  { id: 1, title: "Senior Frontend Engineer", dept: "Engineering", loc: "San Francisco, CA", type: "Full-time", posted: "2 days ago" },
  { id: 2, title: "Product Designer", dept: "Design", loc: "Remote", type: "Full-time", posted: "1 week ago" },
  { id: 3, title: "Marketing Manager", dept: "Marketing", loc: "New York, NY", type: "Full-time", posted: "3 days ago" },
  { id: 4, title: "HR Specialist", dept: "Human Resources", loc: "Austin, TX", type: "Part-time", posted: "Just now" },
  { id: 5, title: "Backend Developer (Go)", dept: "Engineering", loc: "Remote", type: "Contract", posted: "5 days ago" },
];

export default function CareerSite() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg font-bold">AL</div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">Admani Logistics</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-blue-600">About Us</a>
            <a href="#" className="hover:text-blue-600">Life at Admani</a>
            <a href="#" className="hover:text-blue-600">Teams</a>
            <a href="#" className="hover:text-blue-600">Benefits</a>
          </div>
          <Button>View Open Roles</Button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-slate-900 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 z-0"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30 mb-6 px-4 py-1.5">We are hiring!</Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Build the future of logistics.</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Join a team of visionaries, engineers, and creators working together to solve the world's most complex supply chain challenges.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                placeholder="Search for roles..." 
                className="pl-10 h-12 bg-white text-slate-900 border-0 focus-visible:ring-0" 
              />
            </div>
            <Button size="lg" className="h-12 px-8 bg-blue-600 hover:bg-blue-700">Find Jobs</Button>
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Open Positions</h2>
            <p className="text-slate-500 mt-2">Current opportunities to join our team.</p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm">Filter by Dept</Button>
             <Button variant="outline" size="sm">Filter by Location</Button>
          </div>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:border-blue-300 transition-colors group cursor-pointer">
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                    {job.title}
                    {job.posted === "Just now" && <Badge className="bg-green-500 hover:bg-green-600 text-xs">New</Badge>}
                  </h3>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {job.dept}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {job.loc}</span>
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {job.type}</span>
                  </div>
                </div>
                <Button className="shrink-0" variant="outline">Apply Now <ArrowRight className="h-4 w-4 ml-2" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-sm">© 2026 Admani Logistics. All rights reserved.</p>
          <div className="flex gap-6 text-slate-400">
             <a href="#" className="hover:text-slate-600">Privacy Policy</a>
             <a href="#" className="hover:text-slate-600">Terms of Service</a>
             <a href="#" className="hover:text-slate-600">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}