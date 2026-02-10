import { useAuth } from "@/hooks/useAuth";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { NotificationRole } from "@/store/useNotificationStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Calendar, Laptop, DollarSign, Trophy, UserPlus, User, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const iconMap: Record<string, typeof Bell> = {
  Calendar,
  Laptop,
  DollarSign,
  Trophy,
  UserPlus,
  User,
  ShieldCheck,
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

export function NotificationDropdown() {
  const { user } = useAuth();
  const role = (user?.role || "employee") as NotificationRole;
  // Subscribe to raw notifications to avoid selector returning new array refs each time (prevents infinite update loops)
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const filteredNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.roles.includes(role) || n.roles.includes("all"))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications, role]
  );

  const unreadCount = useMemo(
    () => filteredNotifications.filter((n) => !n.read).length,
    [filteredNotifications]
  );

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
      <DropdownMenuContent align="end" className="w-96 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((n) => {
                const Icon = iconMap[n.icon || "Calendar"] || Bell;
                return (
                  <Link key={n.id} href={n.link || "#"}>
                    <div
                      className={cn(
                        "flex gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors",
                        !n.read && "bg-primary/5"
                      )}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                          !n.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            !n.read && "text-foreground"
                          )}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(n.createdAt)}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
        {filteredNotifications.length > 0 && (
          <div className="p-2 border-t">
            <Link href="/settings">
              <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2">
                Notification settings
              </button>
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
