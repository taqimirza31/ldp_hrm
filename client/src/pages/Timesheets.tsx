import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Download, Play, Square, Fingerprint, Wifi, AlertCircle, History, Coffee, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/store/useStore";
import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isClockedIn && clockInTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = now.getTime() - clockInTime.getTime();
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setElapsedTime(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    } else {
      setElapsedTime("00:00:00");
    }
    return () => clearInterval(interval);
  }, [isClockedIn, clockInTime]);

  const handleClockIn = () => {
    setIsClockedIn(true);
    setClockInTime(new Date());
    toast.success("Clocked In successfully at " + format(new Date(), "HH:mm"));
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    setClockInTime(null);
    toast.success("Clocked Out successfully at " + format(new Date(), "HH:mm"));
  };

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Time & Attendance</h1>
          <p className="text-muted-foreground text-sm">Biometric integration and shift tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
            <Download className="h-4 w-4 mr-2" /> Attendance Report
          </Button>
          {!isClockedIn ? (
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={handleClockIn}>
              <Play className="h-4 w-4 mr-2" /> Manual Clock In
            </Button>
          ) : (
            <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={handleClockOut}>
              <Square className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Biometric Devices Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {devices.map((device) => (
               <Card key={device.id} className="border border-border shadow-sm bg-card">
                 <CardContent className="p-4 flex flex-col justify-between h-full">
                   <div className="flex justify-between items-start mb-2">
                     <Fingerprint className="h-5 w-5 text-muted-foreground" />
                     <Badge variant="outline" className={device.status === 'Online' ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" : "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800"}>
                       {device.status}
                     </Badge>
                   </div>
                   <div>
                     <p className="font-bold text-foreground text-sm">{device.name}</p>
                     <div className="flex items-center text-xs text-muted-foreground mt-1">
                       <Wifi className="h-3 w-3 mr-1" /> {device.lastSync}
                     </div>
                   </div>
                 </CardContent>
               </Card>
             ))}
          </div>

          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>My Attendance Log</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" /> Nov 18 - Nov 24
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-4 space-y-1">
                <div className="grid grid-cols-6 text-xs font-bold text-muted-foreground uppercase px-4 py-2 bg-muted/50 rounded-t-lg">
                  <div>Day</div>
                  <div>Start</div>
                  <div>End</div>
                  <div>Break</div>
                  <div>Source</div>
                  <div className="text-right">Total</div>
                </div>
                {entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-6 text-sm px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors items-center">
                    <div className="font-medium text-foreground">{entry.day}</div>
                    <div className="font-mono text-muted-foreground">{entry.start}</div>
                    <div className="font-mono text-muted-foreground">{entry.end}</div>
                    <div className="text-muted-foreground">{entry.break}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {entry.source !== '-' && <Fingerprint className="h-3 w-3" />}
                      {entry.source}
                    </div>
                    <div className="text-right font-bold text-foreground">{entry.total}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-sidebar text-sidebar-foreground border-none shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Clock className="h-32 w-32" />
            </div>
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-sidebar-foreground/70 text-xs font-bold uppercase mb-6 tracking-widest">Current Status</p>
              
              <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-6 transition-all duration-500 ${isClockedIn ? 'border-green-500 bg-green-500/10' : 'border-sidebar-foreground/20 bg-sidebar-accent'}`}>
                <div className="text-center">
                  <span className={`text-sm font-bold block ${isClockedIn ? 'text-green-500' : 'text-sidebar-foreground/50'}`}>
                    {isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
                  </span>
                </div>
              </div>
              
              <p className="text-4xl font-mono font-bold mb-2 tracking-tighter text-white">{elapsedTime}</p>
              <p className="text-xs text-sidebar-foreground/50">
                {isClockedIn ? `Started at ${format(clockInTime!, "HH:mm")}` : "Ready to start"}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-card">
            <CardContent className="p-6">
              <h3 className="font-bold text-foreground mb-4">Weekly Summary</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Regular Hours</span>
                    <span className="font-bold text-foreground">21.7h / 40h</span>
                  </div>
                  <Progress value={54} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Overtime</p>
                    <p className="text-lg font-bold text-foreground flex items-center gap-1">
                      0h <span className="text-xs font-normal text-muted-foreground">approved</span>
                    </p>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Shortage</p>
                    <p className="text-lg font-bold text-red-500 flex items-center gap-1">
                      -2h <span className="text-xs font-normal text-muted-foreground">pending</span>
                    </p>
                  </div>
                </div>
                
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-foreground">Total Payable</span>
                  <span className="text-primary">21.7h</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10 dark:border-yellow-800 shadow-sm">
            <CardContent className="p-4">
               <div className="flex gap-3">
                 <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                 <div>
                   <h4 className="font-bold text-foreground text-sm">Missing Punch</h4>
                   <p className="text-xs text-muted-foreground mt-1">You have a missing clock-out for Nov 15. Please regularize.</p>
                   <Button variant="link" className="text-yellow-700 dark:text-yellow-500 p-0 h-auto text-xs mt-2 font-bold">Fix Now &rarr;</Button>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
