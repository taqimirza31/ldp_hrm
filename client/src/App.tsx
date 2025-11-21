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
import OrgChart from "@/pages/OrgChart";
import Payroll from "@/pages/Payroll";
import Performance from "@/pages/Performance";
import LeaveCalendar from "@/pages/LeaveCalendar";
import NewsFeed from "@/pages/NewsFeed";
import EmployeeProfile from "@/pages/EmployeeProfile";
import Settings from "@/pages/Settings";
import Onboarding from "@/pages/Onboarding";

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
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/org-chart" component={OrgChart} />
      <Route path="/leave" component={LeaveCalendar} />
      <Route path="/performance" component={Performance} />
      <Route path="/payroll" component={Payroll} />
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
