import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Clock, Shield, AlertTriangle, User } from "lucide-react";

const logs = [
  { id: "LOG-9821", action: "User Login", user: "Sarah Connor", ip: "192.168.1.12", time: "2 mins ago", status: "Success", severity: "Low" },
  { id: "LOG-9820", action: "Payroll Approved", user: "Morpheus King", ip: "10.0.0.5", time: "15 mins ago", status: "Success", severity: "High" },
  { id: "LOG-9819", action: "Failed Login Attempt", user: "Unknown", ip: "45.22.19.11", time: "1 hour ago", status: "Failed", severity: "Critical" },
  { id: "LOG-9818", action: "Document Uploaded", user: "Neo Anderson", ip: "192.168.1.15", time: "2 hours ago", status: "Success", severity: "Low" },
  { id: "LOG-9817", action: "Role Changed", user: "Admin System", ip: "Localhost", time: "5 hours ago", status: "Success", severity: "Medium" },
];

export default function Audit() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Audit Logs</h1>
          <p className="text-slate-500 text-sm">Security timeline and system activity tracking.</p>
        </div>
        <Button variant="outline" className="bg-white border-slate-200 text-slate-700">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search logs by user, action, or IP..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 font-mono text-slate-500">{log.time}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                    <td className="px-4 py-3 flex items-center gap-2 text-slate-700">
                      <User className="h-3 w-3 text-slate-400" /> {log.user}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{log.ip}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`
                        ${log.status === 'Success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
                      `}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant="outline" className={`
                        ${log.severity === 'Critical' ? 'border-red-200 text-red-600 bg-red-50' : 
                          log.severity === 'High' ? 'border-orange-200 text-orange-600 bg-orange-50' : 
                          'border-slate-200 text-slate-600 bg-slate-50'}
                      `}>
                        {log.severity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
