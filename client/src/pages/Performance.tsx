import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Star, TrendingUp, Award, Target } from "lucide-react";

const performanceData = [
  { subject: 'Technical', A: 120, B: 110, fullMark: 150 },
  { subject: 'Communication', A: 98, B: 130, fullMark: 150 },
  { subject: 'Leadership', A: 86, B: 130, fullMark: 150 },
  { subject: 'Reliability', A: 99, B: 100, fullMark: 150 },
  { subject: 'Initiative', A: 85, B: 90, fullMark: 150 },
  { subject: 'Teamwork', A: 65, B: 85, fullMark: 150 },
];

const reviews = [
  { id: 1, user: "Neo Anderson", role: "Senior Dev", rating: 4.8, status: "Completed", date: "Oct 15" },
  { id: 2, user: "Sarah Connor", role: "Product Lead", rating: 4.9, status: "Completed", date: "Oct 12" },
  { id: 3, user: "John Wick", role: "Security", rating: 5.0, status: "Pending Review", date: "Nov 01" },
];

export default function Performance() {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">Performance Reviews</h1>
        <p className="text-slate-500 text-sm">360° feedback and skill assessments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <Card className="border border-slate-200 shadow-sm h-full">
             <CardHeader>
              <CardTitle>Team Competency Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={performanceData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar name="Team Average" dataKey="B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                    <Radar name="Top Performers" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-purple-600 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Award className="h-8 w-8 text-yellow-300" />
                <span className="bg-white/20 px-2 py-1 rounded text-xs font-medium">Top Performer</span>
              </div>
              <h3 className="text-2xl font-bold mb-1">John Wick</h3>
              <p className="text-purple-100 text-sm mb-6">Security Specialist</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-purple-200 uppercase tracking-wider">Rating</p>
                  <p className="text-3xl font-bold flex items-center gap-1">
                    5.0 <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
                  </p>
                </div>
                <Button variant="secondary" size="sm" className="bg-white text-purple-600 hover:bg-purple-50">View Profile</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Review Cycle Status</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Self Reviews</span>
                    <span className="font-bold text-slate-900">98%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[98%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Manager Reviews</span>
                    <span className="font-bold text-slate-900">72%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[72%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Peer Feedback</span>
                    <span className="font-bold text-slate-900">45%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 w-[45%]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {reviews.map((review) => (
              <div key={review.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>User</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-slate-900">{review.user}</p>
                    <p className="text-sm text-slate-500">{review.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-slate-900">{review.status}</p>
                    <p className="text-xs text-slate-500">Due {review.date}</p>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-slate-700 w-12 justify-end">
                    {review.rating} <Star className="h-3 w-3 fill-slate-400 text-slate-400" />
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
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
