import Layout from "@/components/layout/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, MoreHorizontal, RefreshCw, MapPin, Mail, Building2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { EmployeeListRow } from "@shared/employeeTypes";

/** Role hierarchy for ordering: 0 = top (CEO), 3 = bottom (Employee). */
function getRoleOrder(jobTitle: string | null | undefined): number {
  const t = (jobTitle || "").toLowerCase().trim();
  if (t.includes("ceo") || t === "chief executive officer") return 0;
  if (t.includes("coo") || t === "chief operating officer") return 1;
  if (
    t.includes("manager") ||
    t.includes("director") ||
    t.includes("vp ") ||
    t.includes("vice president") ||
    t.includes("lead ") ||
    t.includes("head of")
  )
    return 2;
  return 3; // Employee / other
}

interface OrgNodeData {
  id: string;
  name: string;
  role: string;
  dept: string;
  img: string | null;
  employeeId: string;
  children: OrgNodeData[];
  location?: string | null;
  workEmail?: string | null;
  reportCount?: number;
}

function buildTree(employees: EmployeeListRow[]): OrgNodeData[] {
  const byId = new Map<string, EmployeeListRow>();
  employees.forEach((e) => byId.set(e.id, e));

  function toNode(emp: EmployeeListRow): OrgNodeData {
    const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(" ");
    return {
      id: emp.id,
      name: name || emp.work_email || "Unknown",
      role: emp.job_title || "Employee",
      dept: emp.department || "—",
      img: `/api/employees/${emp.id}/avatar`,
      employeeId: emp.employee_id || "",
      children: [],
      location: emp.location ?? null,
      workEmail: emp.work_email ?? null,
    };
  }

  const nodeMap = new Map<string, OrgNodeData>();
  employees.forEach((e) => nodeMap.set(e.id, toNode(e)));

  const roots: OrgNodeData[] = [];
  employees.forEach((e) => {
    const node = nodeMap.get(e.id)!;
    const managerId = e.manager_id?.trim() || null;
    if (!managerId || !nodeMap.has(managerId)) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(managerId)!;
      parent.children.push(node);
    }
  });

  function sortByRoleOrder(nodes: OrgNodeData[]) {
    nodes.sort((a, b) => {
      const orderA = getRoleOrder(a.role);
      const orderB = getRoleOrder(b.role);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortByRoleOrder(n.children));
  }
  sortByRoleOrder(roots);

  return roots;
}

/** Find path from root(s) down to the node with id = employeeId. Returns first path found. */
function findPathToEmployee(roots: OrgNodeData[], employeeId: string): OrgNodeData[] | null {
  function search(path: OrgNodeData[], node: OrgNodeData): OrgNodeData[] | null {
    const nextPath = [...path, node];
    if (node.id === employeeId) return nextPath;
    for (const child of node.children) {
      const found = search(nextPath, child);
      if (found) return found;
    }
    return null;
  }
  for (const root of roots) {
    const path = search([], root);
    if (path) return path;
  }
  return null;
}

/**
 * Build a tree showing only the logged-in employee's reporting line:
 * single chain CEO → … → COO → Manager → Employee. No siblings, no direct reports.
 * If currentEmployeeId is null or not in tree, returns full roots (admin view).
 */
function buildTreeForEmployee(
  roots: OrgNodeData[],
  currentEmployeeId: string | null
): OrgNodeData[] {
  if (!currentEmployeeId) return roots;
  const path = findPathToEmployee(roots, currentEmployeeId);
  if (!path || path.length === 0) return roots;
  if (path.length === 1) {
    return [{ ...path[0], children: [], reportCount: path[0].children.length }];
  }
  const chain: OrgNodeData = { ...path[0], children: [], reportCount: path[0].children.length };
  let current = chain;
  for (let i = 1; i < path.length; i++) {
    const next: OrgNodeData = {
      ...path[i],
      children: [],
      reportCount: path[i].children.length,
    };
    current.children = [next];
    current = next;
  }
  return [chain];
}

