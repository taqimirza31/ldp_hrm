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
import { Switch } from "@/components/ui/switch";
import { 
  Mail, Phone, MapPin, Calendar, Building, 
  Download, Star, Clock, Home, Globe,
  Edit2, Camera, Bell, CheckCircle2, History,
  DollarSign, CreditCard, Banknote, TrendingUp, AlertCircle, User,
  Shield, Save, X, Lock
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useStore } from "@/store/useStore";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EmployeeProfile() {
  const [match, params] = useRoute("/employees/:id");
  const { employees } = useStore();
  const [isAdminView, setIsAdminView] = useState(true); // Default to Admin view for demo
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingDependents, setIsEditingDependents] = useState(false);
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [isEditingSocial, setIsEditingSocial] = useState(false);
  
  // Find employee by ID from params
  const id = params?.id ? parseInt(params.id) : 1;
  const employee = employees.find(e => e.id === id) || employees[0];

  const handleAdminSave = () => {
    setIsEditingAdmin(false);
    toast.success("Profile updated successfully", {
      description: "Core employee record has been modified.",
    });
  };

  const handlePersonalSave = () => {
    setIsEditingPersonal(false);
    toast.success("Change request sent to HR for approval", {
      description: "You will be notified once the changes are approved.",
      duration: 4000,
    });
  };

  const handleAddressSave = () => {
    setIsEditingAddress(false);
    toast.success("Address update request sent to HR", {
      description: "You will be notified once the changes are approved.",
      duration: 4000,
    });
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

  const handleAvatarChange = () => {
    toast.success("Profile picture updated");
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <Link href="/employees">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground">
            ← Back to Directory
          </Button>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200">
            <span className={`text-xs font-medium ${!isAdminView ? 'text-slate-900' : 'text-slate-500'}`}>Employee View</span>
            <Switch checked={isAdminView} onCheckedChange={setIsAdminView} />
            <span className={`text-xs font-bold ${isAdminView ? 'text-blue-600' : 'text-slate-500'} flex items-center gap-1`}>
              <Shield className="h-3 w-3" /> Admin View
            </span>
          </div>

          {isAdminView && (
            isEditingAdmin ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditingAdmin(false)} className="gap-2">
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button size="sm" onClick={handleAdminSave} className="gap-2">
                  <Save className="h-4 w-4" /> Save Record
                </Button>
              </div>
            ) : (
              <Button onClick={() => setIsEditingAdmin(true)} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
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
                  {(isAdminView || employee.id === 1) && ( // Allow edit if admin or own profile (simulated)
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handleAvatarChange}>
                      <Camera className="h-6 w-6 text-white" />
                    </div>
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
                   <Select defaultValue={employee.status}>
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                      <SelectItem value="Terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`
                    ${employee.status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 
                      employee.status === 'Terminated' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 
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
                  Joined {employee.joinDate}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Message</Button>
                <Button variant="outline" className="w-full border-border bg-card hover:bg-muted text-foreground">Schedule</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-foreground">Reporting Lines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employee.managerEmail && (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${employee.managerEmail}`} />
                    <AvatarFallback>M</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{employee.managerEmail}</p>
                    <p className="text-xs text-muted-foreground truncate">Manager</p>
                  </div>
                </div>
              )}
               <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://ui-avatars.com/api/?name=HR+Partner" />
                    <AvatarFallback>HR</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{employee.hrEmail || "hr@admani.com"}</p>
                    <p className="text-xs text-muted-foreground truncate">HR Partner</p>
                  </div>
                </div>
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
                    <p className="text-2xl font-bold text-foreground">14d</p>
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
                        <Input id="firstName" defaultValue={employee.firstName} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" defaultValue={employee.lastName} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input id="displayName" defaultValue={employee.name} />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="empType">Employee Type</Label>
                        <Select defaultValue={employee.employeeType || "Full Time"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Full Time">Full Time</SelectItem>
                            <SelectItem value="Part Time">Part Time</SelectItem>
                            <SelectItem value="Contractor">Contractor</SelectItem>
                            <SelectItem value="Intern">Intern</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bu">Business Unit</Label>
                        <Select defaultValue={employee.businessUnit || "Technology"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Technology">Technology</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="HR">HR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="costCenter">Cost Center</Label>
                        <Input id="costCenter" defaultValue={employee.costCenter || "CC-001"} />
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
                        <p className="font-medium text-foreground">{employee.employeeType || "Full Time"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Business Unit</p>
                        <p className="font-medium text-foreground">{employee.businessUnit || "Technology"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cost Center</p>
                        <p className="font-medium text-foreground">{employee.costCenter || "CC-001"}</p>
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
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingPersonal(true)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingPersonal(false)}>Cancel</Button>
                      <Button size="sm" onClick={handlePersonalSave}>Save Changes</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingPersonal ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input id="dob" defaultValue={employee.dob || "1990-01-01"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marital">Marital Status</Label>
                        <Input id="marital" defaultValue={employee.maritalStatus || "Single"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Personal Mobile</Label>
                        <Input id="phone" defaultValue="+1 (555) 987-6543" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="personalEmail">Personal Email</Label>
                        <Input id="personalEmail" defaultValue={employee.personalEmail || "alex.personal@gmail.com"} />
                      </div>
                      <div className="col-span-2 p-3 bg-yellow-50 text-yellow-800 text-xs rounded-md flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <div>
                          Note: Updates to personal information require HR approval. You will be notified via email once approved.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground">Date of Birth</p>
                        <p className="font-medium text-foreground">{employee.dob || "Jan 1, 1990"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <p className="font-medium text-foreground">{employee.gender || "Not Specified"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Marital Status</p>
                        <p className="font-medium text-foreground">{employee.maritalStatus || "Single"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Blood Group</p>
                        <p className="font-medium text-foreground">{employee.bloodGroup || "O+"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Personal Email</p>
                        <p className="font-medium text-foreground">{employee.personalEmail || "alex.personal@gmail.com"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mobile Contact</p>
                        <p className="font-medium text-foreground">+1 (555) 987-6543</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Home Address</CardTitle>
                  {!isEditingAddress ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingAddress(true)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingAddress(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleAddressSave}>Save Changes</Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingAddress ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="street">Street Address</Label>
                        <Input id="street" defaultValue={employee.street || "123 Main St, Apt 4B"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" defaultValue={employee.city || "San Francisco"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input id="state" defaultValue={employee.state || "CA"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">Zip Code</Label>
                        <Input id="zipCode" defaultValue={employee.zipCode || "94105"} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" defaultValue={employee.country || "USA"} />
                      </div>
                      <div className="col-span-2 p-3 bg-yellow-50 text-yellow-800 text-xs rounded-md flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <div>
                          Note: Updates to address information require HR approval. You will be notified via email once approved.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Street</p>
                        <p className="font-medium text-foreground">{employee.street || "123 Main St, Apt 4B"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">City</p>
                        <p className="font-medium text-foreground">{employee.city || "San Francisco"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">State</p>
                        <p className="font-medium text-foreground">{employee.state || "CA"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Zip Code</p>
                        <p className="font-medium text-foreground">{employee.zipCode || "94105"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Country</p>
                        <p className="font-medium text-foreground">{employee.country || "USA"}</p>
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
                    !isAdminView && <Lock className="h-4 w-4 text-muted-foreground opacity-50" />
                  )}
                </CardHeader>
                <CardContent>
                  {isEditingAdmin ? (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Input id="designation" defaultValue={employee.role} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="grade">Grade</Label>
                        <Select defaultValue={employee.grade || "L4"}>
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
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shift">Shift</Label>
                        <Select defaultValue={employee.shift || "Day Shift"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Day Shift">Day Shift</SelectItem>
                            <SelectItem value="Night Shift">Night Shift</SelectItem>
                            <SelectItem value="Rotational">Rotational</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobCategory">Job Category</Label>
                        <Select defaultValue={employee.jobCategory || "Software"}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Software">Software Engineering</SelectItem>
                            <SelectItem value="Product">Product Management</SelectItem>
                            <SelectItem value="Design">Design</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Support">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="probationStart">Probation Start</Label>
                        <Input id="probationStart" type="date" defaultValue="2023-06-15" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="probationEnd">Probation End</Label>
                        <Input id="probationEnd" type="date" defaultValue="2023-12-15" />
                      </div>
                       <div className="space-y-2">
                        <Label htmlFor="confirmDate">Confirmation Date</Label>
                        <Input id="confirmDate" type="date" defaultValue="2024-01-01" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notice">Notice Period</Label>
                        <Select defaultValue={employee.noticePeriod || "30 Days"}>
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
                        <p className="font-medium text-foreground">{employee.grade || "L4"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Shift</p>
                        <p className="font-medium text-foreground">{employee.shift || "Day Shift"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Job Category</p>
                        <p className="font-medium text-foreground">{employee.jobCategory || "Software"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Probation Start</p>
                        <p className="font-medium text-foreground">{employee.probationStartDate || employee.joinDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Probation End</p>
                        <p className="font-medium text-foreground">{employee.probationEndDate || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Confirmation Date</p>
                        <p className="font-medium text-foreground">{employee.confirmationDate || "N/A"}</p>
                      </div>
                       <div>
                        <p className="text-xs text-muted-foreground">Notice Period</p>
                        <p className="font-medium text-foreground">{employee.noticePeriod || "30 Days"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compensation" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="border border-border shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Current Salary (Annual)</p>
                            <h2 className="text-3xl font-bold text-green-900 mt-1">$145,000</h2>
                          </div>
                          <div className="bg-white p-2 rounded-full shadow-sm">
                            <DollarSign className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                        <div className="text-xs text-green-700 font-medium">Effective Date: Jan 01, 2026</div>
                        <p className="text-xs text-green-600 mt-4 underline">Click for breakdown details</p>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Compensation Breakdown</DialogTitle>
                      <DialogDescription>Detailed view of current compensation package.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-6 py-4">
                      <div className="col-span-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <h4 className="font-bold text-sm mb-3">Overview</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Annual CTC</p>
                            <p className="font-bold text-lg">$145,000</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Basic Pay</p>
                            <p className="font-bold text-lg">$85,000</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">HRA</p>
                            <p className="font-bold text-lg">$40,000</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Pay Method</p>
                          <p className="font-medium text-sm flex items-center gap-2"><CreditCard className="h-3 w-3" /> Direct Deposit</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payout Frequency</p>
                          <p className="font-medium text-sm">Bi-Weekly</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pay Group</p>
                          <p className="font-medium text-sm">US - Tech - L4</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Reason for Change</p>
                          <p className="font-medium text-sm">Annual Performance Review</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Work Hours</p>
                          <p className="font-medium text-sm">40 Hours / Week</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pay Rate</p>
                          <p className="font-medium text-sm">$69.71 / Hour</p>
                        </div>
                      </div>

                      <div className="col-span-2 border-t pt-4">
                        <p className="text-xs text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">Includes 10% standard variable pay based on company performance.</p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Card className="border border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stock Grants</p>
                        <h2 className="text-3xl font-bold text-slate-900 mt-1">5,000 Units</h2>
                      </div>
                      <div className="bg-slate-100 p-2 rounded-full">
                        <TrendingUp className="h-6 w-6 text-slate-600" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">Vesting over 4 years</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Salary Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative border-l border-slate-200 ml-3 space-y-8 pl-6 pb-2">
                    {[
                      { date: "Jan 01, 2026", amount: "$145,000", change: "+8.5%", reason: "Annual Appraisal" },
                      { date: "Jan 01, 2025", amount: "$133,500", change: "+12%", reason: "Promotion to Senior" },
                      { date: "Jan 01, 2024", amount: "$119,000", change: "+5%", reason: "Annual Appraisal" },
                      { date: "Jun 15, 2023", amount: "$113,000", change: "-", reason: "Joining" },
                    ].map((event, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-900">{event.amount}</p>
                            <p className="text-xs text-slate-500">{event.reason}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-slate-900">{event.date}</p>
                            {event.change !== "-" && (
                              <span className="text-xs text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">{event.change}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border border-border shadow-sm">
                  <CardHeader>
                    <CardTitle>Bonuses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8">Date</TableHead>
                          <TableHead className="h-8">Type</TableHead>
                          <TableHead className="h-8 text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-xs">Dec 2025</TableCell>
                          <TableCell className="text-xs">Performance</TableCell>
                          <TableCell className="text-xs font-bold text-right">$12,000</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs">Dec 2024</TableCell>
                          <TableCell className="text-xs">Holiday</TableCell>
                          <TableCell className="text-xs font-bold text-right">$5,000</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border border-border shadow-sm">
                  <CardHeader>
                    <CardTitle>Banking Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 border border-slate-100 rounded-lg flex items-center gap-4">
                        <div className="bg-slate-100 p-2 rounded text-slate-600">
                          <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Chase Bank</p>
                          <p className="text-xs text-slate-500">Checking •••• 4589</p>
                        </div>
                        <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Primary</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="timeoff" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-slate-500 uppercase">Annual Leave</p>
                    <div className="flex items-end gap-2 mt-2">
                      <h3 className="text-3xl font-bold text-slate-900">12</h3>
                      <span className="text-sm text-slate-500 mb-1">/ 20 days</span>
                    </div>
                    <Progress value={60} className="h-1.5 mt-3 bg-slate-100" />
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-slate-500 uppercase">Sick Leave</p>
                    <div className="flex items-end gap-2 mt-2">
                      <h3 className="text-3xl font-bold text-slate-900">5</h3>
                      <span className="text-sm text-slate-500 mb-1">/ 10 days</span>
                    </div>
                    <Progress value={50} className="h-1.5 mt-3 bg-slate-100" />
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500 shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-xs font-bold text-slate-500 uppercase">Floating Holidays</p>
                    <div className="flex items-end gap-2 mt-2">
                      <h3 className="text-3xl font-bold text-slate-900">2</h3>
                      <span className="text-sm text-slate-500 mb-1">/ 2 days</span>
                    </div>
                    <Progress value={100} className="h-1.5 mt-3 bg-slate-100" />
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Leave History</CardTitle>
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
                      <TableRow>
                        <TableCell className="font-medium">Annual Leave</TableCell>
                        <TableCell>Dec 24 - Dec 31, 2025</TableCell>
                        <TableCell>5 Days</TableCell>
                        <TableCell><Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Sick Leave</TableCell>
                        <TableCell>Nov 12, 2025</TableCell>
                        <TableCell>1 Day</TableCell>
                        <TableCell><Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Unpaid Leave</TableCell>
                        <TableCell>Aug 15, 2025</TableCell>
                        <TableCell>1 Day</TableCell>
                        <TableCell><Badge className="bg-green-100 text-green-700 hover:bg-green-100">Approved</Badge></TableCell>
                      </TableRow>
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
                <CardHeader>
                  <CardTitle>Employment Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { name: "Employment Contract.pdf", date: "Oct 12, 2020" },
                    { name: "NDA Signed.pdf", date: "Oct 12, 2020" },
                    { name: "Tax Form W-4.pdf", date: "Jan 15, 2024" },
                    { name: "Offer Letter.pdf", date: "Sep 28, 2020" }
                  ].map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 text-red-600 p-2 rounded">
                          <FileTextIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded {doc.date}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                        <p className="font-medium text-foreground">{employee.resignationDate || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Working Date</p>
                        <p className="font-medium text-foreground">{employee.lastWorkingDate || "N/A"}</p>
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