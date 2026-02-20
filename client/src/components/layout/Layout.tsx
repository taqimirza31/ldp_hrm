import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandMenu } from "@/components/CommandMenu";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CreditCard, 
  Calendar, 
  Award, 
  Settings, 
  LogOut,
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
  ChevronRight,
  HelpCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import admaniLogo from "@assets/generated_images/cool_modern_geometric_logo_for_admani_holdings.png";

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
      { icon: FileText, label: "Change requests", href: "/change-requests" },
      { icon: User, label: "Org Chart", href: "/org-chart" },
      { icon: Briefcase, label: "Recruitment", href: "/recruitment", roles: ["admin", "hr", "manager"] },
      { icon: UserPlus, label: "Onboarding", href: "/onboarding", roles: ["admin", "hr"] },
      { icon: UserMinus, label: "Offboarding", href: "/offboarding", roles: ["admin", "hr"] },
    ]
  },
  {
    title: "Operations",
    items: [
      { icon: Layers, label: "Shifts", href: "/shifts" },
      { icon: Watch, label: "Timesheets", href: "/timesheets" },
      { icon: Calendar, label: "Leave Calendar", href: "/leave" },
      { icon: HelpCircle, label: "Service Desk", href: "/service-desk" },
      { icon: Laptop, label: "IT Support", href: "/it-support" },
      { icon: MapPin, label: "Rooms", href: "/rooms" },
      { icon: Laptop, label: "Asset Management", href: "/assets", roles: ["admin", "it"] },
      { icon: Plane, label: "Visitors", href: "/visitors", roles: ["admin", "hr", "manager"] },
      { icon: Clock, label: "Timezones", href: "/timezones" },
      { icon: AlertTriangle, label: "Emergency", href: "/emergency" },
    ]
  },
  {
    title: "Finance & Legal",
    items: [
      { icon: CreditCard, label: "Payroll", href: "/payroll", roles: ["admin", "hr"] },
      { icon: DollarSign, label: "Loans & Advances", href: "/loans" },
      { icon: Receipt, label: "Expenses", href: "/expenses" },
      { icon: Heart, label: "Benefits", href: "/benefits" },
      { icon: DollarSign, label: "Salary Benchmark", href: "/salary", roles: ["admin", "hr"] },
      { icon: ShieldCheck, label: "Compliance", href: "/compliance", roles: ["admin", "hr"] },
      { icon: EyeOff, label: "Whistleblower", href: "/whistleblower" },
      { icon: FileText, label: "Audit Logs", href: "/audit", roles: ["admin"] },
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
      { icon: Globe, label: "Diversity", href: "/diversity", roles: ["admin", "hr"] },
      { icon: TrendingUp, label: "Succession", href: "/succession", roles: ["admin", "hr", "manager"] },
    ]
  },
  {
    title: "System",
    items: [
      { icon: Activity, label: "System Health", href: "/health", roles: ["admin"] },
      { icon: LayoutDashboard, label: "Project Tracking", href: "/project-tracking" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ]
  }
];

// Role display names and colors
const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-500/10 text-red-600 border-red-200" },
  hr: { label: "HR", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  manager: { label: "Manager", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  employee: { label: "Employee", color: "bg-green-500/10 text-green-600 border-green-200" },
  it: { label: "IT", color: "bg-orange-500/10 text-orange-600 border-orange-200" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, isAdmin, isHR, effectiveRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter sidebar: by allowedModules (if set) → by effectiveRole (DB truth)
  const getVisibleItems = (items: typeof sidebarGroups[0]["items"]) => {
    if (!user) return [];
    const moduleKey = (href: string) => href.replace(/^\//, "");
    // 1. Explicit module list takes priority
    if (user.allowedModules && user.allowedModules.length > 0) {
      return items.filter(item => {
        const key = moduleKey(item.href);
        return user!.allowedModules!.includes(key) || key === "dashboard" || key === "settings";
      });
    }
    // 2. Otherwise use effectiveRole (DB-driven)
    return items.filter(item => {
      if (!item.roles) return true;
      return item.roles.includes(effectiveRole);
    });
  };

  // Get user display name
  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email?.split("@")[0] || "User";
  
  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "U";

  const roleInfo = roleConfig[effectiveRole] || roleConfig.employee;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800 transition-all duration-300">
      {/* Header */}
      <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-slate-800 transition-all duration-300`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-blue-600 rounded-lg p-1.5 flex-shrink-0">
            <img src={admaniLogo} alt="Admani Logo" className="h-5 w-5 invert brightness-0" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h1 className="font-display font-bold text-base text-white tracking-tight leading-none">VOYAGER</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">HRIS</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <ScrollArea className="flex-1 py-6">
        <nav className="space-y-6 px-3">
          {sidebarGroups.map((group, idx) => {
            const visibleItems = getVisibleItems(group.items);
            if (visibleItems.length === 0) return null;
            
            return (
              <div key={idx}>
                {!isCollapsed && (
                  <div className="px-3 mb-2 text-[10px] font-bold uppercase text-slate-600 tracking-widest animate-in fade-in duration-300">
                    {group.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
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
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <Button 
          variant="ghost" 
          className={`w-full text-slate-400 hover:text-white hover:bg-slate-800 gap-3 ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 text-foreground flex font-sans">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden lg:block fixed inset-y-0 left-0 z-50 shadow-xl transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {sidebarContent}
        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-background border border-border rounded-full p-1 shadow-md text-muted-foreground hover:text-primary transition-colors hidden lg:flex"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r border-sidebar-border">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
              <Menu className="h-5 w-5 text-muted-foreground" />
            </Button>
            <img src={admaniLogo} alt="Logo" className="h-8 w-8" />
          </div>

          {/* Desktop Breadcrumb / Context */}
          <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Voyager HRIS</span>
            <span className="text-border">/</span>
            <span className="capitalize">{location === '/' ? 'Dashboard' : location.substring(1).replace('-', ' ')}</span>
          </div>

          <div className="flex-1 max-w-md mx-auto hidden lg:block px-8">
             <CommandMenu />
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationDropdown />
            
            <div className="h-6 w-px bg-border mx-1 hidden md:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-muted p-1.5 rounded-full pr-2 transition-colors">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={user?.avatar || "https://github.com/shadcn.png"} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-bold text-foreground leading-none">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${roleInfo.color}`}>
                        {roleInfo.label}
                      </Badge>
                    </div>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {user?.employeeId && (
                  <DropdownMenuItem onClick={() => setLocation(`/employees/${user.employeeId}`)}>
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setLocation("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
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
    </div>
  );
}
