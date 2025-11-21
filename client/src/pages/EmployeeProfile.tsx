import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, Phone, MapPin, Calendar, Briefcase, Building, 
  Download, Share2, Star, Clock, Shield, Award 
} from "lucide-react";
import { Link, useRoute } from "wouter";

export default function EmployeeProfile() {
  const [match, params] = useRoute("/employees/:id");
  // In a real app, fetch data based on params.id

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/employees">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-slate-500 hover:text-slate-900">
            ← Back to Directory
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
              <div className="absolute -bottom-12 left-6">
                <Avatar className="h-24 w-24 border-4 border-white shadow-sm">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>SC</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <CardContent className="pt-16 pb-6 px-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Sarah Connor</h2>
                  <p className="text-blue-600 font-medium">Product Director</p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-slate-600">
                  <Building className="h-4 w-4 mr-3 text-slate-400" />
                  Product Department
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <MapPin className="h-4 w-4 mr-3 text-slate-400" />
                  San Francisco, CA (Hybrid)
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="h-4 w-4 mr-3 text-slate-400" />
                  sarah.connor@admani.com
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Phone className="h-4 w-4 mr-3 text-slate-400" />
                  +1 (555) 123-4567
                </div>
                <div className="flex items-center text-sm text-slate-600">
                  <Calendar className="h-4 w-4 mr-3 text-slate-400" />
                  Joined Oct 12, 2020 (4y 1m)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full bg-primary text-white hover:bg-blue-700">Message</Button>
                <Button variant="outline" className="w-full border-slate-200">Schedule</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-slate-900">Direct Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>DR</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">John Doe</p>
                    <p className="text-xs text-slate-500 truncate">Senior Product Manager</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-slate-100 p-1 mb-6 w-full justify-start">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Documents</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
              <TabsTrigger value="timeoff" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Time Off</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Performance</p>
                    <p className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-1">
                      4.9 <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Projects</p>
                    <p className="text-2xl font-bold text-slate-900">12</p>
                  </CardContent>
                </Card>
                <Card className="border border-slate-200 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">PTO Balance</p>
                    <p className="text-2xl font-bold text-slate-900">14d</p>
                  </CardContent>
                </Card>
              </div>

              {/* Skills */}
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Skills & Competencies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {["Product Strategy", "Agile Methodology", "User Research", "Leadership", "Figma", "Jira", "Data Analysis"].map((skill) => (
                      <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Onboarding Progress (if relevant) */}
              <Card className="border border-slate-200 shadow-sm">
                 <CardHeader>
                  <CardTitle>Compliance Training</CardTitle>
                  <CardDescription>Mandatory annual security and policy training.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700">Data Privacy 2025</span>
                      <span className="text-green-600 font-medium">Completed</span>
                    </div>
                    <Progress value={100} className="h-2 bg-slate-100" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700">Workplace Safety</span>
                      <span className="text-slate-500">In Progress (45%)</span>
                    </div>
                    <Progress value={45} className="h-2 bg-slate-100" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Employment Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { name: "Employment Contract.pdf", date: "Oct 12, 2020" },
                    { name: "NDA Signed.pdf", date: "Oct 12, 2020" },
                    { name: "Tax Form W-4.pdf", date: "Jan 15, 2024" },
                    { name: "Offer Letter.pdf", date: "Sep 28, 2020" }
                  ].map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-50 text-red-600 p-2 rounded">
                          <FileTextIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                          <p className="text-xs text-slate-500">Uploaded {doc.date}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}

function FileTextIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}
