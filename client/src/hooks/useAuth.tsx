import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

export type Role = "admin" | "hr" | "manager" | "employee";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isHR: boolean;
  isManager: boolean;
  isEmployee: boolean;
  canEditEmployee: (employeeId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Fetch current user on mount
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function refreshUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Fetch full user info after login
    await refreshUser();
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setLocation("/login");
    }
  }

  // Role checks
  const isAdmin = user?.role === "admin";
  const isHR = user?.role === "hr";
  const isManager = user?.role === "manager";
  const isEmployee = user?.role === "employee";

  // Check if current user can edit a specific employee
  function canEditEmployee(employeeId: string): boolean {
    if (!user) return false;
    // Admin and HR can edit anyone
    if (isAdmin || isHR) return true;
    // Others can only edit themselves
    return user.employeeId === employeeId;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isAdmin,
        isHR,
        isManager,
        isEmployee,
        canEditEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper hook for protected routes
export function useRequireAuth(redirectTo = "/login") {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation(redirectTo);
    }
  }, [user, loading, setLocation, redirectTo]);

  return { user, loading };
}
