import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Download, Play, Square } from "lucide-react";

const weekDays = ["Mon 18", "Tue 19", "Wed 20", "Thu 21", "Fri 22", "Sat 23", "Sun 24"];

const entries = [
  { day: "Mon 18", start: "09:00", end: "17:00", break: "1h", total: "7h" },
  { day: "Tue 19", start: "09:15", end: "17:30", break: "45m", total: "7.5h" },
  { day: "Wed 20", start: "08:50", end: "17:00", break: "1h", total: "7.2h" },
  { day: "Thu 21", start: "--:--", end: "--:--", break: "-", total: "0h" },
  { day: "Fri 22", start: "--:--", end: "--:--", break: "-", total: "0h" },
];

export default function Timesheets() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Timesheets</h1>
          <p className="text-slate-500 text-sm">Daily attendance and hour tracking.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
            <Play className="h-4 w-4 mr-2" /> Clock In
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Weekly Log</CardTitle>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" /> Nov 18 - Nov 24
            </div>
          </CardHeader>
          <CardContent>
            <div className="mt-4 space-y-1">
              <div className="grid grid-cols-5 text-xs font-bold text-slate-500 uppercase px-4 py-2 bg-slate-50 rounded-t-lg">
                <div>Day</div>
                <div>Start</div>
                <div>End</div>
                <div>Break</div>
                <div className="text-right">Total</div>
              </div>
              {entries.map((entry, i) => (
                <div key={i} className="grid grid-cols-5 text-sm px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors items-center">
                  <div className="font-medium text-slate-900">{entry.day}</div>
                  <div className="font-mono text-slate-600">{entry.start}</div>
                  <div className="font-mono text-slate-600">{entry.end}</div>
                  <div className="text-slate-500">{entry.break}</div>
                  <div className="text-right font-bold text-slate-900">{entry.total}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
        </div>
      </div>
    </Layout>
  );
}
