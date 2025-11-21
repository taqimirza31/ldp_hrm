import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, Users, Bell, Lock, Globe, Database, 
  Mail, Smartphone, Moon, CreditCard, Save 
} from "lucide-react";

export default function Settings() {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-500 text-sm">Manage global configurations and permissions.</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
            <Card className="border border-slate-200 shadow-sm">
              <CardContent className="p-2">
                <TabsList className="flex flex-col w-full h-auto bg-transparent space-y-1">
                  <TabsTrigger value="general" className="w-full justify-start px-3 py-2 h-auto data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Globe className="h-4 w-4 mr-2" /> General
                  </TabsTrigger>
                  <TabsTrigger value="access" className="w-full justify-start px-3 py-2 h-auto data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Shield className="h-4 w-4 mr-2" /> Access Control
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="w-full justify-start px-3 py-2 h-auto data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Bell className="h-4 w-4 mr-2" /> Notifications
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="w-full justify-start px-3 py-2 h-auto data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <CreditCard className="h-4 w-4 mr-2" /> Billing
                  </TabsTrigger>
                  <TabsTrigger value="integrations" className="w-full justify-start px-3 py-2 h-auto data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                    <Database className="h-4 w-4 mr-2" /> Integrations
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9">
            <TabsContent value="general" className="space-y-6 mt-0">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Basic details about your organization.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" defaultValue="Admani Holdings" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Input id="domain" defaultValue="admani.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Default Timezone</Label>
                    <Select defaultValue="pst">
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pst">Pacific Standard Time (PST)</SelectItem>
                        <SelectItem value="est">Eastern Standard Time (EST)</SelectItem>
                        <SelectItem value="utc">Coordinated Universal Time (UTC)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize the look and feel of the dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Dark Mode</Label>
                      <p className="text-sm text-slate-500">Enable dark mode for all users by default.</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Compact View</Label>
                      <p className="text-sm text-slate-500">Use a denser layout for data tables.</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button className="bg-primary text-white">
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="access" className="mt-0">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Role-Based Access Control</CardTitle>
                  <CardDescription>Manage permissions for different user roles.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {["Administrator", "HR Manager", "Department Head", "Employee"].map((role) => (
                      <div key={role} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 text-blue-600 p-2 rounded">
                            <Shield className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-900">{role}</span>
                        </div>
                        <Button variant="outline" size="sm">Edit Permissions</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

             <TabsContent value="notifications" className="mt-0">
              <Card className="border border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Configure system-wide alert settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-sm text-slate-500">Send daily digests and critical alerts via email.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                   <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Slack Integration</Label>
                      <p className="text-sm text-slate-500">Push notifications to company Slack channels.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                   <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Mobile Push</Label>
                      <p className="text-sm text-slate-500">Send alerts to the mobile app.</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </Layout>
  );
}
