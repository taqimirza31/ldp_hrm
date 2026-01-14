import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  User, Lock, Bell, Globe, Shield, CreditCard, 
  Building, Mail, Smartphone, Slack, Key, LogOut,
  Palette, Users, Link as LinkIcon, Database
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const sidebarNavItems = [
  { title: "General", icon: Building, id: "general" },
  { title: "Profile", icon: User, id: "profile" },
  { title: "Appearance", icon: Palette, id: "appearance" },
  { title: "Notifications", icon: Bell, id: "notifications" },
  { title: "Security", icon: Shield, id: "security" },
  { title: "Billing", icon: CreditCard, id: "billing" },
  { title: "Integrations", icon: Database, id: "integrations" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <Layout>
      <div className="flex flex-col md:flex-row gap-8 min-h-[calc(100vh-100px)]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-6">
            <h1 className="text-2xl font-display font-bold text-slate-900 mb-1">Settings</h1>
            <p className="text-slate-500 text-sm mb-6">Manage your workspace.</p>
            
            <nav className="space-y-1">
              {sidebarNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    activeTab === item.id 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </button>
              ))}
            </nav>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
               <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <LogOut className="h-4 w-4" />
                  Sign Out
               </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          {activeTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h2 className="text-lg font-bold text-slate-900">General Settings</h2>
                <p className="text-sm text-slate-500">Manage your company information and preferences.</p>
              </div>
              <Separator />
              
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" defaultValue="Admani Holdings" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="domain">Primary Domain</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                        https://
                      </span>
                      <Input id="domain" defaultValue="admani.com" className="rounded-l-none" />
                    </div>
                  </div>
                   <div className="grid gap-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" defaultValue="Pacific Time (US & Canada)" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="about">About Company</Label>
                  <Input id="about" defaultValue="Leading logistics and supply chain solutions provider." />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                <h2 className="text-lg font-bold text-slate-900">Appearance</h2>
                <p className="text-sm text-slate-500">Customize the look and feel of the dashboard.</p>
              </div>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Dark Mode</Label>
                    <p className="text-sm text-slate-500">Switch between light and dark themes.</p>
                  </div>
                  <Switch />
                </div>
                
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Compact Density</Label>
                    <p className="text-sm text-slate-500">Show more content on the screen.</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === "integrations" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div>
                <h2 className="text-lg font-bold text-slate-900">Integrations</h2>
                <p className="text-sm text-slate-500">Connect with third-party tools and services.</p>
              </div>
              <Separator />
              
              <div className="grid gap-4">
                {[
                  { name: "Slack", desc: "Receive notifications and alerts in your channels.", icon: Slack, connected: true },
                  { name: "Google Workspace", desc: "Sync calendar and contacts.", icon: Globe, connected: true },
                  { name: "Zoom", desc: "Schedule meetings directly from calendar.", icon: Globe, connected: false },
                  { name: "JIRA", desc: "Link issues to project tasks.", icon: LinkIcon, connected: false },
                ].map((app) => (
                  <div key={app.name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-blue-200 transition-colors bg-white">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                        <app.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{app.name}</h4>
                        <p className="text-xs text-slate-500">{app.desc}</p>
                      </div>
                    </div>
                    <Button variant={app.connected ? "outline" : "default"} size="sm">
                      {app.connected ? "Configure" : "Connect"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder for other tabs */}
          {["profile", "notifications", "security", "billing"].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <SettingsIcon className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Work in Progress</h3>
              <p className="text-slate-500 max-w-sm mt-2">This settings section is currently being developed. Check back later for updates.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
