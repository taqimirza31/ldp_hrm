import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, MoreHorizontal, Search, Upload, Download, Clock, Shield, Filter } from "lucide-react";

const folders = [
  { name: "Company Policies", count: 12, color: "bg-blue-100 text-blue-600" },
  { name: "Employee Contracts", count: 148, color: "bg-purple-100 text-purple-600" },
  { name: "Tax Forms 2025", count: 45, color: "bg-green-100 text-green-600" },
  { name: "Onboarding Materials", count: 8, color: "bg-orange-100 text-orange-600" },
];

const recentDocs = [
  { name: "Employee Handbook 2025.pdf", size: "2.4 MB", type: "PDF", date: "2 hours ago", author: "Sarah Connor" },
  { name: "Q1 Financial Report.xlsx", size: "856 KB", type: "Excel", date: "5 hours ago", author: "Morpheus King" },
  { name: "Security Protocol v2.docx", size: "1.2 MB", type: "Word", date: "1 day ago", author: "Neo Anderson" },
  { name: "Holiday Schedule.pdf", size: "145 KB", type: "PDF", date: "2 days ago", author: "Sarah Connor" },
  { name: "Insurance Benefits Guide.pdf", size: "3.8 MB", type: "PDF", date: "3 days ago", author: "Admin System" },
];

export default function Documents() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Document Vault</h1>
          <p className="text-slate-500 text-sm">Secure centralized storage for company assets.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {folders.map((folder) => (
          <Card key={folder.name} className="border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${folder.color}`}>
                  <Folder className="h-6 w-6" />
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
          <CardTitle className="text-lg">Recent Uploads</CardTitle>
          <Button variant="ghost" size="sm" className="text-slate-500">
            <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
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
    </Layout>
  );
}
