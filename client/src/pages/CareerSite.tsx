import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Clock, ArrowRight, Briefcase, ChevronRight, PlayCircle, CheckCircle2, Globe, Users, TrendingUp, Zap } from "lucide-react";

const jobs = [
  { id: 1, title: "Senior Frontend Engineer", dept: "Engineering", loc: "San Francisco, CA", type: "Full-time", posted: "2 days ago", tags: ["React", "TypeScript", "Tailwind"] },
  { id: 2, title: "Product Designer", dept: "Design", loc: "Remote", type: "Full-time", posted: "1 week ago", tags: ["Figma", "UI/UX", "Design Systems"] },
  { id: 3, title: "Marketing Manager", dept: "Marketing", loc: "New York, NY", type: "Full-time", posted: "3 days ago", tags: ["Growth", "SEO", "Content"] },
  { id: 4, title: "HR Specialist", dept: "Human Resources", loc: "Austin, TX", type: "Part-time", posted: "Just now", tags: ["Recruiting", "Culture"] },
  { id: 5, title: "Backend Developer (Go)", dept: "Engineering", loc: "Remote", type: "Contract", posted: "5 days ago", tags: ["Go", "PostgreSQL", "AWS"] },
];

export default function CareerSite() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg font-bold tracking-tight">AL</div>
            <span className="font-bold text-xl tracking-tight">Admani Logistics</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-blue-600 transition-colors">Our Mission</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Teams</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Benefits</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Life at Admani</a>
          </div>
          <div className="flex items-center gap-4">
             <a href="#" className="hidden md:block text-sm font-medium text-slate-600 hover:text-blue-600">Login</a>
             <Button className="rounded-full px-6 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20">View Roles</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 py-32 lg:py-48">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
            <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[80%] rounded-full bg-blue-600 blur-[120px]"></div>
            <div className="absolute top-[40%] -left-[10%] w-[40%] h-[60%] rounded-full bg-purple-600 blur-[100px]"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-blue-200 text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            We're hiring across all roles!
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-8 max-w-4xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Shape the future of <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">global logistics.</span>
          </h1>
          
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Join a team of visionaries, engineers, and creators working together to solve the world's most complex supply chain challenges.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
             <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search for roles (e.g. Engineer)" 
                  className="w-full h-14 pl-12 pr-4 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xl"
                />
             </div>
             <Button size="lg" className="h-14 px-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg shadow-lg shadow-blue-600/30 transition-all hover:scale-105">
                Search Jobs
             </Button>
          </div>
        </div>
      </div>

      {/* Stats / Social Proof */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { label: "Employees", value: "2,500+" },
                { label: "Countries", value: "35+" },
                { label: "Funding", value: "$120M" },
                { label: "Glassdoor", value: "4.8/5" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Admani?</h2>
            <p className="text-lg text-slate-500">We take care of our people so they can take care of the world. Our benefits are designed to support you at every stage of life.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: "Remote-First", desc: "Work from anywhere in the world. We believe in output, not hours." },
              { icon: TrendingUp, title: "Growth Budget", desc: "$2,000 annual stipend for courses, conferences, and books." },
              { icon: Users, title: "Health & Wellness", desc: "Comprehensive health coverage and monthly wellness allowance." },
              { icon: Zap, title: "Cutting Edge Tech", desc: "Latest MacBook Pro and budget for your perfect home office setup." },
              { icon: CheckCircle2, title: "Flexible Time Off", desc: "Unlimited PTO policy with a mandatory minimum of 3 weeks." },
              { icon: PlayCircle, title: "Team Retreats", desc: "Bi-annual company-wide retreats in exotic locations." },
            ].map((benefit, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-8">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                    <benefit.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                  <p className="text-slate-500 leading-relaxed">
                    {benefit.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Job Listings */}
      <div className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Open Positions</h2>
              <p className="text-slate-500">Find your next role at Admani.</p>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" className="rounded-full">All Departments</Button>
               <Button variant="outline" className="rounded-full">All Locations</Button>
            </div>
          </div>

          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {job.title}
                      </h3>
                      {job.posted === "Just now" && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">New</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
                      <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {job.dept}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {job.loc}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {job.type}</span>
                    </div>
                    <div className="flex gap-2">
                      {job.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="h-10 w-10 rounded-full bg-slate-50 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all duration-300">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <Button variant="outline" size="lg" className="rounded-full px-8">View All Openings</Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
               <div className="flex items-center gap-2 mb-6">
                <div className="bg-blue-600 text-white p-1 rounded font-bold">AL</div>
                <span className="font-bold text-xl text-white tracking-tight">Admani Logistics</span>
              </div>
              <p className="max-w-sm mb-6">
                Revolutionizing the global supply chain through technology, innovation, and a people-first approach.
              </p>
              <div className="flex gap-4">
                {/* Social icons would go here */}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Press</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Resources</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Engineering</a></li>
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p>© 2026 Admani Logistics. All rights reserved.</p>
            <div className="flex gap-6">
               <a href="#" className="hover:text-white">Privacy Policy</a>
               <a href="#" className="hover:text-white">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}