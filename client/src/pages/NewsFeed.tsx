import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal, Image as ImageIcon, Smile, Send } from "lucide-react";

const posts = [
  {
    id: 1,
    author: "Sarah Connor",
    role: "HR Director",
    time: "2 hours ago",
    content: "🎉 Thrilled to announce that Admani Holdings has been named one of the Top 100 Places to Work for 2025! This is a testament to everyone's hard work and dedication. Let's keep building the future together! #TeamAdmani #GreatPlaceToWork",
    likes: 124,
    comments: 42,
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    avatar: "https://github.com/shadcn.png"
  },
  {
    id: 2,
    author: "Neo Anderson",
    role: "Lead Architect",
    time: "5 hours ago",
    content: "Just deployed the new neural interface module for the internal grid. Latency is down by 400%. Big shoutout to @Trinity and @Tank for the late night debug sessions! 🚀",
    likes: 89,
    comments: 15,
    avatar: "https://github.com/shadcn.png"
  },
  {
    id: 3,
    author: "Morpheus King",
    role: "VP of Operations",
    time: "1 day ago",
    content: "Reminder: Town Hall meeting tomorrow at 10:00 AM. We have some exciting updates regarding the Q1 roadmap. Attendance is mandatory.",
    likes: 56,
    comments: 8,
    avatar: "https://github.com/shadcn.png"
  }
];

const events = [
  { title: "Q1 Town Hall", date: "Tomorrow, 10:00 AM", type: "Company Wide" },
  { title: "Design Workshop", date: "Nov 24, 2:00 PM", type: "Design Team" },
  { title: "Holiday Party", date: "Dec 15, 6:00 PM", type: "Social" },
];

export default function NewsFeed() {
  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Create Post */}
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://github.com/shadcn.png" />
                  <AvatarFallback>ME</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input placeholder="What's on your mind?" className="bg-slate-50 border-none mb-3 focus-visible:ring-0" />
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">
                        <ImageIcon className="h-4 w-4 mr-2" /> Photo
                      </Button>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-yellow-600">
                        <Smile className="h-4 w-4 mr-2" /> Feeling
                      </Button>
                    </div>
                    <Button size="sm" className="bg-primary text-white">
                      <Send className="h-3 w-3 mr-2" /> Post
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Posts Feed */}
          {posts.map((post) => (
            <Card key={post.id} className="border border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={post.avatar} />
                      <AvatarFallback>{post.author[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{post.author}</h4>
                      <p className="text-xs text-slate-500">{post.role} • {post.time}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-slate-400">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <div className="px-4 pb-3">
                  <p className="text-slate-700 text-sm leading-relaxed">{post.content}</p>
                </div>

                {post.image && (
                  <div className="w-full h-[300px] bg-slate-100 relative">
                     <img src={post.image} alt="Post content" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-3 border-t border-slate-100 flex justify-between items-center">
                  <div className="flex gap-4">
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">
                      <ThumbsUp className="h-4 w-4 mr-2" /> {post.likes}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600">
                      <MessageSquare className="h-4 w-4 mr-2" /> {post.comments}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-500">
                    <Share2 className="h-4 w-4 mr-2" /> Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6 hidden lg:block">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {events.map((event, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="bg-blue-50 text-blue-600 rounded-lg p-2 text-center min-w-[50px]">
                    <span className="block text-xs font-bold uppercase">{event.date.split(',')[0].split(' ')[0]}</span>
                    <span className="block text-lg font-bold leading-none">{event.date.match(/\d+/)?.[0] || '1'}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{event.title}</h4>
                    <p className="text-xs text-slate-500">{event.type}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardContent className="p-6 text-center">
              <h3 className="font-bold mb-2">Refer a Friend</h3>
              <p className="text-xs text-slate-300 mb-4">Know someone who would be a great fit for Admani? Earn $2000 for every successful hire!</p>
              <Button size="sm" className="w-full bg-white text-slate-900 hover:bg-slate-100">Get Referral Link</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
