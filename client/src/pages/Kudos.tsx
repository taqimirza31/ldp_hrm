import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Trophy, Star, Zap, ArrowRight } from "lucide-react";

const kudos = [
  { id: 1, from: "Sarah Connor", to: "Neo Anderson", message: "Huge thanks for solving that critical bug in production last night! You're a lifesaver. 🦸‍♂️", tags: ["Problem Solver", "Team Player"], likes: 12, comments: 3 },
  { id: 2, from: "Morpheus King", to: "Trinity Moss", message: "Congratulations on leading the Q4 planning session. Excellent organization and clarity. 👏", tags: ["Leadership", "Strategy"], likes: 24, comments: 5 },
  { id: 3, from: "John Wick", to: "Design Team", message: "The new UI kit looks absolutely stunning. Great attention to detail!", tags: ["Creativity", "Quality"], likes: 45, comments: 8 },
];

const leaderboard = [
  { rank: 1, user: "Neo Anderson", points: 1250, avatar: "https://github.com/shadcn.png" },
  { rank: 2, user: "Trinity Moss", points: 980, avatar: "https://github.com/shadcn.png" },
  { rank: 3, user: "Sarah Connor", points: 850, avatar: "https://github.com/shadcn.png" },
];

export default function Kudos() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Recognition Wall</h1>
          <p className="text-slate-500 text-sm">Celebrate wins and appreciate your colleagues.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
          <Trophy className="h-4 w-4 mr-2" /> Give Kudos
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-6">
          {kudos.map((post) => (
            <Card key={post.id} className="border border-slate-200 shadow-sm hover:shadow-md transition-all bg-gradient-to-br from-white to-slate-50/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex -space-x-2 items-center">
                     <Avatar className="border-2 border-white h-10 w-10 z-10">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>FR</AvatarFallback>
                    </Avatar>
                    <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs z-0 text-slate-500">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                    <Avatar className="border-2 border-white h-10 w-10 z-10">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>TO</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {post.from} <span className="font-normal text-slate-500">recognized</span> {post.to}
                    </p>
                    <p className="text-xs text-slate-400">2 hours ago</p>
                  </div>
                </div>

                <div className="pl-14">
                  <p className="text-slate-700 text-lg font-medium mb-4">"{post.message}"</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex gap-4 pt-4 border-t border-slate-100">
                     <Button variant="ghost" size="sm" className="text-slate-500 hover:text-pink-600 hover:bg-pink-50">
                        <Heart className="h-4 w-4 mr-2" /> {post.likes}
                     </Button>
                     <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                        <MessageCircle className="h-4 w-4 mr-2" /> {post.comments}
                     </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm bg-gradient-to-b from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                 <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" /> 
                 Top Contributors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.map((user, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-b border-white/10 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs 
                      ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-900' : 'bg-orange-400 text-orange-900'}`}>
                      {user.rank}
                    </div>
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-sm">{user.user}</span>
                  </div>
                  <div className="font-mono text-sm text-slate-300">{user.points} pts</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <h3 className="text-4xl font-bold text-slate-900 mb-1">450</h3>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Redeemable Points</p>
                <Button className="w-full mt-4" variant="outline">Redeem Rewards</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
