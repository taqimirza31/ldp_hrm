import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import { useEffect } from "react";

import Recruitment from "@/pages/Recruitment";
import CandidateProfile from "@/pages/CandidateProfile";
import OrgChart from "@/pages/OrgChart";
import Payroll from "@/pages/Payroll";
import Performance from "@/pages/Performance";
import LeaveCalendar from "@/pages/LeaveCalendar";
import NewsFeed from "@/pages/NewsFeed";
import EmployeeProfile from "@/pages/EmployeeProfile";
import Payslips from "@/pages/Payslips";
import Settings from "@/pages/Settings";
import Onboarding from "@/pages/Onboarding";
import Documents from "@/pages/Documents";
import Expenses from "@/pages/Expenses";
import Tasks from "@/pages/Tasks";
import Rooms from "@/pages/Rooms";
import Surveys from "@/pages/Surveys";
import Succession from "@/pages/Succession";
import Training from "@/pages/Training";
import Kudos from "@/pages/Kudos";
import Compliance from "@/pages/Compliance";
import Benefits from "@/pages/Benefits";
import Visitors from "@/pages/Visitors";
import Salary from "@/pages/Salary";
import Audit from "@/pages/Audit";
import Emergency from "@/pages/Emergency";
import Timezone from "@/pages/Timezone";
import Shifts from "@/pages/Shifts";
import Diversity from "@/pages/Diversity";
import SystemHealth from "@/pages/SystemHealth";
import Assets from "@/pages/Assets";
import AssetProfile from "@/pages/AssetProfile";
import ITSupport from "@/pages/ITSupport";
import Goals from "@/pages/Goals";
import Offboarding from "@/pages/Offboarding";
import Timesheets from "@/pages/Timesheets";
import Loans from "@/pages/Loans";
import ProjectTracking from "@/pages/ProjectTracking";
import Whistleblower from "@/pages/Whistleblower";
import CareerSite from "@/pages/CareerSite";
import ServiceDesk from "@/pages/ServiceDesk";
import KnowledgeBase from "@/pages/KnowledgeBase";
import ArticleView from "@/pages/ArticleView";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import TentativePortal from "@/pages/TentativePortal";
import OfferResponse from "@/pages/OfferResponse";
import ChangeRequests from "@/pages/ChangeRequests";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

/**
 * Route-level role guard. Prevents navigating to restricted pages via direct URL.
 * Checks effectiveRole and allowedModules (mirrors sidebar visibility logic).
 */
type RoleGuardProps = {
  /** Module key matching the sidebar href without leading slash (e.g. "recruitment") */
  moduleKey: string;
  /** Roles that may access this route when allowedModules is empty (role-based fallback) */
  roles?: string[];
  children: React.ReactNode;
};

function RoleGuard({ moduleKey, roles, children }: RoleGuardProps) {
  const { user, effectiveRole } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  // 1. Explicit module list takes priority
  if (user.allowedModules && user.allowedModules.length > 0) {
    const allowed = user.allowedModules.includes(moduleKey) || moduleKey === "dashboard" || moduleKey === "settings";
    if (!allowed) {
      console.warn(`[rbac] RoleGuard: user ${user.email} attempted to access /${moduleKey} without module permission`);
      setLocation("/dashboard");
      return null;
    }
    return <>{children}</>;
  }

  // 2. Role-based access
  if (roles && !roles.includes(effectiveRole)) {
    console.warn(`[rbac] RoleGuard: user ${user.email} (${effectiveRole}) attempted to access /${moduleKey}, requires ${roles.join("|")}`);
    setLocation("/dashboard");
    return null;
  }

  return <>{children}</>;
}

