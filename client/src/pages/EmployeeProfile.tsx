import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, Phone, MapPin, Calendar, Building, 
  Download, Eye, Star, Clock, Home, Globe,
  Edit2, Camera, Bell, CheckCircle2, History,
  DollarSign, TrendingUp, AlertCircle, User,
  Shield, Save, X, Lock, Loader2,
  Laptop, Monitor, Key,
  UserPlus, ArrowRight, Upload, Trash2
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AssetCard } from "@/components/AssetCard";
import { CompensationTab } from "@/components/CompensationTab";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Helper to map API employee to frontend format
interface EmployeeData {
  id: string;
  employeeId: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  subDepartment?: string;
  businessUnit?: string;
  primaryTeam?: string;
  costCenter?: string;
  grade?: string;
  jobCategory?: string;
  email: string;
  personalEmail?: string;
  workPhone?: string;
  location?: string;
  status: string;
  employeeType?: string;
  shift?: string;
  joinDate: string;
  avatar?: string;
  managerId?: string;
  managerEmail?: string;
  hrEmail?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  probationStartDate?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  noticePeriod?: string;
  resignationDate?: string;
  lastWorkingDate?: string;
  exitType?: string;
  eligibleForRehire?: boolean;
  resignationReason?: string;
  customField1?: string;
  customField2?: string;
}

// Format date for display (e.g., "Feb 10, 2026")
function formatDisplayDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function mapApiToEmployee(api: any): EmployeeData {
  const statusMap: Record<string, string> = {
    active: "Active",
    onboarding: "Onboarding",
    on_leave: "On Leave",
    terminated: "Terminated",
    resigned: "Resigned",
  };
  
  return {
    id: api.id,
    employeeId: api.employee_id,
    name: `${api.first_name} ${api.last_name}`,
    firstName: api.first_name,
    lastName: api.last_name,
    role: api.job_title,
    department: api.department,
    subDepartment: api.sub_department,
    businessUnit: api.business_unit,
    primaryTeam: api.primary_team,
    costCenter: api.cost_center,
    grade: api.grade,
    jobCategory: api.job_category,
    email: api.work_email,
    personalEmail: api.personal_email,
    workPhone: api.work_phone,
    location: api.location || api.city,
    status: statusMap[api.employment_status] || api.employment_status,
    employeeType: api.employee_type,
    shift: api.shift,
    joinDate: api.join_date,
    avatar: api.avatar,
    managerId: api.manager_id,
    managerEmail: api.manager_email,
    hrEmail: api.hr_email,
    dob: api.dob,
    gender: api.gender,
    maritalStatus: api.marital_status,
    bloodGroup: api.blood_group,
    street: api.street,
    city: api.city,
    state: api.state,
    country: api.country,
    zipCode: api.zip_code,
    probationStartDate: api.probation_start_date,
    probationEndDate: api.probation_end_date,
    confirmationDate: api.confirmation_date,
    noticePeriod: api.notice_period,
    resignationDate: api.resignation_date,
    lastWorkingDate: api.exit_date,
    exitType: api.exit_type,
    eligibleForRehire: api.eligible_for_rehire,
    resignationReason: api.resignation_reason,
    customField1: api.custom_field_1,
    customField2: api.custom_field_2,
  };
}

