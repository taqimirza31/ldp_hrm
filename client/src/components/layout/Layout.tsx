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
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import admaniLogo from "@assets/generated_images/futuristic_abstract_logo_for_admani_holdings.png";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Employees", href: "/employees" },
  { icon: Briefcase, label: "Recruitment", href: "/recruitment" },
  { icon: CreditCard, label: "Payroll", href: "/payroll" },
  { icon: Calendar, label: "Attendance", href: "/attendance" },
  { icon: Award, label: "Performance", href: "/performance" },
  { icon: Settings, label: "System", href: "/settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar/50 backdrop-blur-xl border-r border-white/10">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <img src={admaniLogo} alt="Admani Logo" className="h-10 w-10 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
        <div>
          <h1 className="font-display font-bold text-xl tracking-widest text-white">ADMANI</h1>
          <p className="text-xs text-primary tracking-[0.2em] font-tech uppercase">Holdings HRIS</p>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-6">
        <nav className="space-y-2 px-4">
          {sidebarItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 cursor-pointer group
                    ${isActive 
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                      : "text-muted-foreground hover:text-white hover:bg-white/5 hover:translate-x-1"
                    }
                  `}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" : ""}`} />
                  <span className={`font-tech text-lg tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)] animate-pulse" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-white/5">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-3 font-tech text-lg">
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 fixed inset-y-0 left-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="p-0 w-72 border-r border-white/10 bg-black/90">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen transition-all duration-300">
        <header className="h-20 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 lg:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <img src={admaniLogo} alt="Logo" className="h-8 w-8 rounded" />
          </div>

          <div className="hidden lg:flex items-center bg-white/5 rounded-full px-4 py-2 w-96 border border-white/5 focus-within:border-primary/50 focus-within:bg-white/10 transition-all">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search modules, employees, reports..." 
              className="bg-transparent border-none focus:outline-none px-3 text-sm text-white w-full placeholder:text-muted-foreground/70 font-tech"
            />
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-white hover:bg-white/5 rounded-full">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full shadow-[0_0_8px_var(--color-accent)]" />
            </Button>
            
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden md:block">
                <p className="text-sm font-display font-bold text-white leading-none">Sarah Connor</p>
                <p className="text-xs text-primary font-tech uppercase mt-1">HR Director</p>
              </div>
              <Avatar className="h-10 w-10 border border-primary/30 shadow-[0_0_10px_rgba(6,182,212,0.3)] ring-2 ring-background ring-offset-2 ring-offset-background">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">SC</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 relative overflow-hidden">
          {/* Background ambient glow */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[100px]" />
          </div>
          
          <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
