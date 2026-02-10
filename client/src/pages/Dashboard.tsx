import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, DollarSign, TrendingUp, UserPlus, Clock, ArrowUpRight, 
  ArrowDownRight, Activity, MoreHorizontal, Briefcase, ShieldAlert,
  Globe, Heart, Upload, User
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const chartData = [
  { name: 'Jan', retention: 95, payroll: 120 },
  { name: 'Feb', retention: 93, payroll: 130 },
  { name: 'Mar', retention: 96, payroll: 125 },
  { name: 'Apr', retention: 94, payroll: 140 },
  { name: 'May', retention: 98, payroll: 135 },
  { name: 'Jun', retention: 97, payroll: 150 },
  { name: 'Jul', retention: 99, payroll: 160 },
];

const StatsCard = ({ title, value, trend, icon: Icon, colorClass, subtext }: any) => {
  const isPositive = trend > 0;
  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200 bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-card-foreground tracking-tight mb-1">{value}</h3>
          <p className="text-sm text-muted-foreground font-medium mb-3">{title}</p>
          <div className="flex items-center gap-2">
            <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(trend)}%
            </span>
            <span className="text-muted-foreground text-xs">{subtext || "vs last month"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Comprehensive Add Employee Form Component
function AddEmployeeDialog() {
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
    department: "",
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
    employmentStatus: "active",
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
      // For now, create a local URL preview
      // In production, you'd upload to a server/S3
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
    
    // Validate required fields
    if (!formData.employeeId || !formData.firstName || !formData.lastName || 
        !formData.workEmail || !formData.jobTitle || !formData.department || !formData.joinDate) {
      toast.error("Please fill in all required fields", {
        description: "Employee ID, Name, Email, Job Title, Department, and Join Date are required."
      });
      setActiveTab("basic");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      toast.success("Employee created successfully!", {
        description: `${formData.firstName} ${formData.lastName} has been added to the directory.`,
      });
      
      setOpen(false);
      resetForm();

      // Navigate to the new employee's profile
      if (data.employee?.id) {
        setLocation(`/employees/${data.employee.id}`);
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
      department: "",
      subDepartment: "",
      businessUnit: "",
      primaryTeam: "",
      costCenter: "",
      grade: "",
      jobCategory: "",
      location: "",
      managerEmail: "",
      hrEmail: "",
      employmentStatus: "active",
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
          <UserPlus className="h-4 w-4 mr-2" />
          Add Employee
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                    <Select value={formData.employmentStatus} onValueChange={(v) => handleChange("employmentStatus", v)} disabled={loading}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                        <SelectItem value="resigned">Resigned</SelectItem>
                      </SelectContent>
                    </Select>
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

export default function Dashboard() {
  const { isAdmin, isHR } = useAuth();
  const canAddEmployee = isAdmin || isHR;

  return (
    <Layout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Overview of HR operations, finance, and company health.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-card border-border text-foreground hover:bg-muted">
            Download Report
          </Button>
          {canAddEmployee && <AddEmployeeDialog />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard 
          title="Total Employees" 
          value="1,248" 
          trend={12} 
          icon={Users} 
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" 
        />
        <StatsCard 
          title="Payroll Status" 
          value="Pending" 
          trend={0} 
          icon={DollarSign} 
          colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400" 
          subtext="Run Due in 2d"
        />
        <StatsCard 
          title="Interviews Today" 
          value="5" 
          trend={2} 
          icon={Briefcase} 
          colorClass="bg-orange-500/10 text-orange-600 dark:text-orange-400" 
          subtext="2 Technical, 3 HR"
        />
        <StatsCard 
          title="Open Tickets" 
          value="12" 
          trend={-5} 
          icon={ShieldAlert} 
          colorClass="bg-red-500/10 text-red-600 dark:text-red-400" 
          subtext="3 High Priority"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-card-foreground">Analytics Overview</h3>
              <p className="text-sm text-muted-foreground">Employee retention vs payroll costs</p>
            </div>
            <select className="text-sm border-none bg-muted rounded-md px-3 py-1.5 text-muted-foreground focus:ring-0 cursor-pointer">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                />
                <Area type="monotone" dataKey="retention" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRetention)" />
                <Area type="monotone" dataKey="payroll" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorPayroll)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-card-foreground mb-4">Live Activity Feed</h3>
          <div className="space-y-6 relative">
            <div className="absolute left-[19px] top-2 bottom-4 w-px bg-muted -z-10" />
            
            {[
              { user: "Anonymous", action: "Submitted Ethics Report", time: "2m ago", colorClass: "bg-red-500/10 text-red-600 dark:text-red-400", icon: ShieldAlert },
              { user: "Sarah Connor", action: "Approved Payroll Run", time: "1h ago", colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: DollarSign },
              { user: "System", action: "Daily Backup Completed", time: "3h ago", colorClass: "bg-green-500/10 text-green-600 dark:text-green-400", icon: Activity },
              { user: "Neo Anderson", action: "Clocked In (Remote)", time: "5h ago", colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Clock },
              { user: "Jane Smith", action: "Requested Leave", time: "1d ago", colorClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400", icon: UserPlus }
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-4 ring-card ${item.colorClass}`}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.user} • {item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground">
            View Audit Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-blue-500/50 transition-colors cursor-pointer group">
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg"><Globe className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Diversity Score</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">8.4/10</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-500/10 px-2 py-1 rounded-full">+0.2</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-pink-500/50 transition-colors cursor-pointer group">
           <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-lg"><Heart className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">Employee Pulse</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">78%</span>
            <span className="text-xs text-pink-600 dark:text-pink-400 font-medium bg-pink-500/10 px-2 py-1 rounded-full">Positive</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-lg border border-border shadow-sm hover:border-orange-500/50 transition-colors cursor-pointer group">
           <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg"><ShieldAlert className="h-4 w-4" /></div>
             <h4 className="font-medium text-muted-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Compliance</h4>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-2xl font-bold text-foreground">3</span>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium bg-orange-500/10 px-2 py-1 rounded-full">Actions Needed</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
