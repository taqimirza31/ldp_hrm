import { Chatbot } from "@/components/Chatbot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandMenu } from "@/components/CommandMenu";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CreditCard, 
  Calendar, 
  Award, 
  Settings, 
  LogOut,
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  Newspaper,
  UserPlus,
  Folder,
  Receipt,
  CheckSquare,
  MapPin,
  PieChart,
  TrendingUp,
  BookOpen,
  Trophy,
  ShieldCheck,
  Heart,
  Plane,
  DollarSign,
  Clock,
  AlertTriangle,
  FileText,
  Layers,
  Globe,
  Sparkles,
  Activity,
  Laptop,
  Target,
  UserMinus,
  EyeOff,
  Watch,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import admaniLogo from "@assets/generated_images/professional_corporate_logo_for_admani_holdings.png";

// Grouped Sidebar Items
const sidebarGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Newspaper, label: "Company Feed", href: "/news" },
      { icon: CheckSquare, label: "Tasks", href: "/tasks" },
      { icon: Folder, label: "Documents", href: "/documents" },
    ]
  },
  {
    title: "People",
    items: [
      { icon: Users, label: "Employees", href: "/employees" },
      { icon: User, label: "Org Chart", href: "/org-chart" },
      { icon: Briefcase, label: "Recruitment", href: "/recruitment" },
      { icon: Sparkles, label: "Job Generator", href: "/jobs-ai" },
      { icon: UserPlus, label: "Onboarding", href: "/onboarding" },
      { icon: UserMinus, label: "Offboarding", href: "/offboarding" },
    ]
  },
  {
    title: "Operations",
    items: [
      { icon: Layers, label: "Shifts", href: "/shifts" },
      { icon: Watch, label: "Timesheets", href: "/timesheets" },
      { icon: Calendar, label: "Leave Calendar", href: "/leave" },
      { icon: MapPin, label: "Rooms", href: "/rooms" },
      { icon: Laptop, label: "Assets", href: "/assets" },
      { icon: Plane, label: "Visitors", href: "/visitors" },
      { icon: Clock, label: "Timezones", href: "/timezones" },
      { icon: AlertTriangle, label: "Emergency", href: "/emergency" },
    ]
  },
  {
    title: "Finance & Legal",
    items: [
      { icon: CreditCard, label: "Payroll", href: "/payroll" },
      { icon: Receipt, label: "Expenses", href: "/expenses" },
      { icon: Heart, label: "Benefits", href: "/benefits" },
      { icon: DollarSign, label: "Salary Benchmark", href: "/salary" },
      { icon: ShieldCheck, label: "Compliance", href: "/compliance" },
      { icon: EyeOff, label: "Whistleblower", href: "/whistleblower" },
      { icon: FileText, label: "Audit Logs", href: "/audit" },
    ]
  },
  {
    title: "Growth & Culture",
    items: [
      { icon: Award, label: "Performance", href: "/performance" },
      { icon: Target, label: "Goals & OKRs", href: "/goals" },
      { icon: PieChart, label: "Surveys", href: "/surveys" },
      { icon: Trophy, label: "Kudos", href: "/kudos" },
      { icon: BookOpen, label: "Training LMS", href: "/training" },
      { icon: Globe, label: "Diversity", href: "/diversity" },
      { icon: TrendingUp, label: "Succession", href: "/succession" },
    ]
  },
  {
    title: "System",
    items: [
      { icon: Activity, label: "System Health", href: "/health" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ]
  }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on small screens if we wanted, but usually we just hide it.
  // For this mockup, let's keep the collapse feature manual for desktop power users.

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300">
      {/* Header */}
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-slate-800 transition-all duration-300`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-600 rounded-lg p-1.5 flex-shrink-0">
            <img src={admaniLogo} alt="Admani Logo" className="h-5 w-5 invert brightness-0" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h1 className="font-display font-bold text-base text-white tracking-tight leading-none">ADMANI</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">Holdings HRIS</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <ScrollArea className="flex-1 py-6">
        <nav className="space-y-6 px-3">
          {sidebarGroups.map((group, idx) => (
            <div key={idx}>
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-600 tracking-widest animate-in fade-in duration-300">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <TooltipProvider key={item.href} delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.href}>
                            <div
                              className={`
                                flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer group text-sm
                                ${isActive 
                                  ? "bg-blue-600/10 text-blue-400 font-medium" 
                                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }
                                ${isCollapsed ? 'justify-center px-2' : ''}
                              `}
                            >
                              <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                              {!isCollapsed && <span className="truncate">{item.label}</span>}
                            </div>
                          </Link>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right" className="bg-slate-900 text-white border-slate-800">
                            <p>{item.label}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              {!isCollapsed && idx < sidebarGroups.length - 1 && <div className="h-px bg-slate-800/50 mx-3 mt-4" />}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <Button 
          variant="ghost" 
          className={`w-full text-slate-400 hover:text-white hover:bg-slate-800 gap-3 ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
        <div className="mt-2 flex justify-center lg:hidden">
           {/* Only show collapse button on mobile if needed, but usually hidden. 
               Actually, let's add a desktop collapse toggle at the bottom instead. 
           */}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex font-sans">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:block fixed inset-y-0 left-0 z-50 shadow-xl transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        <SidebarContent />
        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-white border border-slate-200 rounded-full p-1 shadow-md text-slate-500 hover:text-blue-600 transition-colors hidden lg:flex"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-r border-slate-800">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
            <img src={admaniLogo} alt="Logo" className="h-8 w-8" />
          </div>

          {/* Desktop Breadcrumb / Context */}
          <div className="hidden lg:flex items-center gap-4 text-sm text-slate-500">
            <span className="font-medium text-slate-900">Admani Holdings</span>
            <span className="text-slate-300">/</span>
            <span className="capitalize">{location === '/' ? 'Dashboard' : location.substring(1).replace('-', ' ')}</span>
          </div>

          <div className="flex-1 max-w-md mx-auto hidden lg:block px-8">
             <CommandMenu />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </Button>
            
            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-full pr-2 transition-colors">
                  <Avatar className="h-8 w-8 border border-slate-200">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">SC</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-bold text-slate-700 leading-none">Sarah Connor</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide font-semibold">HR Director</p>
                  </div>
                  <ChevronDown className="h-3 w-3 text-slate-400 hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
      <Chatbot />
    </div>
  );
}
