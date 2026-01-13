import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, Phone, MapPin, Calendar, Briefcase, Building, 
  Download, Share2, Star, Clock, Shield, Award, User, Home, Globe
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useStore } from "@/store/useStore";

export default function EmployeeProfile() {
  const [match, params] = useRoute("/employees/:id");
  const { employees } = useStore();
  
  // Find employee by ID from params
  const id = params?.id ? parseInt(params.id) : 1;
  const employee = employees.find(e => e.id === id) || employees[0];

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/employees">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground">
            ← Back to Directory
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border border-border shadow-sm overflow-hidden bg-card">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
              <div className="absolute -bottom-12 left-6">
                <Avatar className="h-24 w-24 border-4 border-card shadow-sm">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <CardContent className="pt-16 pb-6 px-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
                  <p className="text-primary font-medium">{employee.role}</p>
                </div>
                <Badge className={`
                  ${employee.status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 
                    employee.status === 'Terminated' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 
                    'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'}
                `}>
                  {employee.status}
                </Badge>
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
                <CardHeader>
                  <CardTitle>Core Information</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personal" className="space-y-6">
               <Card className="border border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle>Personal Details</CardTitle>
                </CardHeader>
                <CardContent>
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
                      <p className="font-medium text-foreground">{employee.personalEmail || "personal@gmail.com"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle>Current Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Street</p>
                      <p className="font-medium text-foreground">{employee.street || "123 Main St"}</p>
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job" className="space-y-6">
              <Card className="border border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                </CardHeader>
                <CardContent>
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
