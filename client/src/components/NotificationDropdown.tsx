import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Laptop,
  DollarSign,
  Trophy,
  UserPlus,
  User,
  ShieldCheck,
  Briefcase,
  UserMinus,
  FileText,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const iconMap: Record<string, typeof Bell> = {
  leave: Calendar,
  change_request: User,
  onboarding: UserPlus,
  tentative: Briefcase,
  offboarding: UserMinus,
  recruitment: Briefcase,
  probation_reminder: AlertTriangle,
  ticket: Laptop,
  payroll: DollarSign,
  kudos: Trophy,
  compliance: ShieldCheck,
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export interface ApiNotification {
  id: string;
  type: string;
  module: string;
  title: string;
  message: string;
  link: string;
  createdAt: string;
  roleTarget: string;
}

function NotificationDropdown() {
  const { user } = useAuth();
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const isRead = useNotificationStore((s) => s.isRead);
  const localNotifications = useNotificationStore((s) => s.localNotifications);

  const { data, isLoading } = useQuery<{ notifications: ApiNotification[]; role: string }>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications");
      return res.json();
    },
  });

  const apiList = data?.notifications ?? [];
  const role = (user?.role || "employee").toString().toLowerCase();

  const merged = useMemo(() => {
    const fromApi: Array<{ id: string; type: string; module: string; title: string; message: string; link: string; createdAt: string }> = apiList.map((n) => ({
      id: n.id,
      type: n.type,
      module: n.module,
      title: n.title,
      message: n.message,
      link: n.link,
      createdAt: n.createdAt,
    }));
    const typeToModule: Record<string, string> = { onboarding: "Onboarding", ticket: "IT Support", leave: "Leave", change_request: "Profile" };
    const fromLocal = localNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      module: n.module || typeToModule[n.type] || "General",
      title: n.title,
      message: n.message,
      link: n.link || "#",
      createdAt: n.createdAt,
    }));
    const combined = [...fromApi, ...fromLocal];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  }, [apiList, localNotifications]);

  const unreadCount = useMemo(
    () => merged.filter((n) => !isRead(n.id)).length,
    [merged, isRead]
  );

  const handleMarkAllRead = () => {
    markAllAsRead(merged.map((n) => n.id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[400px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-[360px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : merged.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {merged.map((n) => {
                const Icon = iconMap[n.type] || Bell;
                const read = isRead(n.id);
                return (
                  <Link key={n.id} href={n.link}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors",
                        !read && "bg-primary/5"
                      )}
                      onClick={() => markAsRead(n.id)}
                      onKeyDown={(e) => e.key === "Enter" && markAsRead(n.id)}
                    >
                      <div
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                          !read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              !read && "text-foreground"
                            )}
                          >
                            {n.title}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0">
                            {n.module}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(n.createdAt)}
                        </p>
                      </div>
                      {!read && (
                        <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
        {merged.length > 0 && (
          <div className="p-2 border-t">
            <Link href="/settings">
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2"
              >
                Notification settings
              </button>
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NotificationDropdown };
