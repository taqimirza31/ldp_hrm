import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, MapPin, Users, Mail, Shield, Zap, Puzzle, 
  Briefcase, Globe, FileText, ClipboardList, UserPlus, 
  UserMinus, Settings as SettingsIcon, CreditCard, Calendar, 
  Clock, Download, Upload, Share2, Linkedin
} from "lucide-react";
import { SiIndeed } from "react-icons/si"; 

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const SettingItem = ({ icon: Icon, title, links }: { icon: any, title: string, links: string[] }) => (
  <div className="flex gap-4 p-4 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
    <div className="mt-1">
      <Icon className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
    </div>
    <div>
      <h4 className="font-bold text-slate-900 mb-1">{title}</h4>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((link, i) => (
          <span key={i} className="text-xs text-slate-500 hover:text-blue-600 hover:underline">
            {link}
          </span>
        ))}
      </div>
    </div>
  </div>
);

export default function Settings() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm">Manage system configurations and preferences.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Help & Support</Button>
          <Button>Save Changes</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        
        <Section title="General Settings">
          <SettingItem 
            icon={Building2} 
            title="General" 
            links={["Company", "Locations", "Departments", "Sub Departments", "Teams", "Business Units", "Preferences"]} 
          />
          <SettingItem 
            icon={Zap} 
            title="Productivity" 
            links={["Email Notifications", "Canned Responses"]} 
          />
          <SettingItem 
            icon={Shield} 
            title="Roles & Privileges" 
            links={["Manage Roles", "Access Control", "API Keys"]} 
          />
          <SettingItem 
            icon={Puzzle} 
            title="Integrate with other Apps" 
            links={["Integrations", "Apps", "Marketplace"]} 
          />
        </Section>

        <Section title="Recruitment and Talent Management">
          <SettingItem 
            icon={Briefcase} 
            title="Job Setup" 
            links={["Email", "Tags", "Source", "Vendors", "Candidate Reject Reasons"]} 
          />
          <SettingItem 
            icon={Globe} 
            title="Job Publishing" 
            links={["Career Site", "Job Fields", "Job Embeds", "Listener", "Job Application Form"]} 
          />
          <SettingItem 
            icon={FileText} 
            title="Offer" 
            links={["Templates", "Fields", "Decline Reasons", "Approval Rules", "Approval Reject Reasons"]} 
          />
          <SettingItem 
            icon={ClipboardList} 
            title="Job Requisitions" 
            links={["Fields", "Approval Rules", "Approval Reject Reasons", "Bulk Import Requisitions"]} 
          />
        </Section>

        <Section title="Employee Information System">
          <SettingItem 
            icon={Upload} 
            title="Bulk Import Employee Data" 
            links={["G Suite Directory", "Office 365 Directory", "CSV File"]} 
          />
          <SettingItem 
            icon={SettingsIcon} 
            title="Profile Fields" 
            links={["Employee Record", "Employee ID Sequences"]} 
          />
          <SettingItem 
            icon={UserPlus} 
            title="Onboarding" 
            links={["New Hire Form", "Documents", "Checklists", "Preferences"]} 
          />
          <SettingItem 
            icon={UserMinus} 
            title="Offboarding" 
            links={["Documents", "Checklists", "Preferences"]} 
          />
          <SettingItem 
            icon={Share2} 
            title="HR Workflows" 
            links={["Auto-assign HR Partner", "Delegation Rules"]} 
          />
          <SettingItem 
            icon={CreditCard} 
            title="Payroll" 
            links={["Paygroups", "Salary Components", "Tax Rules"]} 
          />
        </Section>

        <Section title="Time Off">
          <SettingItem 
            icon={Calendar} 
            title="Time Off Setup" 
            links={["Policy", "Time off type", "Holiday Calendar", "Workweek", "Preferences"]} 
          />
          <SettingItem 
            icon={Clock} 
            title="Timeoff Import/Export" 
            links={["Import balances", "Export balances", "Export Requests"]} 
          />
        </Section>

      </div>
    </Layout>
  );
}
