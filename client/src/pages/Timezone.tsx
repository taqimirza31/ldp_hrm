import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Clock, Sun, Moon } from "lucide-react";

const cities = [
  { name: "San Francisco", offset: -8, code: "PST" },
  { name: "New York", offset: -5, code: "EST" },
  { name: "London", offset: 0, code: "GMT" },
  { name: "Berlin", offset: 1, code: "CET" },
  { name: "Dubai", offset: 4, code: "GST" },
  { name: "Mumbai", offset: 5.5, code: "IST" },
  { name: "Singapore", offset: 5.5, code: "SGT" }, // Singapore is GMT+8 usually but keeping data simple
  { name: "Tokyo", offset: 9, code: "JST" },
  { name: "Sydney", offset: 11, code: "AEDT" },
];

export default function Timezone() {
  // Mock current time
  const baseTime = 14; // 2 PM GMT

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">Timezone Planner</h1>
        <p className="text-slate-500 text-sm">Coordinate global meetings effectively.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle>Team Availability</CardTitle>
              <div className="flex gap-2">
                <Select defaultValue="14">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">9:00 AM</SelectItem>
                    <SelectItem value="12">12:00 PM</SelectItem>
                    <SelectItem value="14">2:00 PM</SelectItem>
                    <SelectItem value="17">5:00 PM</SelectItem>
                  </SelectContent>
                </Select>
                <Button>Schedule Meeting</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {cities.map((city) => {
                const hour = (baseTime + Math.floor(city.offset) + 24) % 24;
                const isBusinessHours = hour >= 9 && hour <= 18;
                const isNight = hour < 6 || hour > 20;
                
                return (
                  <div key={city.name} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${isBusinessHours ? 'bg-green-100 text-green-600' : isNight ? 'bg-slate-800 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{city.name}</h4>
                        <p className="text-xs text-slate-500">{city.code} (GMT {city.offset >= 0 ? '+' : ''}{city.offset})</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900 font-mono">{hour}:00</p>
                        <p className={`text-xs font-medium ${isBusinessHours ? 'text-green-600' : 'text-slate-400'}`}>
                          {isBusinessHours ? 'Business Hours' : isNight ? 'Night' : 'Off Hours'}
                        </p>
                      </div>
                      {isNight ? <Moon className="h-5 w-5 text-slate-400" /> : <Sun className="h-5 w-5 text-orange-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm bg-slate-900 text-white">
            <CardContent className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <Clock className="h-12 w-12 text-blue-400" />
              </div>
              <h3 className="text-4xl font-bold font-mono mb-1">14:00</h3>
              <p className="text-blue-200 text-sm uppercase tracking-widest">London (GMT)</p>
              <p className="text-xs text-slate-400 mt-4">Primary Office Time</p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Best Meeting Slot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                <p className="text-green-800 font-bold text-lg">2:00 PM - 4:00 PM GMT</p>
                <p className="text-xs text-green-600 mt-1">Overlaps with 6 locations</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
