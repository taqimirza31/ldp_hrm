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
  User
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import admaniLogo from "@assets/generated_images/professional_corporate_logo_for_admani_holdings.png";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Employees", href: "/employees" },
  { icon: Briefcase, label: "Recruitment", href: "/recruitment" },
  { icon: User, label: "Org Chart", href: "/org-chart" },
  { icon: CreditCard, label: "Payroll", href: "/payroll" },
  { icon: Calendar, label: "Attendance", href: "/attendance" },
  { icon: Award, label: "Performance", href: "/performance" },
  { icon: Settings, label: "System", href: "/settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
        <div className="bg-white rounded-lg p-1">
          <img src={admaniLogo} alt="Admani Logo" className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-white tracking-tight">ADMANI</h1>
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">Holdings HRIS</p>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-6">
        <nav className="space-y-1 px-3">
          <div className="px-3 mb-2 text-xs font-semibold uppercase text-sidebar-foreground/40 tracking-wider">Main Menu</div>
          {sidebarItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 cursor-pointer group text-sm
                    ${isActive 
                      ? "bg-primary text-white font-medium shadow-sm" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
                    }
                  `}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-white"}`} />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border/50">
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent gap-3">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-50 shadow-xl shadow-slate-200/50">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border bg-sidebar p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
        <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4 lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
            <img src={admaniLogo} alt="Logo" className="h-8 w-8" />
          </div>

          <div className="hidden lg:flex items-center w-96">
            <CommandMenu />
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </Button>
            
            <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-full pr-3 transition-colors">
                  <Avatar className="h-8 w-8 border border-slate-200">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">SC</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-slate-700 leading-none">Sarah Connor</p>
                    <p className="text-xs text-slate-500 mt-0.5">HR Director</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 hidden md:block" />
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
          <div className="animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
