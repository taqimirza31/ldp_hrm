import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Download, Play, Square, Fingerprint, Wifi, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const weekDays = ["Mon 18", "Tue 19", "Wed 20", "Thu 21", "Fri 22", "Sat 23", "Sun 24"];

const entries = [
  { day: "Mon 18", start: "09:00", end: "17:00", break: "1h", total: "7h", source: "Biometric Device A" },
  { day: "Tue 19", start: "09:15", end: "17:30", break: "45m", total: "7.5h", source: "Biometric Device A" },
  { day: "Wed 20", start: "08:50", end: "17:00", break: "1h", total: "7.2h", source: "Biometric Device B" },
  { day: "Thu 21", start: "--:--", end: "--:--", break: "-", total: "0h", source: "-" },
  { day: "Fri 22", start: "--:--", end: "--:--", break: "-", total: "0h", source: "-" },
];

const devices = [
  { id: 1, name: "Main Entrance Scanner", status: "Online", lastSync: "2 mins ago", location: "Lobby" },
  { id: 2, name: "Warehouse Biometric", status: "Online", lastSync: "1 min ago", location: "Warehouse B" },
  { id: 3, name: "Exec Floor Scanner", status: "Offline", lastSync: "4 hours ago", location: "Level 4" },
];

export default function Timesheets() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Time & Attendance</h1>
          <p className="text-slate-500 text-sm">Biometric integration and shift tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" /> Attendance Report
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
            <Play className="h-4 w-4 mr-2" /> Manual Clock In
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Biometric Devices Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {devices.map((device) => (
               <Card key={device.id} className="border border-slate-200 shadow-sm">
                 <CardContent className="p-4 flex flex-col justify-between h-full">
                   <div className="flex justify-between items-start mb-2">
                     <Fingerprint className="h-5 w-5 text-slate-400" />
                     <Badge variant="outline" className={device.status === 'Online' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
                       {device.status}
                     </Badge>
                   </div>
                   <div>
                     <p className="font-bold text-slate-900 text-sm">{device.name}</p>
                     <div className="flex items-center text-xs text-slate-500 mt-1">
                       <Wifi className="h-3 w-3 mr-1" /> {device.lastSync}
                     </div>
                   </div>
                 </CardContent>
               </Card>
             ))}
          </div>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>My Attendance Log</CardTitle>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Calendar className="h-4 w-4" /> Nov 18 - Nov 24
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-1">
                <div className="grid grid-cols-6 text-xs font-bold text-slate-500 uppercase px-4 py-2 bg-slate-50 rounded-t-lg">
                  <div>Day</div>
                  <div>Start</div>
                  <div>End</div>
                  <div>Break</div>
                  <div>Source</div>
                  <div className="text-right">Total</div>
                </div>
                {entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-6 text-sm px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center">
                    <div className="font-medium text-slate-900">{entry.day}</div>
                    <div className="font-mono text-slate-600">{entry.start}</div>
                    <div className="font-mono text-slate-600">{entry.end}</div>
                    <div className="text-slate-500">{entry.break}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {entry.source !== '-' && <Fingerprint className="h-3 w-3" />}
                      {entry.source}
                    </div>
                    <div className="text-right font-bold text-slate-900">{entry.total}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none shadow-lg">
            <CardContent className="p-6 text-center">
              <p className="text-slate-400 text-xs font-bold uppercase mb-4">Current Status</p>
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 mb-4">
                <span className="text-slate-500 font-bold">OFF</span>
              </div>
              <p className="text-2xl font-mono font-bold mb-1">00:00:00</p>
              <p className="text-xs text-slate-400">Since last clock out</p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-bold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Regular Hours</span>
                  <span className="font-bold text-slate-900">21.7h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Overtime</span>
                  <span className="font-bold text-slate-900">0h</span>
                </div>
                <div className="h-px bg-slate-100 my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-slate-700">Total</span>
                  <span className="text-blue-600">21.7h</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-yellow-100 bg-yellow-50/50 shadow-sm">
            <CardContent className="p-4">
               <div className="flex gap-3">
                 <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                 <div>
                   <h4 className="font-bold text-slate-900 text-sm">Missing Punch</h4>
                   <p className="text-xs text-slate-600 mt-1">You have a missing clock-out for Nov 15. Please regularize.</p>
                   <Button variant="link" className="text-yellow-700 p-0 h-auto text-xs mt-2 font-bold">Fix Now &rarr;</Button>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