export default function EmployeeProfile() {
  const [match, params] = useRoute("/employees/:id");
  const { user, isAdmin, isHR } = useAuth();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingDependents, setIsEditingDependents] = useState(false);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [isEditingSocial, setIsEditingSocial] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Personal details form state
  const [personalData, setPersonalData] = useState({
    dob: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    personalEmail: "",
    workPhone: "",
  });

  // Address form state
  const [addressData, setAddressData] = useState({
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  });

  // Admin edit form data
  const [editData, setEditData] = useState({
    firstName: "",
    lastName: "",
    workEmail: "",
    status: "",
    employeeType: "",
    businessUnit: "",
    costCenter: "",
    managerId: "",
    hrManagerId: "",
    role: "",
    grade: "",
    shift: "",
    jobCategory: "",
    noticePeriod: "",
    probationStartDate: "",
    probationEndDate: "",
    confirmationDate: "",
  });

  // Initialize edit data when entering edit mode
  const startEditing = () => {
    if (employee) {
      setEditData({
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        workEmail: employee.email || "",
        status: employee.status || "Active",
        employeeType: employee.employeeType || "",
        businessUnit: employee.businessUnit || "",
        costCenter: employee.costCenter || "",
        managerId: employee.managerId || "",
        hrManagerId: "", // will be resolved from hrEmail below
        role: employee.role || "",
        grade: employee.grade || "",
        shift: employee.shift || "",
        jobCategory: employee.jobCategory || "",
        noticePeriod: employee.noticePeriod || "",
        probationStartDate: employee.probationStartDate || "",
        probationEndDate: employee.probationEndDate || "",
        confirmationDate: employee.confirmationDate || "",
      });
    }
    setIsEditingAdmin(true);
  };

  const handleEditChange = (field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };
  
  const id = params?.id;

  // Refetch when asset changes or onboarding completes (employee-updated event)
  const queryClient = useQueryClient();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ employeeId: string }>).detail;
      if (detail?.employeeId === id) {
        setRefreshTrigger((t) => t + 1);
        // Also refresh the React Query asset cache
        queryClient.invalidateQueries({ queryKey: ["/api/assets/systems/user", id] });
      }
    };
    window.addEventListener("employee-updated", handler);
    return () => window.removeEventListener("employee-updated", handler);
  }, [id, queryClient]);

  // Fetch employee from API
  useEffect(() => {
    async function fetchEmployee() {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/employees/${id}`, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 404) {
            setError("Employee not found");
          } else {
            setError("Failed to load employee");
          }
          return;
        }

        const data = await res.json();
        setEmployee(mapApiToEmployee(data));
      } catch (err) {
        console.error("Error fetching employee:", err);
        setError("Failed to load employee");
      } finally {
        setLoading(false);
      }
    }

    fetchEmployee();
  }, [id, refreshTrigger]);
  
  // Onboarding: check if employee has active onboarding
  const [onboardingRecord, setOnboardingRecord] = useState<{ id: string; status: string } | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [startOnboardingLoading, setStartOnboardingLoading] = useState(false);

  useEffect(() => {
    async function fetchOnboarding() {
      if (!id) return;
      setOnboardingLoading(true);
      try {
        const res = await fetch(`/api/onboarding/employee/${id}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setOnboardingRecord({ id: data.id, status: data.status });
        } else {
          setOnboardingRecord(null);
        }
      } catch {
        setOnboardingRecord(null);
      } finally {
        setOnboardingLoading(false);
      }
    }
    fetchOnboarding();
  }, [id, refreshTrigger]);

  const handleStartOnboarding = async () => {
    if (!employee?.id) return;
    setStartOnboardingLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId: employee.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start onboarding");
      }
      const data = await res.json();
      setOnboardingRecord({ id: data.id, status: "in_progress" });
      toast.success("Onboarding started", {
        description: "IT Admin will be notified. Track progress on the Onboarding page.",
      });
      window.location.href = "/onboarding";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start onboarding");
    } finally {
      setStartOnboardingLoading(false);
    }
  };

  // Fetch assigned systems/assets for this employee (React Query for cache invalidation from Assets/Onboarding)
  const { data: assignedAssetsRaw = [], isLoading: assetsLoading } = useQuery({
    queryKey: ["/api/assets/systems/user", id],
    queryFn: async ({ queryKey }) => {
      const empId = queryKey[1];
      if (!empId) return [];
      const res = await fetch(`/api/assets/systems/user/${empId}`, {
        credentials: "include",
        cache: "no-store", // Always get fresh data, don't use browser cache
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!id,
    staleTime: 0, // Override global staleTime so invalidation/refetch always fetches fresh data
    refetchOnMount: "always", // Always refetch when this component mounts (e.g. navigating back)
  });
  const assignedAssets = Array.isArray(assignedAssetsRaw) ? assignedAssetsRaw : [];

  // Leave (timeoff) — synced with Leave Calendar
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["/api/leave/balances", employee?.id],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/leave/balances/${employee!.id}`);
      return r.json();
    },
    enabled: !!employee?.id,
  });
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["/api/leave/employee", employee?.id, "requests"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/leave/employee/${employee!.id}/requests`);
      return r.json();
    },
    enabled: !!employee?.id,
  });

  // Employee documents (from tentative verification + manual HR uploads)
  const { data: employeeDocuments = [] } = useQuery<Array<{ id: string; display_name: string | null; document_type: string; file_name: string | null; source: string; uploaded_at: string | null; created_at: string }>>({
    queryKey: ["/api/employees", employee?.id, "documents"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/employees/${employee!.id}/documents`);
      return r.json();
    },
    enabled: !!employee?.id,
  });

  // Manual document upload (HR)
  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const handleUploadDocument = async () => {
    if (!employee?.id || !uploadFile) {
      toast.error("Please select a file");
      return;
    }
    setUploadLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const fileUrl = reader.result as string;
          const fileName = uploadFile.name;
          const displayName = (uploadDisplayName && uploadDisplayName.trim()) || fileName;
          const r = await apiRequest("POST", `/api/employees/${employee.id}/documents`, { displayName, fileUrl, fileName });
          if (!r.ok) throw new Error(await r.text());
          toast.success("Document uploaded");
          queryClient.invalidateQueries({ queryKey: ["/api/employees", employee.id, "documents"] });
          setUploadDocOpen(false);
          setUploadDisplayName("");
          setUploadFile(null);
        } catch (e: any) {
          toast.error(e?.message || "Upload failed");
        } finally {
          setUploadLoading(false);
        }
      };
      reader.readAsDataURL(uploadFile);
    } catch {
      setUploadLoading(false);
      toast.error("Upload failed");
    }
  };
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Remove this document from the employee profile?")) return;
    try {
      const r = await apiRequest("DELETE", `/api/employees/documents/${docId}`);
      if (!r.ok) throw new Error(await r.text());
      toast.success("Document removed");
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employee?.id, "documents"] });
    } catch {
      toast.error("Could not remove document");
    }
  };

  const [syncTentativeLoading, setSyncTentativeLoading] = useState(false);
  const handleSyncTentativeDocuments = async () => {
    if (!employee?.id) return;
    setSyncTentativeLoading(true);
    try {
      const r = await apiRequest("POST", `/api/employees/${employee.id}/sync-tentative-documents`);
      const data = await r.json();
      toast.success(data.message || "Documents synced");
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employee.id, "documents"] });
    } catch (e: any) {
      const msg = e?.message || "Sync failed";
      toast.error(msg.includes("No cleared tentative") ? "No tentative verification found for this employee" : msg);
    } finally {
      setSyncTentativeLoading(false);
    }
  };

  // All employees (for reporting-line dropdowns)
  const { data: allEmployees = [] } = useQuery<Array<{ id: string; first_name: string; last_name: string; work_email: string; job_title: string; department: string; avatar?: string }>>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/employees");
      return r.json();
    },
  });

  // Helper: find employee name by id
  const empById = (empId?: string | null) => allEmployees.find((e) => e.id === empId);
  // Helper: find employee by work_email (for HR partner backward compat)
  const empByEmail = (email?: string | null) => email ? allEmployees.find((e) => e.work_email?.toLowerCase() === email.toLowerCase()) : undefined;

  // Resolve hrManagerId when entering edit mode (from hrEmail → employee id)
  useEffect(() => {
    if (isEditingAdmin && employee?.hrEmail && allEmployees.length > 0 && !editData.hrManagerId) {
      const hrEmp = empByEmail(employee.hrEmail);
      if (hrEmp) setEditData((prev) => ({ ...prev, hrManagerId: hrEmp.id }));
    }
  }, [isEditingAdmin, employee?.hrEmail, allEmployees.length]);

  // Role-based permissions
  const canAdminEdit = isAdmin || isHR; // Admin/HR can edit core fields
  const isOwnProfile = user?.employeeId === id; // Check if viewing own profile
  const canViewSensitive = canAdminEdit || isOwnProfile; // Can see salary, personal info

  const handleAdminSave = async () => {
    if (!employee) return;
    
    setIsSaving(true);
    try {
      // Map status back to API format
      const statusMap: Record<string, string> = {
        "Active": "active",
        "Onboarding": "onboarding",
        "On Leave": "on_leave",
        "Terminated": "terminated",
        "Resigned": "resigned",
      };

      const workEmailTrimmed = editData.workEmail?.trim() || "";
      if (workEmailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmailTrimmed)) {
        toast.error("Please enter a valid work email address");
        return;
      }

      // Resolve manager / HR partner: dropdown gives us employee ID, derive email for backward compat
      const selectedManager = editData.managerId ? empById(editData.managerId) : undefined;
      const selectedHR = editData.hrManagerId ? empById(editData.hrManagerId) : undefined;

      const payload = {
        firstName: editData.firstName,
        lastName: editData.lastName,
        workEmail: workEmailTrimmed || null,
        employmentStatus: statusMap[editData.status] || editData.status.toLowerCase(),
        employeeType: editData.employeeType,
        businessUnit: editData.businessUnit,
        costCenter: editData.costCenter,
        manager_id: editData.managerId || null,
        managerEmail: selectedManager?.work_email || employee?.managerEmail || null,
        hrEmail: selectedHR?.work_email || employee?.hrEmail || null,
        jobTitle: editData.role,
        grade: editData.grade || null,
        shift: editData.shift || null,
        jobCategory: editData.jobCategory || null,
        noticePeriod: editData.noticePeriod || null,
        probationStartDate: editData.probationStartDate || null,
        probationEndDate: editData.probationEndDate || null,
        confirmationDate: editData.confirmationDate || null,
      };

      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update employee");
      }

      // Refresh employee data
      const updatedRes = await fetch(`/api/employees/${employee.id}`, {
        credentials: "include",
      });
      if (updatedRes.ok) {
        const updatedData = await updatedRes.json();
        setEmployee(mapApiToEmployee(updatedData));
      }

      setIsEditingAdmin(false);
      toast.success("Profile updated successfully", {
        description: "Core employee record has been modified.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingPersonal = () => {
    if (employee) {
      setPersonalData({
        dob: employee.dob || "",
        gender: employee.gender || "",
        maritalStatus: employee.maritalStatus || "",
        bloodGroup: employee.bloodGroup || "",
        personalEmail: employee.personalEmail || "",
        workPhone: employee.workPhone || "",
      });
    }
    setIsEditingPersonal(true);
  };

  const handlePersonalSave = async () => {
    if (!employee) return;
    
    setIsSavingPersonal(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dob: personalData.dob || null,
          gender: personalData.gender || null,
          maritalStatus: personalData.maritalStatus || null,
          bloodGroup: personalData.bloodGroup || null,
          personalEmail: personalData.personalEmail || null,
          workPhone: personalData.workPhone || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      // Refresh employee data
      const updatedRes = await fetch(`/api/employees/${employee.id}`, { credentials: "include" });
      if (updatedRes.ok) {
        const updatedData = await updatedRes.json();
        setEmployee(mapApiToEmployee(updatedData));
      }

      setIsEditingPersonal(false);
      toast.success("Personal details updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const startEditingAddress = () => {
    if (employee) {
      setAddressData({
        street: employee.street || "",
        city: employee.city || "",
        state: employee.state || "",
        zipCode: employee.zipCode || "",
        country: employee.country || "",
      });
    }
    setIsEditingAddress(true);
  };

  const handleAddressSave = async () => {
    if (!employee) return;
    
    setIsSavingAddress(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          street: addressData.street || null,
          city: addressData.city || null,
          state: addressData.state || null,
          zipCode: addressData.zipCode || null,
          country: addressData.country || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      // Refresh employee data
      const updatedRes = await fetch(`/api/employees/${employee.id}`, { credentials: "include" });
      if (updatedRes.ok) {
        const updatedData = await updatedRes.json();
        setEmployee(mapApiToEmployee(updatedData));
      }

      setIsEditingAddress(false);
      toast.success("Address updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDependentsSave = () => {
    setIsEditingDependents(false);
    toast.success("Dependent information update sent to HR", {
      description: "You will be notified once the changes are approved.",
      duration: 4000,
    });
  };

  const handleEmergencySave = () => {
    setIsEditingEmergency(false);
    toast.success("Emergency contacts update sent to HR", {
      description: "You will be notified once the changes are approved.",
      duration: 4000,
    });
  };

  const handleSocialSave = () => {
    setIsEditingSocial(false);
    toast.success("Social profiles updated", {
      description: "Your changes have been saved.",
      duration: 3000,
    });
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      
      try {
        const res = await fetch(`/api/employees/${employee.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ avatar: base64 }),
        });

        if (!res.ok) {
          throw new Error("Failed to update avatar");
        }

        // Update local state
        setEmployee({ ...employee, avatar: base64 });
        toast.success("Profile picture updated");
      } catch (err) {
        toast.error("Failed to update profile picture");
      }
    };
    reader.readAsDataURL(file);
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading employee profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !employee) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">{error || "Employee not found"}</h2>
          <p className="text-muted-foreground">The employee you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link href="/employees">
            <Button>Back to Directory</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <Link href="/employees">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground">
            ← Back to Directory
          </Button>
        </Link>
        
        <div className="flex items-center gap-4">
          {/* Role indicator */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
            <Shield className="h-3 w-3 text-slate-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Viewing as: <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">{user?.role}</span>
            </span>
            {isOwnProfile && (
              <Badge variant="outline" className="text-[10px] ml-1 bg-green-50 text-green-700 border-green-200">
                Your Profile
              </Badge>
            )}
          </div>

          {/* Start Onboarding (Admin/HR only: show only for employees still in Onboarding status with no record, or no record and not yet active) */}
          {canAdminEdit && !onboardingLoading && !onboardingRecord && employee?.status !== "Active" && (
            <Button
              onClick={handleStartOnboarding}
              disabled={startOnboardingLoading}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {startOnboardingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {startOnboardingLoading ? "Starting…" : "Start Onboarding"}
            </Button>
          )}
          {canAdminEdit && onboardingRecord?.status === "in_progress" && (
            <Link href="/onboarding">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4" /> View Onboarding
              </Button>
            </Link>
          )}
          {canAdminEdit && onboardingRecord?.status === "completed" && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
              Onboarding completed
            </Badge>
          )}
          {/* Admin/HR Edit Button */}
          {canAdminEdit && (
            isEditingAdmin ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditingAdmin(false)} disabled={isSaving} className="gap-2">
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button size="sm" onClick={handleAdminSave} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? "Saving..." : "Save Record"}
                </Button>
              </div>
            ) : (
              <Button onClick={startEditing} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                <Edit2 className="h-4 w-4" /> Edit Profile
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
              <div className="absolute -bottom-12 left-6 group">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-card shadow-sm cursor-pointer group-hover:opacity-90 transition-opacity">
                    <AvatarImage src={employee.avatar} />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {(canAdminEdit || isOwnProfile) && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarClick}>
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="pt-16 pb-6 px-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                  <p className="text-primary font-medium">{employee.role}</p>
                </div>
                {isEditingAdmin ? (
                   <Select value={editData.status} onValueChange={(v) => handleEditChange("status", v)} disabled={isSaving}>
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Onboarding">Onboarding</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Terminated">Terminated</SelectItem>
                      <SelectItem value="Resigned">Resigned</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`
                    ${employee.status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 
                      employee.status === 'Terminated' || employee.status === 'Resigned' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 
                      employee.status === 'Onboarding' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                      'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'}
                  `}>
                    {employee.status}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Badge variant="outline" className="mr-3 font-mono text-xs border-border">{employee.employeeId}</Badge>
                  ID: {employee.employeeId}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Building className="h-4 w-4 mr-3 text-muted-foreground" />
                  {employee.department} {employee.subDepartment ? `• ${employee.subDepartment}` : ''}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-3 text-muted-foreground" />
                  {employee.location}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 mr-3 text-muted-foreground" />
                  {employee.email}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 mr-3 text-muted-foreground" />
                  {employee.workPhone || "+1 (555) 000-0000"}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
                  Joined {formatDisplayDate(employee.joinDate) || employee.joinDate}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  type="button"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    window.location.href = `mailto:${employee.email}`;
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" /> Message
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full border-border bg-card hover:bg-muted text-foreground"
                  onClick={() => {
                    toast.info("Calendar integration coming soon", {
                      description: "This feature will be available when calendar module is implemented."
                    });
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" /> Schedule
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground">Reporting Lines</CardTitle>
              {isEditingAdmin && (
                <Badge variant="outline" className="text-[10px] font-normal bg-blue-50 text-blue-700 border-blue-200">Editing</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingAdmin ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="workEmail" className="text-xs">Work Email</Label>
                    <Input
                      id="workEmail"
                      type="email"
                      placeholder="name@company.com"
                      value={editData.workEmail}
                      onChange={(e) => handleEditChange("workEmail", e.target.value)}
                      className="h-9 text-sm"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Reporting Manager</Label>
                    <Select
                      value={editData.managerId || "__none__"}
                      onValueChange={(v) => handleEditChange("managerId", v === "__none__" ? "" : v)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {allEmployees
                          .filter((e) => e.id !== id)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.first_name} {e.last_name}{e.job_title ? ` · ${e.job_title}` : ""}{e.department ? ` · ${e.department}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">HR Partner</Label>
                    <Select
                      value={editData.hrManagerId || "__none__"}
                      onValueChange={(v) => handleEditChange("hrManagerId", v === "__none__" ? "" : v)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select HR partner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {allEmployees
                          .filter((e) => e.id !== id)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.first_name} {e.last_name}{e.job_title ? ` · ${e.job_title}` : ""}{e.department ? ` · ${e.department}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const mgr = empById(employee.managerId);
                    const mgrName = mgr ? `${mgr.first_name} ${mgr.last_name}` : null;
                    const mgrAvatar = mgr?.avatar || (mgrName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(mgrName)}` : undefined);
                    return (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {mgrAvatar ? <AvatarImage src={mgrAvatar} /> : null}
                          <AvatarFallback>M</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {mgrName || <span className="text-muted-foreground italic">Not assigned</span>}
                          </p>
                          {mgr?.job_title && <p className="text-[11px] text-muted-foreground truncate">{mgr.job_title}</p>}
                          <p className="text-xs text-muted-foreground truncate">Manager</p>
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const hrEmp = empByEmail(employee.hrEmail);
                    const hrName = hrEmp ? `${hrEmp.first_name} ${hrEmp.last_name}` : null;
                    const hrAvatar = hrEmp?.avatar || (hrName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(hrName)}` : (employee.hrEmail ? `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.hrEmail)}` : undefined));
                    return (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {hrAvatar ? <AvatarImage src={hrAvatar} /> : null}
                          <AvatarFallback>HR</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {hrName || employee.hrEmail || <span className="text-muted-foreground italic">Not assigned</span>}
                          </p>
                          {hrEmp?.job_title && <p className="text-[11px] text-muted-foreground truncate">{hrEmp.job_title}</p>}
                          <p className="text-xs text-muted-foreground truncate">HR Partner</p>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-muted p-1 mb-6 w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="job">Job & Pay</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="compensation">Compensation</TabsTrigger>
              <TabsTrigger value="timeoff">Timeoff</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              {employee.status === 'Terminated' && <TabsTrigger value="exit" className="text-destructive">Exit Details</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border border-border shadow-sm bg-card">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Performance</p>
                    <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
                      4.9 <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    </p>
                  </CardContent>
                </Card>
                <Card className="border border-border shadow-sm bg-card">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Projects</p>
                    <p className="text-2xl font-bold text-foreground">12</p>
                  </CardContent>
                </Card>
                <Card className="border border-border shadow-sm bg-card">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">PTO Balance</p>
                    <p className="text-2xl font-bold text-foreground">
                      {leaveBalances.length > 0 ? `${leaveBalances.reduce((sum: number, b: { balance?: string }) => sum + parseFloat(String(b.balance || 0)), 0)}d` : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* General Info Grid */}
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Core Information</CardTitle>
                  {isEditingAdmin && <Badge variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 border-blue-200">Admin Editing</Badge>}
                </CardHeader>
                <CardContent>
                  {isEditingAdmin ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" value={editData.firstName} onChange={(e) => handleEditChange("firstName", e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" value={editData.lastName} onChange={(e) => handleEditChange("lastName", e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" value={`${editData.firstName} ${editData.lastName}`} disabled className="bg-muted" />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="empType">Employee Type</Label>
                        <Select value={editData.employeeType} onValueChange={(v) => handleEditChange("employeeType", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                            <SelectItem value="temporary">Temporary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bu">Business Unit</Label>
                        <Select value={editData.businessUnit} onValueChange={(v) => handleEditChange("businessUnit", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Technology">Technology</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="costCenter">Cost Center</Label>
                        <Input id="costCenter" value={editData.costCenter} onChange={(e) => handleEditChange("costCenter", e.target.value)} disabled={isSaving} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground">First Name</p>
                        <p className="font-medium text-foreground">{employee.firstName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Name</p>
                        <p className="font-medium text-foreground">{employee.lastName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Display Name</p>
                        <p className="font-medium text-foreground">{employee.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Employee Type</p>
                        <p className="font-medium text-foreground">{employee.employeeType || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Business Unit</p>
                        <p className="font-medium text-foreground">{employee.businessUnit || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cost Center</p>
                        <p className="font-medium text-foreground">{employee.costCenter || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
               <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Personal Details</CardTitle>
                  {!isEditingPersonal ? (
                    <Button variant="ghost" size="sm" onClick={startEditingPersonal}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingPersonal(false)} disabled={isSavingPersonal}>Cancel</Button>
                      <Button size="sm" onClick={handlePersonalSave} disabled={isSavingPersonal}>
                        {isSavingPersonal ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingPersonal ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input id="dob" type="date" value={personalData.dob} onChange={(e) => setPersonalData(p => ({ ...p, dob: e.target.value }))} disabled={isSavingPersonal} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select value={personalData.gender} onValueChange={(v) => setPersonalData(p => ({ ...p, gender: v }))} disabled={isSavingPersonal}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marital">Marital Status</Label>
                        <Select value={personalData.maritalStatus} onValueChange={(v) => setPersonalData(p => ({ ...p, maritalStatus: v }))} disabled={isSavingPersonal}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bloodGroup">Blood Group</Label>
                        <Select value={personalData.bloodGroup} onValueChange={(v) => setPersonalData(p => ({ ...p, bloodGroup: v }))} disabled={isSavingPersonal}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A+">A+</SelectItem>
                            <SelectItem value="A-">A-</SelectItem>
                            <SelectItem value="B+">B+</SelectItem>
                            <SelectItem value="B-">B-</SelectItem>
                            <SelectItem value="O+">O+</SelectItem>
                            <SelectItem value="O-">O-</SelectItem>
                            <SelectItem value="AB+">AB+</SelectItem>
                            <SelectItem value="AB-">AB-</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Work Phone</Label>
                        <Input id="phone" value={personalData.workPhone} onChange={(e) => setPersonalData(p => ({ ...p, workPhone: e.target.value }))} disabled={isSavingPersonal} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personalEmail">Personal Email</Label>
                        <Input id="personalEmail" type="email" value={personalData.personalEmail} onChange={(e) => setPersonalData(p => ({ ...p, personalEmail: e.target.value }))} disabled={isSavingPersonal} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground">Date of Birth</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.dob) || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="font-medium text-foreground capitalize">{employee.gender || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Marital Status</p>
                        <p className="font-medium text-foreground capitalize">{employee.maritalStatus || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Blood Group</p>
                        <p className="font-medium text-foreground">{employee.bloodGroup || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Personal Email</p>
                        <p className="font-medium text-foreground">{employee.personalEmail || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Work Phone</p>
                        <p className="font-medium text-foreground">{employee.workPhone || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Home Address</CardTitle>
                  {!isEditingAddress ? (
                    <Button variant="ghost" size="sm" onClick={startEditingAddress}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingAddress(false)} disabled={isSavingAddress}>Cancel</Button>
                      <Button size="sm" onClick={handleAddressSave} disabled={isSavingAddress}>
                        {isSavingAddress ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingAddress ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input id="street" value={addressData.street} onChange={(e) => setAddressData(a => ({ ...a, street: e.target.value }))} disabled={isSavingAddress} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={addressData.city} onChange={(e) => setAddressData(a => ({ ...a, city: e.target.value }))} disabled={isSavingAddress} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input id="state" value={addressData.state} onChange={(e) => setAddressData(a => ({ ...a, state: e.target.value }))} disabled={isSavingAddress} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">Zip Code</Label>
                        <Input id="zipCode" value={addressData.zipCode} onChange={(e) => setAddressData(a => ({ ...a, zipCode: e.target.value }))} disabled={isSavingAddress} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" value={addressData.country} onChange={(e) => setAddressData(a => ({ ...a, country: e.target.value }))} disabled={isSavingAddress} />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Street</p>
                        <p className="font-medium text-foreground">{employee.street || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">City</p>
                        <p className="font-medium text-foreground">{employee.city || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">State</p>
                        <p className="font-medium text-foreground">{employee.state || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Zip Code</p>
                        <p className="font-medium text-foreground">{employee.zipCode || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="font-medium text-foreground">{employee.country || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm bg-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Dependents</CardTitle>
                    {!isEditingDependents ? (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingDependents(true)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                         <Button variant="ghost" size="sm" onClick={() => setIsEditingDependents(false)}>Cancel</Button>
                         <Button size="sm" onClick={handleDependentsSave}>Save</Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEditingDependents ? (
                      <div className="space-y-4">
                         <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm h-24">
                            + Add New Dependent
                         </div>
                         <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                            <Label className="text-xs">Existing Dependent 1</Label>
                            <Input defaultValue="Sarah Morgan" className="h-8 text-sm" />
                         </div>
                         <div className="col-span-2 p-2 bg-yellow-50 text-yellow-800 text-[10px] rounded-md flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 mt-0.5" />
                            <div>
                              Updates require approval.
                            </div>
                          </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">Sarah Morgan</p>
                            <p className="text-xs text-muted-foreground">Spouse</p>
                          </div>
                          <Badge variant="outline">Primary</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">Leo Morgan</p>
                            <p className="text-xs text-muted-foreground">Child</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-border shadow-sm bg-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Emergency Contacts</CardTitle>
                    {!isEditingEmergency ? (
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingEmergency(true)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                         <Button variant="ghost" size="sm" onClick={() => setIsEditingEmergency(false)}>Cancel</Button>
                         <Button size="sm" onClick={handleEmergencySave}>Save</Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEditingEmergency ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                           <Label className="text-xs">Contact 1 Name</Label>
                           <Input defaultValue="Sarah Morgan" className="h-8 text-sm" />
                           <Label className="text-xs">Phone</Label>
                           <Input defaultValue="+1 (555) 111-2222" className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 p-2 bg-yellow-50 text-yellow-800 text-[10px] rounded-md flex items-start gap-2">
                            <AlertCircle className="h-3 w-3 mt-0.5" />
                            <div>
                              Updates require approval.
                            </div>
                          </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <p className="font-medium text-sm">Sarah Morgan</p>
                            <Badge variant="secondary" className="text-[10px]">Spouse</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> +1 (555) 111-2222
                          </p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <p className="font-medium text-sm">John Doe</p>
                            <Badge variant="secondary" className="text-[10px]">Father</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> +1 (555) 333-4444
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Social Profiles</CardTitle>
                  {!isEditingSocial ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingSocial(true)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingSocial(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSocialSave}>Save Changes</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingSocial ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <div className="space-y-2">
                          <Label htmlFor="linkedin" className="flex items-center gap-2"><Globe className="h-3 w-3" /> LinkedIn</Label>
                          <Input id="linkedin" defaultValue="linkedin.com/in/alex" />
                       </div>
                       <div className="space-y-2">
                          <Label htmlFor="github" className="flex items-center gap-2"><Globe className="h-3 w-3" /> GitHub</Label>
                          <Input id="github" defaultValue="github.com/alex" />
                       </div>
                       <div className="space-y-2">
                          <Label htmlFor="portfolio" className="flex items-center gap-2"><Globe className="h-3 w-3" /> Portfolio</Label>
                          <Input id="portfolio" defaultValue="alex.design" />
                       </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> LinkedIn
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> GitHub
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" /> Portfolio
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job" className="space-y-6">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Employment Details</CardTitle>
                  {isEditingAdmin ? (
                    <Badge variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 border-blue-200">Admin Editing</Badge>
                  ) : (
                    !canAdminEdit && <Lock className="h-4 w-4 text-muted-foreground opacity-50" />
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingAdmin ? (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Input id="designation" value={editData.role} onChange={(e) => handleEditChange("role", e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="grade">Grade</Label>
                        <Select value={editData.grade} onValueChange={(v) => handleEditChange("grade", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="L1">L1 - Junior</SelectItem>
                            <SelectItem value="L2">L2 - Associate</SelectItem>
                            <SelectItem value="L3">L3 - Mid</SelectItem>
                            <SelectItem value="L4">L4 - Senior</SelectItem>
                            <SelectItem value="L5">L5 - Lead</SelectItem>
                            <SelectItem value="L6">L6 - Principal</SelectItem>
                            <SelectItem value="L7">L7 - Director</SelectItem>
                            <SelectItem value="L8">L8 - VP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shift">Shift</Label>
                        <Select value={editData.shift} onValueChange={(v) => handleEditChange("shift", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Day Shift">Day Shift</SelectItem>
                            <SelectItem value="Night Shift">Night Shift</SelectItem>
                            <SelectItem value="Rotational">Rotational</SelectItem>
                            <SelectItem value="Flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobCategory">Job Category</Label>
                        <Select value={editData.jobCategory} onValueChange={(v) => handleEditChange("jobCategory", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Software">Software Engineering</SelectItem>
                            <SelectItem value="Product">Product Management</SelectItem>
                            <SelectItem value="Design">Design</SelectItem>
                            <SelectItem value="Data">Data & Analytics</SelectItem>
                            <SelectItem value="Operations">Operations</SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="probationStart">Probation Start</Label>
                        <Input id="probationStart" type="date" value={editData.probationStartDate} onChange={(e) => handleEditChange("probationStartDate", e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="probationEnd">Probation End</Label>
                        <Input id="probationEnd" type="date" value={editData.probationEndDate} onChange={(e) => handleEditChange("probationEndDate", e.target.value)} disabled={isSaving} />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="confirmDate">Confirmation Date</Label>
                        <Input id="confirmDate" type="date" value={editData.confirmationDate} onChange={(e) => handleEditChange("confirmationDate", e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notice">Notice Period</Label>
                        <Select value={editData.noticePeriod} onValueChange={(v) => handleEditChange("noticePeriod", v)} disabled={isSaving}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select notice" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15 Days">15 Days</SelectItem>
                            <SelectItem value="30 Days">30 Days</SelectItem>
                            <SelectItem value="60 Days">60 Days</SelectItem>
                            <SelectItem value="90 Days">90 Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground">Designation</p>
                        <p className="font-medium text-foreground">{employee.role}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Grade</p>
                        <p className="font-medium text-foreground">{employee.grade || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Shift</p>
                        <p className="font-medium text-foreground">{employee.shift || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Job Category</p>
                        <p className="font-medium text-foreground">{employee.jobCategory || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Probation Start</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.probationStartDate) || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Probation End</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.probationEndDate) || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Confirmation Date</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.confirmationDate) || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                       <div>
                        <p className="text-xs text-muted-foreground">Notice Period</p>
                        <p className="font-medium text-foreground">{employee.noticePeriod || <span className="text-muted-foreground">-</span>}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Laptop className="h-5 w-5" />
                    Assigned Systems & Equipment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assetsLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading assets...
                    </div>
                  ) : assignedAssets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Monitor className="h-12 w-12 mx-auto mb-3 opacity-40" />
                      <p className="font-medium">No assets assigned</p>
                      <p className="text-sm mt-1">Equipment will appear here once assigned via IT onboarding.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assignedAssets.map((asset: any) => (
                        <AssetCard key={asset.id} asset={asset} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Onboarding Items Summary */}
              {employee && (employee.customField1 || employee.customField2) && (
                <Card className="border border-border shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Onboarding Assignments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {employee.customField1 && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Key className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Microsoft Account</p>
                            <p className="text-sm font-medium">{employee.customField1.replace("MS Account: ", "")}</p>
                          </div>
                        </div>
                      )}
                      {employee.customField2 && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Laptop className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Assigned Laptop</p>
                            <p className="text-sm font-medium">{employee.customField2.replace("Laptop: ", "")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <CompensationTab employeeId={employee?.id} canEdit={canAdminEdit} />

            <TabsContent value="timeoff" className="space-y-6">
              <p className="text-sm text-muted-foreground">All leave types (Earned Leave, LWOP, Bereavement) are synced with Leave Management. Same data appears on the Leave Calendar.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {leaveBalances.length === 0 ? (
                  <Card className="border border-dashed">
                    <CardContent className="p-6 text-center text-muted-foreground text-sm">
                      No leave types found. Run migration 0021 to create the standard policy.
                    </CardContent>
                  </Card>
                ) : (
                  leaveBalances.map((b: { id?: string; leave_type_id?: string; type_name: string; balance: string; used: string; max_balance: number; color?: string; paid?: boolean }) => {
                    const isUnpaid = b.paid === false;
                    const bal = parseFloat(String(b.balance));
                    const used = parseFloat(String(b.used));
                    const max = b.max_balance || 1;
                    const pct = max > 0 && !isUnpaid ? Math.round((bal / max) * 100) : 0;
                    return (
                      <Card key={b.id ?? b.leave_type_id ?? b.type_name} className="border-l-4 shadow-sm" style={{ borderLeftColor: b.color || "#3b82f6" }}>
                        <CardContent className="p-6">
                          <p className="text-xs font-bold text-slate-500 uppercase">{b.type_name}</p>
                          {isUnpaid ? (
                            <div className="mt-2">
                              <h3 className="text-2xl font-bold text-slate-900">Unlimited</h3>
                              <p className="text-sm text-slate-500 mt-1">Unpaid leave (LWOP)</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-end gap-2 mt-2">
                                <h3 className="text-3xl font-bold text-slate-900">{bal}</h3>
                                <span className="text-sm text-slate-500 mb-1">/ {max} days</span>
                              </div>
                              <Progress value={pct} className="h-1.5 mt-3 bg-slate-100" />
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Leave History</CardTitle>
                  <CardDescription>Synced with Leave Calendar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No leave requests yet.</TableCell>
                        </TableRow>
                      ) : (
                        leaveRequests.slice(0, 20).map((r: { id: string; type_name: string; start_date: string; end_date: string; total_days: string; day_type?: string; status: string }) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.type_name}</TableCell>
                            <TableCell>{formatDisplayDate(r.start_date) === formatDisplayDate(r.end_date) ? formatDisplayDate(r.start_date) : `${formatDisplayDate(r.start_date)} – ${formatDisplayDate(r.end_date)}`}</TableCell>
                            <TableCell>{r.total_days}{r.day_type === "half" ? " (H)" : ""} Days</TableCell>
                            <TableCell>
                              <Badge className={r.status === "approved" ? "bg-green-100 text-green-700 hover:bg-green-100" : r.status === "rejected" ? "bg-red-100 text-red-700 hover:bg-red-100" : r.status === "pending" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}>
                                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Employee Timeline</CardTitle>
                  <CardDescription>Complete history of changes and milestones.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative border-l border-slate-200 ml-3 space-y-8 pl-8 pb-4">
                    {[
                      { date: "Jan 01, 2026", title: "Compensation Update", desc: "Salary revised to $145,000 (Annual Appraisal)", icon: DollarSign, color: "bg-green-500" },
                      { date: "Dec 15, 2025", title: "Document Uploaded", desc: "Updated Tax Form W-4 uploaded by Employee", icon: FileTextIcon, color: "bg-blue-500" },
                      { date: "Jan 01, 2025", title: "Promotion", desc: "Promoted to Senior Frontend Engineer (Grade L4)", icon: TrendingUp, color: "bg-purple-500" },
                      { date: "Jan 01, 2025", title: "Manager Change", desc: "Reporting manager changed to Sarah Connor", icon: User, color: "bg-orange-500" },
                      { date: "Jun 15, 2023", title: "Joined Company", desc: "Joined as Frontend Engineer in Technology Dept", icon: CheckCircle2, color: "bg-slate-900" },
                    ].map((event, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[41px] top-0 h-6 w-6 rounded-full border-2 border-white ${event.color} flex items-center justify-center text-white shadow-sm`}>
                          {event.icon && <event.icon className="h-3 w-3" />}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-500">{event.date}</span>
                          <h4 className="font-bold text-slate-900 text-sm">{event.title}</h4>
                          <p className="text-sm text-slate-600">{event.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Employment Documents</CardTitle>
                    <CardDescription>
                      Documents from verification and manual uploads. Tentative verification documents appear here when the hire is confirmed; HR can add more.
                    </CardDescription>
                  </div>
                  {canAdminEdit && employee?.id && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSyncTentativeDocuments}
                        disabled={syncTentativeLoading}
                      >
                        {syncTentativeLoading ? "Syncing..." : "Copy from tentative"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setUploadDocOpen(true)}>
                        <Upload className="h-4 w-4 mr-2" /> Upload document
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {employeeDocuments.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No documents on file yet. Documents from tentative verification appear after the hire is confirmed. {canAdminEdit && "You can upload documents using the button above."}
                    </div>
                  ) : (
                    employeeDocuments.map((doc) => {
                      const displayName = doc.file_name || doc.display_name || doc.document_type?.replace(/_/g, " ") || "Document";
                      const dateStr = doc.uploaded_at
                        ? new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : doc.created_at
                          ? new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                          : "";
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="bg-red-500/10 text-red-600 p-2 rounded">
                              <FileTextIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{doc.display_name || doc.document_type?.replace(/_/g, " ") || "Document"}</p>
                              <p className="text-xs text-muted-foreground">
                                {dateStr ? `Uploaded ${dateStr}` : ""}
                                {doc.source === "tentative_verification" ? " · Verification" : doc.source === "manual" ? " · Manual" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-primary"
                              title="View document"
                              onClick={() => window.open(`${window.location.origin}/api/employees/documents/${doc.id}/file`, "_blank", "noopener,noreferrer")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-primary"
                              title="Download document"
                              onClick={async () => {
                                try {
                                  const r = await fetch(`/api/employees/documents/${doc.id}/file`, { credentials: "include" });
                                  if (!r.ok) throw new Error("Failed to load file");
                                  const blob = await r.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = displayName || "document";
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch {
                                  toast.error("Could not download document");
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canAdminEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Upload document dialog (HR) */}
              <Dialog open={uploadDocOpen} onOpenChange={setUploadDocOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload document</DialogTitle>
                    <DialogDescription>
                      Add a document to this employee&apos;s profile. PDF or image files.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Display name (optional)</Label>
                      <Input
                        placeholder="e.g. Employment contract"
                        value={uploadDisplayName}
                        onChange={(e) => setUploadDisplayName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">If left blank, the file name will be used.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>File *</Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        {uploadFile ? (
                          <div className="flex items-center justify-center gap-2 text-sm">
                            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{uploadFile.name}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setUploadFile(null)}>Remove</Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Click to upload (PDF, max 5MB)</p>
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && f.size <= 5 * 1024 * 1024) setUploadFile(f);
                                else if (f) toast.error("File must be under 5MB");
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
                    <Button onClick={handleUploadDocument} disabled={uploadLoading || !uploadFile}>
                      {uploadLoading ? "Uploading..." : "Upload"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {employee.status === 'Terminated' && (
              <TabsContent value="exit" className="space-y-6">
                 <Card className="border border-red-500/20 shadow-sm bg-red-500/10">
                  <CardHeader>
                    <CardTitle className="text-destructive">Separation Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground">Resignation Date</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.resignationDate) || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Working Date</p>
                        <p className="font-medium text-foreground">{formatDisplayDate(employee.lastWorkingDate) || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Exit Type</p>
                        <Badge variant="outline" className="bg-red-500/10 text-destructive border-destructive/20">{employee.exitType || "Voluntary"}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Eligible for Rehire</p>
                        <p className="font-medium text-foreground">{employee.eligibleForRehire || "Yes"}</p>
                      </div>
                       <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Reason</p>
                        <p className="font-medium text-foreground">{employee.resignationReason || "Better Opportunity"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}

function FileTextIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}