import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal, Mail, Phone, MapPin, Users, Download, Plus, Trash2, Eye, UserPlus, Upload, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

// API Employee type (snake_case from database)
interface ApiEmployee {
  id: string;
  employee_id: string;
  work_email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  avatar?: string;
  job_title: string;
  department: string;
  sub_department?: string;
  business_unit?: string;
  location?: string;
  grade?: string;
  employment_status: string;
  employee_type: string;
  join_date: string;
  city?: string;
  state?: string;
  country?: string;
}

// Comprehensive Add Employee Form Component
function AddEmployeeDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("basic");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    // Basic Info
    employeeId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    workEmail: "",
    avatar: "",
    
    // Work Details
    jobTitle: "",
    department: "Engineering",
    subDepartment: "",
    businessUnit: "",
    primaryTeam: "",
    costCenter: "",
    grade: "",
    jobCategory: "",
    location: "",
    managerEmail: "",
    hrEmail: "",
    
    // Employment
    requiresOnboarding: true,
    employmentStatus: "onboarding",
    employeeType: "full_time",
    shift: "",
    joinDate: new Date().toISOString().split("T")[0],
    probationStartDate: "",
    probationEndDate: "",
    confirmationDate: "",
    noticePeriod: "",
    
    // Contact
    personalEmail: "",
    workPhone: "",
    
    // Personal
    dob: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    
    // Address
    street: "",
    city: "",
    state: "",
    country: "",
    zipCode: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange("avatar", reader.result as string);
      };
      reader.readAsDataURL(file);
      toast.success("Avatar uploaded");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const required = [
      { key: "employeeId", label: "Employee ID", tab: "basic" },
      { key: "firstName", label: "First Name", tab: "basic" },
      { key: "lastName", label: "Last Name", tab: "basic" },
      { key: "workEmail", label: "Work Email", tab: "basic" },
      { key: "jobTitle", label: "Job Title", tab: "work" },
      { key: "department", label: "Department", tab: "work" },
      { key: "joinDate", label: "Join Date", tab: "employment" },
    ] as const;
    const missing = required.filter((r) => !String(formData[r.key] ?? "").trim());
    if (missing.length > 0) {
      const first = missing[0];
      setActiveTab(first.tab);
      toast.error("Please fill in all required fields", {
        description: `Missing: ${missing.map((m) => m.label).join(", ")}`,
      });
      return;
    }

    setLoading(true);
    try {
      const payload = { ...formData };
      delete (payload as Record<string, unknown>).requiresOnboarding;
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      const empId = data.employee?.id;
      const requiresOnboarding = formData.requiresOnboarding;

      toast.success("Employee created successfully!", {
        description: `${formData.firstName} ${formData.lastName} has been added to the directory.`,
      });
      
      setOpen(false);
      resetForm();
      onSuccess?.();

      if (empId) {
        if (requiresOnboarding) {
          const onboardingRes = await fetch("/api/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ employeeId: empId }),
          });
          if (!onboardingRes.ok) {
            const errData = await onboardingRes.json();
            toast.error(errData.error || "Failed to start onboarding");
            setLocation(`/employees/${empId}`);
            return;
          }
          const onboardingData = await onboardingRes.json();
          setLocation(`/onboarding?recordId=${onboardingData.id}`);
        } else {
          setLocation(`/employees/${empId}`);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      firstName: "",
      middleName: "",
      lastName: "",
      workEmail: "",
      avatar: "",
      jobTitle: "",
      department: "Engineering",
      subDepartment: "",
      businessUnit: "",
      primaryTeam: "",
      costCenter: "",
      grade: "",
      jobCategory: "",
      location: "",
      managerEmail: "",
      hrEmail: "",
      requiresOnboarding: true,
      employmentStatus: "onboarding",
      employeeType: "full_time",
      shift: "",
      joinDate: new Date().toISOString().split("T")[0],
      probationStartDate: "",
      probationEndDate: "",
      confirmationDate: "",
      noticePeriod: "",
      personalEmail: "",
      workPhone: "",
      dob: "",
      gender: "",
      maritalStatus: "",
      bloodGroup: "",
      street: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
    });
    setActiveTab("basic");
  };

  const generateEmployeeId = () => {
    const num = Math.floor(Math.random() * 900) + 100;
    handleChange("employeeId", `EMP${num}`);
  };

  const initials = formData.firstName && formData.lastName 
    ? `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase()
    : "?";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add New Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Create a complete employee profile. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="work">Work</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] pr-4">
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                {/* Avatar Upload */}
                <div className="flex items-center gap-6 p-4 bg-muted/50 rounded-lg">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-2 border-border">
                      <AvatarImage src={formData.avatar} />
                      <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Upload className="h-6 w-6 text-white" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Profile Photo</p>
                    <p className="text-xs text-muted-foreground mb-2">Upload a photo or enter URL</p>
                    <Input
                      placeholder="Or paste image URL..."
                      value={formData.avatar}
                      onChange={(e) => handleChange("avatar", e.target.value)}
                      disabled={loading}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee ID *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., EMP006"
                        value={formData.employeeId}
                        onChange={(e) => handleChange("employeeId", e.target.value)}
                        disabled={loading}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={generateEmployeeId} disabled={loading}>
                        Auto
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Work Email *</Label>
                    <Input
                      type="email"
                      placeholder="email@admani.com"
                      value={formData.workEmail}
                      onChange={(e) => handleChange("workEmail", e.target.value)}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">Microsoft / company login email.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input
                      placeholder="William"
                      value={formData.middleName}
                      onChange={(e) => handleChange("middleName", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Personal Email</Label>
                    <Input
                      type="email"
                      placeholder="personal@gmail.com"
                      value={formData.personalEmail}
                      onChange={(e) => handleChange("personalEmail", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Work Phone</Label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      value={formData.workPhone}
                      onChange={(e) => handleChange("workPhone", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Work Details Tab */}
              <TabsContent value="work" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Job Title *</Label>
                    <Input
                      placeholder="Software Engineer"
                      value={formData.jobTitle}
                      onChange={(e) => handleChange("jobTitle", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select value={formData.department} onValueChange={(v) => handleChange("department", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sub Department</Label>
                    <Input
                      placeholder="e.g., Frontend"
                      value={formData.subDepartment}
                      onChange={(e) => handleChange("subDepartment", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Unit</Label>
                    <Select value={formData.businessUnit} onValueChange={(v) => handleChange("businessUnit", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Corporate">Corporate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Team</Label>
                    <Input
                      placeholder="e.g., Platform Team"
                      value={formData.primaryTeam}
                      onChange={(e) => handleChange("primaryTeam", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Center</Label>
                    <Input
                      placeholder="e.g., CC-001"
                      value={formData.costCenter}
                      onChange={(e) => handleChange("costCenter", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Select value={formData.grade} onValueChange={(v) => handleChange("grade", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                    <Label>Job Category</Label>
                    <Select value={formData.jobCategory} onValueChange={(v) => handleChange("jobCategory", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                    <Label>Location</Label>
                    <Select value={formData.location} onValueChange={(v) => handleChange("location", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="San Francisco">San Francisco</SelectItem>
                        <SelectItem value="New York">New York</SelectItem>
                        <SelectItem value="London">London</SelectItem>
                        <SelectItem value="Berlin">Berlin</SelectItem>
                        <SelectItem value="Singapore">Singapore</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Manager Email</Label>
                    <Input
                      type="email"
                      placeholder="manager@admani.com"
                      value={formData.managerEmail}
                      onChange={(e) => handleChange("managerEmail", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HR Partner Email</Label>
                    <Input
                      type="email"
                      placeholder="hr@admani.com"
                      value={formData.hrEmail}
                      onChange={(e) => handleChange("hrEmail", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Employment Tab */}
              <TabsContent value="employment" className="space-y-4 mt-0">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/30">
                  <input
                    type="checkbox"
                    id="requiresOnboarding"
                    checked={formData.requiresOnboarding}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setFormData((prev) => ({ ...prev, requiresOnboarding: v, employmentStatus: v ? "onboarding" : "active" }));
                    }}
                    disabled={loading}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="requiresOnboarding" className="text-sm font-medium cursor-pointer">
                    Does this employee require onboarding?
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  If Yes: employee status = Onboarding, and you will be redirected to the onboarding checklist. If No: employee status = Active, and you will be redirected to their profile.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <Input
                      value={formData.requiresOnboarding ? "Onboarding" : "Active"}
                      readOnly
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee Type</Label>
                    <Select value={formData.employeeType} onValueChange={(v) => handleChange("employeeType", v)} disabled={loading}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                        <SelectItem value="temporary">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shift</Label>
                    <Select value={formData.shift} onValueChange={(v) => handleChange("shift", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day Shift">Day Shift</SelectItem>
                        <SelectItem value="Night Shift">Night Shift</SelectItem>
                        <SelectItem value="Rotational">Rotational</SelectItem>
                        <SelectItem value="Flexible">Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notice Period</Label>
                    <Select value={formData.noticePeriod} onValueChange={(v) => handleChange("noticePeriod", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15 Days">15 Days</SelectItem>
                        <SelectItem value="30 Days">30 Days</SelectItem>
                        <SelectItem value="60 Days">60 Days</SelectItem>
                        <SelectItem value="90 Days">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Join Date *</Label>
                    <Input
                      type="date"
                      value={formData.joinDate}
                      onChange={(e) => handleChange("joinDate", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmation Date</Label>
                    <Input
                      type="date"
                      value={formData.confirmationDate}
                      onChange={(e) => handleChange("confirmationDate", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Probation Start</Label>
                    <Input
                      type="date"
                      value={formData.probationStartDate}
                      onChange={(e) => handleChange("probationStartDate", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Probation End</Label>
                    <Input
                      type="date"
                      value={formData.probationEndDate}
                      onChange={(e) => handleChange("probationEndDate", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Personal Tab */}
              <TabsContent value="personal" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleChange("dob", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)} disabled={loading}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Marital Status</Label>
                    <Select value={formData.maritalStatus} onValueChange={(v) => handleChange("maritalStatus", v)} disabled={loading}>
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
                    <Label>Blood Group</Label>
                    <Select value={formData.bloodGroup} onValueChange={(v) => handleChange("bloodGroup", v)} disabled={loading}>
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
                </div>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4 mt-0">
                <p className="text-sm text-muted-foreground">Permanent Address</p>
                <div className="space-y-2">
                  <Label>Street Address</Label>
                  <Input
                    placeholder="123 Main St, Apt 4B"
                    value={formData.street}
                    onChange={(e) => handleChange("street", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="San Francisco"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State / Province</Label>
                    <Input
                      placeholder="CA"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      placeholder="USA"
                      value={formData.country}
                      onChange={(e) => handleChange("country", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zip / Postal Code</Label>
                    <Input
                      placeholder="94105"
                      value={formData.zipCode}
                      onChange={(e) => handleChange("zipCode", e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Employees() {
  const { isAdmin, isHR } = useAuth();
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const canAddEmployee = isAdmin || isHR;
  const canDeleteEmployee = isAdmin;

  // Fetch employees from API
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/employees", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      } else {
        toast.error("Failed to fetch employees");
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleExportCSV = () => {
    if (employees.length === 0) {
      toast.error("No employees to export");
      return;
    }

    // Define CSV headers
    const headers = ["Employee ID", "First Name", "Last Name", "Email", "Job Title", "Department", "Location", "Status", "Join Date"];
    
    // Build CSV rows
    const rows = filteredEmployees.map(emp => [
      emp.employee_id,
      emp.first_name,
      emp.last_name,
      emp.work_email,
      emp.job_title,
      emp.department,
      emp.location || emp.city || "",
      formatStatus(emp.employment_status),
      emp.join_date
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `employees_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast.success(`Exported ${filteredEmployees.length} employees`);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      try {
        const res = await fetch(`/api/employees/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          toast.success("Employee deleted");
          fetchEmployees(); // Refresh the list
          queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] }); // Refresh onboarding list
        } else {
          const data = await res.json();
          toast.error(data.error || "Failed to delete employee");
        }
      } catch (error) {
        toast.error("Failed to delete employee");
      }
    }
  };

  // Helper to get display name
  const getDisplayName = (emp: ApiEmployee) => 
    `${emp.first_name} ${emp.last_name}`;

  // Helper to format status for display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "Active",
      onboarding: "Onboarding",
      on_leave: "On Leave",
      terminated: "Terminated",
      resigned: "Resigned",
    };
    return statusMap[status] || status;
  };

  const filteredEmployees = employees.filter(emp => {
    const name = getDisplayName(emp).toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                          (emp.job_title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                          emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === "all" || emp.department === departmentFilter;
    const empStatus = formatStatus(emp.employment_status);
    const matchesStatus = statusFilter === "all" || empStatus === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Employee Directory</h1>
          <p className="text-muted-foreground text-sm">Manage your workforce and view profiles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted" onClick={fetchEmployees} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          
          {canAddEmployee && <AddEmployeeDialog onSuccess={fetchEmployees} />}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, role, or ID..." 
              className="pl-9 bg-muted/50 border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
             <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
             <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Onboarding">Onboarding</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
                <SelectItem value="Resigned">Resigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No employees found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {filteredEmployees.map((employee) => {
            const displayName = getDisplayName(employee);
            const status = formatStatus(employee.employment_status);
            const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
            
            return (
              <div key={employee.id} className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group">
                <div className="h-20 bg-gradient-to-r from-muted to-card border-b border-border relative">
                  <div className="absolute top-2 right-2 flex gap-1">
                    {canDeleteEmployee && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-card/50" onClick={() => handleDeleteEmployee(employee.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-card/50">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="px-6 pb-6">
                  <div className="relative -mt-10 mb-4 flex justify-between items-end">
                    <Avatar className="h-20 w-20 border-4 border-card shadow-sm">
                      <AvatarImage src={employee.avatar || undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <Badge variant="outline" className={`
                      ${status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 
                        status === 'Terminated' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 
                        'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'}
                    `}>
                      {status}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-bold text-card-foreground">{displayName}</h3>
                  <p className="text-primary text-sm font-medium mb-4">{employee.job_title}</p>

                  <div className="space-y-2.5 mb-6">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Badge variant="outline" className="mr-2 font-mono text-[10px] h-5 border-border">{employee.employee_id}</Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mr-2.5 text-muted-foreground" />
                      {employee.location || employee.city || "Not specified"}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 mr-2.5 text-muted-foreground" />
                      {employee.work_email}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 mr-2.5 text-muted-foreground" />
                      {employee.department}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/employees/${employee.id}`} className="flex-1">
                      <Button variant="outline" className="w-full bg-card border-border text-foreground hover:bg-muted text-xs h-9">
                        <Eye className="h-3 w-3 mr-2" /> View Profile
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => window.location.href = `mailto:${employee.work_email}`}>
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
