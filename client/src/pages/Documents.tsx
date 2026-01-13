import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, FileText, MoreHorizontal, Search, Upload, Download, Clock, Shield, Filter, AlertTriangle, User, Briefcase, GraduationCap, Lock, Bell } from "lucide-react";

const structuredFolders = [
  { id: "personal", name: "Personal Documents", count: 12, icon: User, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "official", name: "Official/Legal", count: 8, icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "education", name: "Education & Certs", count: 5, icon: GraduationCap, color: "text-green-600", bg: "bg-green-50" },
  { id: "confidential", name: "Confidential HR", count: 3, icon: Lock, color: "text-red-600", bg: "bg-red-50" },
];

const expiringDocs = [
  { id: 1, name: "Passport - Sarah Connor", type: "Personal", expiry: "Expires in 15 days", urgency: "critical", owner: "Sarah Connor" },
  { id: 2, name: "Visa - Neo Anderson", type: "Official", expiry: "Expires in 28 days", urgency: "warning", owner: "Neo Anderson" },
  { id: 3, name: "Security Clearance", type: "Official", expiry: "Expires in 45 days", urgency: "low", owner: "John Wick" },
];

const recentDocs = [
  { name: "Employee Handbook 2026.pdf", size: "2.4 MB", type: "PDF", date: "2 hours ago", author: "Sarah Connor", folder: "Official" },
  { name: "Masters Degree.pdf", size: "4.1 MB", type: "PDF", date: "5 hours ago", author: "Morpheus King", folder: "Education" },
  { name: "CNIC Copy.jpg", size: "1.2 MB", type: "Image", date: "1 day ago", author: "Neo Anderson", folder: "Personal" },
  { name: "Offer Letter.pdf", size: "145 KB", type: "PDF", date: "2 days ago", author: "Sarah Connor", folder: "Confidential" },
];

export default function Documents() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Document Vault</h1>
          <p className="text-slate-500 text-sm">Secure centralized storage with automated compliance alerts.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search documents..." className="pl-9 w-64 bg-white" />
          </div>
          <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
            <Upload className="h-4 w-4 mr-2" /> Upload File
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Alerts Section */}
        <Card className="border border-red-100 bg-red-50/30 shadow-sm lg:col-span-3">
           <CardHeader className="pb-3">
             <div className="flex items-center gap-2">
               <AlertTriangle className="h-5 w-5 text-red-600" />
               <CardTitle className="text-red-900 text-base">Compliance Alerts: Expiring Documents</CardTitle>
             </div>
           </CardHeader>
           <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {expiringDocs.map((doc) => (
                 <div key={doc.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex items-start justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm mb-1">{doc.name}</p>
                      <p className="text-xs text-slate-500 mb-2">Owned by {doc.owner}</p>
                      <Badge variant="outline" className={`${doc.urgency === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                        {doc.expiry}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                      <Bell className="h-4 w-4" />
                    </Button>
                 </div>
               ))}
             </div>
           </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6 bg-slate-100">
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="official">Official</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-0 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {structuredFolders.map((folder) => (
              <Card key={folder.id} className="border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${folder.bg} ${folder.color}`}>
                      <folder.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{folder.name}</h3>
                      <p className="text-xs text-slate-500">{folder.count} files</p>
                    </div>
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Files</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-slate-500">
                  <Filter className="h-4 w-4 mr-2" /> Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentDocs.map((doc, i) => (
                  <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-100 rounded text-slate-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600">{doc.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{doc.folder}</span>
                          <span>•</span>
                          <span>{doc.size}</span>
                          <span>•</span>
                          <span>{doc.author}</span>
                          <span>•</span>
                          <span>{doc.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Placeholder contents for other tabs */}
        <TabsContent value="personal">
           <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
             <Folder className="h-10 w-10 mx-auto mb-2 opacity-20" />
             <p>Personal documents view filtered here.</p>
           </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