// Redirect component to handle root path
function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/careers" component={CareerSite} />
      <Route path="/tentative-portal/:token" component={TentativePortal} />
      <Route path="/offer-response/:token" component={OfferResponse} />
      
      {/* Protected routes */}
      <Route path="/">
        <ProtectedRoute><RedirectHome /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/news">
        <ProtectedRoute><NewsFeed /></ProtectedRoute>
      </Route>
      <Route path="/employees">
        <ProtectedRoute><Employees /></ProtectedRoute>
      </Route>
      <Route path="/employees/:id">
        {(params) => <ProtectedRoute><EmployeeProfile /></ProtectedRoute>}
      </Route>
      <Route path="/change-requests">
        <ProtectedRoute><ChangeRequests /></ProtectedRoute>
      </Route>
      <Route path="/recruitment">
        <ProtectedRoute><RoleGuard moduleKey="recruitment" roles={["admin", "hr", "manager"]}><Recruitment /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/recruitment/candidates/:id">
        <ProtectedRoute><RoleGuard moduleKey="recruitment" roles={["admin", "hr", "manager"]}><CandidateProfile /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/onboarding">
        <ProtectedRoute><RoleGuard moduleKey="onboarding" roles={["admin", "hr"]}><Onboarding /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/offboarding">
        <ProtectedRoute><RoleGuard moduleKey="offboarding" roles={["admin", "hr"]}><Offboarding /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/goals">
        <ProtectedRoute><Goals /></ProtectedRoute>
      </Route>
      <Route path="/surveys">
        <ProtectedRoute><Surveys /></ProtectedRoute>
      </Route>
      <Route path="/diversity">
        <ProtectedRoute><RoleGuard moduleKey="diversity" roles={["admin", "hr"]}><Diversity /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/documents">
        <ProtectedRoute><Documents /></ProtectedRoute>
      </Route>
      <Route path="/assets">
        <ProtectedRoute><RoleGuard moduleKey="assets" roles={["admin", "it"]}><Assets /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/assets/:id">
        {(params) => <ProtectedRoute><RoleGuard moduleKey="assets" roles={["admin", "it"]}><AssetProfile /></RoleGuard></ProtectedRoute>}
      </Route>
      <Route path="/expenses">
        <ProtectedRoute><Expenses /></ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute><Tasks /></ProtectedRoute>
      </Route>
      <Route path="/rooms">
        <ProtectedRoute><Rooms /></ProtectedRoute>
      </Route>
      <Route path="/shifts">
        <ProtectedRoute><Shifts /></ProtectedRoute>
      </Route>
      <Route path="/timesheets">
        <ProtectedRoute><Timesheets /></ProtectedRoute>
      </Route>
      <Route path="/loans">
        <ProtectedRoute><Loans /></ProtectedRoute>
      </Route>
      <Route path="/project-tracking">
        <ProtectedRoute><ProjectTracking /></ProtectedRoute>
      </Route>
      <Route path="/training">
        <ProtectedRoute><Training /></ProtectedRoute>
      </Route>
      <Route path="/kudos">
        <ProtectedRoute><Kudos /></ProtectedRoute>
      </Route>
      <Route path="/succession">
        <ProtectedRoute><RoleGuard moduleKey="succession" roles={["admin", "hr", "manager"]}><Succession /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/compliance">
        <ProtectedRoute><RoleGuard moduleKey="compliance" roles={["admin", "hr"]}><Compliance /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/whistleblower">
        <ProtectedRoute><Whistleblower /></ProtectedRoute>
      </Route>
      <Route path="/service-desk">
        <ProtectedRoute><ServiceDesk /></ProtectedRoute>
      </Route>
      <Route path="/it-support">
        <ProtectedRoute><ITSupport /></ProtectedRoute>
      </Route>
      <Route path="/help-center">
        <ProtectedRoute><KnowledgeBase /></ProtectedRoute>
      </Route>
      <Route path="/help-center/article/:slug">
        <ProtectedRoute><ArticleView /></ProtectedRoute>
      </Route>
      <Route path="/benefits">
        <ProtectedRoute><Benefits /></ProtectedRoute>
      </Route>
      <Route path="/visitors">
        <ProtectedRoute><RoleGuard moduleKey="visitors" roles={["admin", "hr", "manager"]}><Visitors /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/salary">
        <ProtectedRoute><RoleGuard moduleKey="salary" roles={["admin", "hr"]}><Salary /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/audit">
        <ProtectedRoute><RoleGuard moduleKey="audit" roles={["admin"]}><Audit /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/emergency">
        <ProtectedRoute><Emergency /></ProtectedRoute>
      </Route>
      <Route path="/timezones">
        <ProtectedRoute><Timezone /></ProtectedRoute>
      </Route>
      <Route path="/health">
        <ProtectedRoute><RoleGuard moduleKey="health" roles={["admin"]}><SystemHealth /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/org-chart">
        <ProtectedRoute><OrgChart /></ProtectedRoute>
      </Route>
      <Route path="/leave">
        <ProtectedRoute><LeaveCalendar /></ProtectedRoute>
      </Route>
      <Route path="/performance">
        <ProtectedRoute><Performance /></ProtectedRoute>
      </Route>
      <Route path="/payroll">
        <ProtectedRoute><RoleGuard moduleKey="payroll" roles={["admin", "hr"]}><Payroll /></RoleGuard></ProtectedRoute>
      </Route>
      <Route path="/payslips">
        <ProtectedRoute><Payslips /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><Settings /></ProtectedRoute>
      </Route>
      <Route path="/attendance">
        <ProtectedRoute><LeaveCalendar /></ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