const OrgNode = ({
  data,
  level = 0,
  currentEmployeeId = null,
  isSingleChain = false,
}: {
  data: OrgNodeData;
  level?: number;
  currentEmployeeId?: string | null;
  isSingleChain?: boolean;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = data.children && data.children.length > 0;
  const isFocusedEmployee = !!currentEmployeeId && data.id === currentEmployeeId;
  const isCeo = (data.role || "").toLowerCase().includes("ceo");

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10"
      >
        <Card
          className={`w-72 p-4 flex flex-col items-center text-center rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all bg-white/95 group ${level === 0 ? "border-t-4 border-t-blue-600" : ""}`}
        >
          {hasChildren && !isSingleChain && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm z-20 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <Minus className="h-3 w-3 text-slate-500" />
              ) : (
                <Plus className="h-3 w-3 text-slate-500" />
              )}
            </Button>
          )}

          {!isSingleChain && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </div>
          )}

          <Avatar className="h-16 w-16 mb-3 border-2 border-slate-100 shadow-sm">
            <AvatarImage src={data.img || undefined} alt={data.name} />
            <AvatarFallback className="bg-slate-200 text-slate-600">
              {isCeo ? (
                <Building2 className="h-8 w-8 text-slate-500" />
              ) : (
                data.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              )}
            </AvatarFallback>
          </Avatar>

          <h3 className="font-bold text-slate-900 leading-tight">{data.name}</h3>
          <p className="text-blue-600 text-sm font-medium mb-1">{data.role}</p>
          {(data.reportCount ?? 0) > 0 && (
            <div className="flex justify-center mb-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                {data.reportCount}
              </span>
            </div>
          )}
          {isFocusedEmployee && (data.location || data.workEmail) && (
            <div className="mt-2 pt-2 border-t border-slate-100 w-full space-y-1.5 text-left">
              {data.location && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {data.location}
                </p>
              )}
              {data.workEmail && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 truncate" title={data.workEmail}>
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{data.workEmail}</span>
                </p>
              )}
            </div>
          )}
          {!isFocusedEmployee && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-[10px] mt-1">
              {data.dept}
            </Badge>
          )}
        </Card>
      </motion.div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center"
          >
            <div className="h-6 w-px bg-slate-300 shrink-0" />
            <div className="flex gap-8 pt-4 border-t border-slate-200 relative px-4">
              {data.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-slate-300" />
                  <OrgNode
                    data={child}
                    level={level + 1}
                    currentEmployeeId={currentEmployeeId}
                    isSingleChain={isSingleChain}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function OrgChart() {
  const { user } = useAuth();
  const currentEmployeeId = user?.employeeId ?? null;

  const {
    data: employees = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<EmployeeListRow[]>({
    queryKey: ["/api/employees", "org-chart"],
    queryFn: async () => {
      const res = await fetch("/api/employees?limit=2000&offset=0&includeInactive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load employees");
      const raw = await res.json();
      // API may return { data, total } when limit/offset used, or a plain array
      const list = raw && typeof raw === "object" && Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : [];
      return list;
    },
  });

  const fullRoots = buildTree(employees);
  const roots = buildTreeForEmployee(fullRoots, currentEmployeeId);

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Organizational Structure
          </h1>
          <p className="text-slate-500 text-sm">
            {currentEmployeeId
              ? "Your reporting line only: you → your manager → … → COO → CEO."
              : "CEO → COO → Manager → Employee. Full chart (no employee linked)."}
          </p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-card border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px] text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mr-2" />
          Loading organization…
        </div>
      ) : roots.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 text-center px-4">
          <p className="font-medium">No employees to display.</p>
          <p className="text-sm mt-1">
            Add employees or link them with managers to see the org chart.
          </p>
        </div>
      ) : (
        <div className="overflow-auto pb-20 pt-10 min-h-[600px] flex justify-center bg-gradient-to-b from-slate-50/80 to-slate-100/50 rounded-xl border border-slate-200/60">
          <div
            className={`min-w-max px-10 flex ${currentEmployeeId ? "flex-col items-center gap-0" : "gap-8 flex-wrap justify-center"}`}
          >
            {roots.map((root) => (
              <OrgNode
                key={root.id}
                data={root}
                level={0}
                currentEmployeeId={currentEmployeeId}
                isSingleChain={!!currentEmployeeId}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
