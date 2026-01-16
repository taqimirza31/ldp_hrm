import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import JobGenerator from "@/pages/JobGenerator";
import SystemHealth from "@/pages/SystemHealth";
import Assets from "@/pages/Assets";
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
      <Route path="/" component={RedirectHome} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/news" component={NewsFeed} />
      <Route path="/employees" component={Employees} />
      <Route path="/employees/:id" component={EmployeeProfile} />
      <Route path="/recruitment" component={Recruitment} />
      <Route path="/recruitment/candidates/:id" component={CandidateProfile} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/offboarding" component={Offboarding} />
      <Route path="/jobs-ai" component={JobGenerator} />
      <Route path="/goals" component={Goals} />
      <Route path="/surveys" component={Surveys} />
      <Route path="/diversity" component={Diversity} />
      <Route path="/documents" component={Documents} />
      <Route path="/assets" component={Assets} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/rooms" component={Rooms} />
      <Route path="/shifts" component={Shifts} />
      <Route path="/timesheets" component={Timesheets} />
      <Route path="/loans" component={Loans} />
      <Route path="/project-tracking" component={ProjectTracking} />
      <Route path="/training" component={Training} />
      <Route path="/kudos" component={Kudos} />
      <Route path="/succession" component={Succession} />
      <Route path="/compliance" component={Compliance} />
      <Route path="/whistleblower" component={Whistleblower} />
      <Route path="/careers" component={CareerSite} />
      <Route path="/service-desk" component={ServiceDesk} />
      <Route path="/help-center" component={KnowledgeBase} />
      <Route path="/help-center/article/:slug" component={ArticleView} />
      <Route path="/benefits" component={Benefits} />
      <Route path="/visitors" component={Visitors} />
      <Route path="/salary" component={Salary} />
      <Route path="/audit" component={Audit} />
      <Route path="/emergency" component={Emergency} />
      <Route path="/timezones" component={Timezone} />
      <Route path="/health" component={SystemHealth} />
      <Route path="/org-chart" component={OrgChart} />
      <Route path="/leave" component={LeaveCalendar} />
      <Route path="/performance" component={Performance} />
      <Route path="/payroll" component={Payroll} />
      <Route path="/payslips" component={Payslips} />
      <Route path="/settings" component={Settings} />
      {/* Add other routes as placeholders for now */}
      <Route path="/attendance" component={LeaveCalendar} />
      <Route path="/attendance" component={Dashboard} />
      <Route path="/performance" component={Dashboard} />
      <Route path="/settings" component={Dashboard} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
