import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationRole = "employee" | "admin" | "hr" | "manager" | "all";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  roles: NotificationRole[]; // Which roles see this
  read: boolean;
  createdAt: string;
  link?: string;
  icon?: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getForRole: (role: string) => Notification[];
  unreadCount: (role: string) => number;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  // Employee notifications
  {
    id: "n1",
    type: "leave",
    title: "Leave Approved",
    message: "Your annual leave request (Nov 12–15) has been approved.",
    roles: ["employee"],
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    link: "/leave",
    icon: "Calendar",
  },
  {
    id: "n2",
    type: "ticket",
    title: "IT Ticket Updated",
    message: "Your support ticket TKT-2024-0089 is now In Progress.",
    roles: ["employee"],
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    link: "/it-support",
    icon: "Laptop",
  },
  {
    id: "n3",
    type: "payroll",
    title: "Payslip Ready",
    message: "Your November payslip is now available.",
    roles: ["employee"],
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    link: "/payslips",
    icon: "DollarSign",
  },
  {
    id: "n4",
    type: "kudos",
    title: "Kudos Received",
    message: "Sarah Connor gave you kudos for the project delivery.",
    roles: ["employee"],
    read: false,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    link: "/kudos",
    icon: "Trophy",
  },
  // Admin/HR notifications
  {
    id: "n5",
    type: "leave",
    title: "Leave Request Pending",
    message: "Trinity Moss requested annual leave (Nov 14–16). Awaiting approval.",
    roles: ["admin", "hr", "manager"],
    read: false,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    link: "/leave",
    icon: "Calendar",
  },
  {
    id: "n6",
    type: "ticket",
    title: "New Support Ticket",
    message: "Bob Smith created ticket TKT-2024-0092 — Laptop battery issue.",
    roles: ["admin", "hr"],
    read: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    link: "/assets",
    icon: "Laptop",
  },
  {
    id: "n7",
    type: "onboarding",
    title: "New Hire Added",
    message: "Alice Johnson has been added to onboarding. Department: Design.",
    roles: ["admin", "hr"],
    read: true,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    link: "/onboarding",
    icon: "UserPlus",
  },
  {
    id: "n8",
    type: "change_request",
    title: "Profile Change Request",
    message: "Neo Anderson requested a profile update. Pending review.",
    roles: ["admin", "hr"],
    read: false,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    link: "/employees",
    icon: "User",
  },
  {
    id: "n9",
    type: "compliance",
    title: "Compliance Reminder",
    message: "Q4 compliance review is due in 5 days.",
    roles: ["admin", "hr"],
    read: false,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    link: "/compliance",
    icon: "ShieldCheck",
  },
];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,

      addNotification: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: `n-${Date.now()}`,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...state.notifications,
          ],
        })),

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((x) =>
            x.id === id ? { ...x, read: true } : x
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((x) => ({ ...x, read: true })),
        })),

      getForRole: (role: string) => {
        const { notifications } = get();
        return notifications
          .filter(
            (n) =>
              n.roles.includes(role as NotificationRole) || n.roles.includes("all")
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      },

      unreadCount: (role: string) => {
        return get()
          .getForRole(role)
          .filter((n) => !n.read).length;
      },
    }),
    { name: "voyager-notifications" }
  )
);
