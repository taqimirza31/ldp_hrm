import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Star, TrendingUp, Award, Target, Grid3X3, Users, BarChart } from "lucide-react";

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
  { id: 4, user: "Trinity", role: "DevOps", rating: 4.7, status: "In Progress", date: "Nov 05" },
  { id: 5, user: "Morpheus", role: "VP Engineering", rating: 4.9, status: "Completed", date: "Oct 10" },
];

const nineBoxGrid = [
  { id: 'high-potential', title: 'High Potential', employees: [
    { name: 'John Wick', img: 'https://github.com/shadcn.png' },
    { name: 'Sarah Connor', img: 'https://github.com/shadcn.png' }
  ], color: 'bg-green-100 border-green-200' },
  { id: 'star', title: 'Star', employees: [
    { name: 'Neo Anderson', img: 'https://github.com/shadcn.png' }
  ], color: 'bg-blue-100 border-blue-200' },
  { id: 'core', title: 'Core Performer', employees: [
    { name: 'Trinity', img: 'https://github.com/shadcn.png' },
    { name: 'Morpheus', img: 'https://github.com/shadcn.png' }
  ], color: 'bg-slate-50 border-slate-200' }
];

export default function Performance() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Performance Management</h1>
          <p className="text-slate-500 text-sm">Talent calibration, 360° reviews, and competency mapping.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline">Download Report</Button>
           <Button className="bg-primary text-white">Start New Cycle</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="overview"><BarChart className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="reviews"><Users className="h-4 w-4 mr-2" /> Reviews</TabsTrigger>
          <TabsTrigger value="calibration"><Grid3X3 className="h-4 w-4 mr-2" /> 9-Box Calibration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
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
        </TabsContent>

        <TabsContent value="reviews" className="mt-0">
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
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${review.user.replace(' ', '+')}&background=random`} />
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
        </TabsContent>

        <TabsContent value="calibration" className="mt-0">
          <Card className="border border-slate-200 shadow-sm">
             <CardHeader>
               <div className="flex justify-between items-center">
                 <div>
                   <CardTitle>9-Box Talent Calibration</CardTitle>
                   <CardDescription>Assess employee performance vs. potential.</CardDescription>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 text-xs text-slate-500">
                      <div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></div> High Priority
                   </div>
                   <div className="flex items-center gap-1 text-xs text-slate-500">
                      <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded-sm"></div> Retain
                   </div>
                 </div>
               </div>
             </CardHeader>
             <CardContent>
               <div className="relative">
                 {/* Axis Labels */}
                 <div className="absolute -left-8 top-0 bottom-8 flex items-center justify-center">
                    <span className="-rotate-90 text-xs font-bold text-slate-400 tracking-widest uppercase">Potential</span>
                 </div>
                 <div className="absolute bottom-[-24px] left-0 right-0 flex justify-center">
                    <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Performance</span>
                 </div>

                 {/* 3x3 Grid */}
                 <div className="grid grid-cols-3 gap-4 h-[600px] border-l border-b border-slate-200 p-4">
                   {/* Top Row (High Potential) */}
                   <div className="border border-slate-200 rounded-lg p-3 bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Rough Diamond</p>
                      {/* Potential: High, Performance: Low */}
                   </div>
                   <div className="border border-slate-200 rounded-lg p-3 bg-green-50/30 hover:bg-green-50/50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Future Star</p>
                      {/* Potential: High, Performance: Medium */}
                       <div className="flex -space-x-2 overflow-hidden">
                        <Avatar className="border-2 border-white w-8 h-8">
                          <AvatarImage src="https://ui-avatars.com/api/?name=Jane+Doe&background=random" />
                        </Avatar>
                      </div>
                   </div>
                   <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50/50 hover:bg-blue-50 transition-colors shadow-sm">
                      <p className="text-xs font-bold text-blue-700 mb-2 uppercase">Star</p>
                      {/* Potential: High, Performance: High */}
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-slate-100 w-full">
                           <Avatar className="w-6 h-6">
                             <AvatarImage src="https://ui-avatars.com/api/?name=Neo+Anderson&background=random" />
                           </Avatar>
                           <span className="text-xs font-medium">Neo A.</span>
                        </div>
                         <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-slate-100 w-full">
                           <Avatar className="w-6 h-6">
                             <AvatarImage src="https://ui-avatars.com/api/?name=Sarah+Connor&background=random" />
                           </Avatar>
                           <span className="text-xs font-medium">Sarah C.</span>
                        </div>
                      </div>
                   </div>

                   {/* Middle Row (Moderate Potential) */}
                   <div className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Inconsistent</p>
                      {/* Potential: Mod, Performance: Low */}
                   </div>
                   <div className="border border-slate-200 rounded-lg p-3 bg-green-50/10 hover:bg-green-50/30 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Key Player</p>
                      {/* Potential: Mod, Performance: Medium */}
                       <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-slate-100 w-full">
                           <Avatar className="w-6 h-6">
                             <AvatarImage src="https://ui-avatars.com/api/?name=Morpheus&background=random" />
                           </Avatar>
                           <span className="text-xs font-medium">Morpheus</span>
                        </div>
                      </div>
                   </div>
                   <div className="border border-slate-200 rounded-lg p-3 bg-green-50/30 hover:bg-green-50/50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">High Performer</p>
                      {/* Potential: Mod, Performance: High */}
                       <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-slate-100 w-full">
                           <Avatar className="w-6 h-6">
                             <AvatarImage src="https://ui-avatars.com/api/?name=Trinity&background=random" />
                           </Avatar>
                           <span className="text-xs font-medium">Trinity</span>
                        </div>
                      </div>
                   </div>

                   {/* Bottom Row (Low Potential) */}
                   <div className="border border-red-100 rounded-lg p-3 bg-red-50/30 hover:bg-red-50 transition-colors">
                      <p className="text-xs font-bold text-red-700 mb-2 uppercase">Risk</p>
                      {/* Potential: Low, Performance: Low */}
                   </div>
                   <div className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Effective</p>
                      {/* Potential: Low, Performance: Medium */}
                   </div>
                   <div className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Trusted Pro</p>
                      {/* Potential: Low, Performance: High */}
                       <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded shadow-sm border border-slate-100 w-full">
                           <Avatar className="w-6 h-6">
                             <AvatarImage src="https://ui-avatars.com/api/?name=John+Wick&background=random" />
                           </Avatar>
                           <span className="text-xs font-medium">John W.</span>
                        </div>
                      </div>
                   </div>
                 </div>
               </div>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
