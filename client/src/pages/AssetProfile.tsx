import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { 
  Laptop, Smartphone, Monitor, QrCode, Barcode, Package, Wrench, Archive, 
  CheckCircle, AlertTriangle, Building, MapPin, Calendar, User, HardDrive, 
  Cpu, Edit2, Trash2, Printer, Download, ArrowLeft, Clock, FileText,
  AlertCircle, MessageSquare, Plus, Send, Paperclip, History, Shield,
  Router, Server, Tablet, Wifi, DollarSign, Tag
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";

// Mock asset data (same structure as Assets.tsx)
const mockAsset = {
  id: "1",
  assetId: "AST-2024-001",
  name: "MacBook Pro 16\"",
  deviceType: "Laptop",
  brand: "Apple",
  model: "MacBook Pro 16\" M3 Pro",
  serialNumber: "C02XL1YZJGH5",
  cpu: "Apple M3 Pro",
  cpuGeneration: "M3",
  ram: "36GB",
  storage: "512GB",
  storageType: "SSD",
  operatingSystem: "macOS Sonoma 14.3",
  purchaseDate: "2024-01-15",
  purchasePrice: 2499,
  warrantyExpiry: "2027-01-15",
  status: "assigned" as const,
  assignedTo: {
    id: "1",
    name: "Sarah Connor",
    email: "sarah.connor@company.com",
    avatar: "",
    department: "Engineering",
    employeeId: "EMP001"
  },
  department: "Engineering",
  location: "HQ - Floor 3, Desk 42",
  notes: "Primary development machine. AppleCare+ coverage included.",
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-20T14:45:00Z",
};

// Mock tickets for this asset
const mockTickets = [
  {
    id: "TKT-001",
    title: "Keyboard not responding intermittently",
    description: "The keyboard stops responding for a few seconds randomly throughout the day.",
    priority: "medium" as const,
    status: "resolved" as const,
    createdAt: "2024-02-10T09:00:00Z",
    resolvedAt: "2024-02-12T15:30:00Z",
    createdBy: "Sarah Connor"
  },
  {
    id: "TKT-002",
    title: "Request for additional RAM",
    description: "Need more RAM for running multiple Docker containers and VMs.",
    priority: "low" as const,
    status: "closed" as const,
    createdAt: "2024-01-25T11:00:00Z",
    resolvedAt: "2024-01-26T10:00:00Z",
    createdBy: "Sarah Connor"
  }
];

// Mock audit log
const mockAuditLog = [
  { date: "2024-01-20", action: "Status Updated", details: "Changed from 'In Stock' to 'Assigned'", user: "IT Admin" },
  { date: "2024-01-20", action: "Assigned", details: "Assigned to Sarah Connor (Engineering)", user: "IT Admin" },
  { date: "2024-01-15", action: "Asset Created", details: "New asset registered in inventory", user: "IT Admin" },
];

// Device type icon mapping
const getDeviceIcon = (type: string) => {
  const icons: Record<string, any> = {
    "Laptop": Laptop,
    "Desktop": Monitor,
    "Mobile": Smartphone,
    "Tablet": Tablet,
    "Monitor": Monitor,
    "Router": Router,
    "Switch": Wifi,
    "Server": Server,
    "Other": Package,
  };
  return icons[type] || Package;
};

// Status badge styling
const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    "in_stock": "bg-blue-100 text-blue-700 border-blue-200",
    "assigned": "bg-green-100 text-green-700 border-green-200",
    "repair": "bg-orange-100 text-orange-700 border-orange-200",
    "retired": "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels: Record<string, string> = {
    "in_stock": "In Stock",
    "assigned": "Assigned",
    "repair": "In Repair",
    "retired": "Retired",
  };
  return { style: styles[status] || styles["in_stock"], label: labels[status] || status };
};

// Priority badge
const getPriorityBadge = (priority: string) => {
  const styles: Record<string, string> = {
    "low": "bg-slate-100 text-slate-600",
    "medium": "bg-yellow-100 text-yellow-700",
    "high": "bg-orange-100 text-orange-700",
    "critical": "bg-red-100 text-red-700",
  };
  return styles[priority] || styles["low"];
};

// Ticket status badge
const getTicketStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    "open": "bg-blue-100 text-blue-700",
    "in_progress": "bg-yellow-100 text-yellow-700",
    "resolved": "bg-green-100 text-green-700",
    "closed": "bg-slate-100 text-slate-600",
  };
  const labels: Record<string, string> = {
    "open": "Open",
    "in_progress": "In Progress",
    "resolved": "Resolved",
    "closed": "Closed",
  };
  return { style: styles[status] || styles["open"], label: labels[status] || status };
};

// Create Ticket Dialog
function CreateTicketDialog({ assetId, assetName }: { assetId: string; assetName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      toast.success("Ticket created successfully!", {
        description: `Ticket for ${assetName} has been submitted.`
      });
      setOpen(false);
      setFormData({ title: "", description: "", priority: "medium" });
      setLoading(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Report an issue or request for asset: <span className="font-mono font-medium">{assetId}</span>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Issue Title *</Label>
            <Input
              placeholder="Brief description of the issue"
              value={formData.title}
              onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={formData.priority} onValueChange={(v) => setFormData(f => ({ ...f, priority: v }))} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Detailed description of the issue or request..."
              value={formData.description}
              onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
              disabled={loading}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Paperclip className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drag & drop files or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">Max 10MB per file</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Format date helper
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function AssetProfile() {
  const [match, params] = useRoute("/assets/:id");
  const { user, isAdmin, isHR } = useAuth();
  const [asset] = useState(mockAsset);
  const [tickets] = useState(mockTickets);
  const [auditLog] = useState(mockAuditLog);

  const canEdit = isAdmin || isHR;
  const DeviceIcon = getDeviceIcon(asset.deviceType);
  const statusBadge = getStatusBadge(asset.status);
  const warrantyExpired = asset.warrantyExpiry && new Date(asset.warrantyExpiry) < new Date();
  const warrantyDaysLeft = asset.warrantyExpiry 
    ? Math.ceil((new Date(asset.warrantyExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Layout>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <Link href="/assets">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{asset.brand} {asset.model}</h1>
              <Badge variant="outline" className={statusBadge.style}>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono">{asset.assetId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {canEdit && (
            <>
              <Button variant="outline" className="gap-2">
                <Edit2 className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Print Label
              </Button>
            </>
          )}
          <CreateTicketDialog assetId={asset.assetId} assetName={`${asset.brand} ${asset.model}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Asset Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* QR Code Card */}
          <Card className="border border-border shadow-sm">
            <CardContent className="p-6 flex flex-col items-center">
              <div className="w-40 h-40 bg-white border-2 border-border rounded-xl flex items-center justify-center mb-4 p-2">
                <div className="w-full h-full bg-slate-50 rounded-lg flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-slate-300" />
                </div>
              </div>
              <p className="font-mono text-sm font-medium mb-1">{asset.assetId}</p>
              <p className="text-xs text-muted-foreground mb-4">{asset.serialNumber}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-3 w-3" /> QR
                </Button>
                <Button variant="outline" size="sm" className="gap-1">
                  <Barcode className="h-3 w-3" /> Barcode
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Device Info Card */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DeviceIcon className="h-4 w-4" /> Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-medium">{asset.deviceType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="text-sm font-medium">{asset.brand}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm font-medium">{asset.model}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Serial Number</p>
                  <p className="text-sm font-mono">{asset.serialNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Card */}
          {asset.assignedTo && (
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Assigned To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={asset.assignedTo.avatar} />
                    <AvatarFallback>
                      {asset.assignedTo.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{asset.assignedTo.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.assignedTo.email}</p>
                    <p className="text-xs text-muted-foreground">{asset.assignedTo.department}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{asset.location}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warranty Card */}
          <Card className={`border shadow-sm ${warrantyExpired ? 'border-red-200 bg-red-50/50' : 'border-border'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Warranty Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.warrantyExpiry ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expires</span>
                    <span className={`text-sm font-medium ${warrantyExpired ? 'text-red-600' : ''}`}>
                      {formatDate(asset.warrantyExpiry)}
                    </span>
                  </div>
                  {warrantyDaysLeft !== null && (
                    <div className={`p-2 rounded-lg text-center text-sm ${
                      warrantyExpired 
                        ? 'bg-red-100 text-red-700' 
                        : warrantyDaysLeft < 90 
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {warrantyExpired 
                        ? <><AlertTriangle className="h-4 w-4 inline mr-1" /> Warranty Expired</>
                        : warrantyDaysLeft < 90
                          ? <><AlertCircle className="h-4 w-4 inline mr-1" /> {warrantyDaysLeft} days remaining</>
                          : <><CheckCircle className="h-4 w-4 inline mr-1" /> {warrantyDaysLeft} days remaining</>
                      }
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No warranty information</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="specs" className="w-full">
            <TabsList className="bg-muted p-1 mb-6 w-full justify-start">
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Specifications Tab */}
            <TabsContent value="specs" className="space-y-6">
              {/* Hardware Specs */}
              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" /> Hardware Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {asset.cpu && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Processor</p>
                        <p className="text-sm font-medium">{asset.cpu}</p>
                        {asset.cpuGeneration && <p className="text-xs text-muted-foreground">{asset.cpuGeneration}</p>}
                      </div>
                    )}
                    {asset.ram && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Memory (RAM)</p>
                        <p className="text-sm font-medium">{asset.ram}</p>
                      </div>
                    )}
                    {asset.storage && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Storage</p>
                        <p className="text-sm font-medium">{asset.storage} {asset.storageType}</p>
                      </div>
                    )}
                    {asset.operatingSystem && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Operating System</p>
                        <p className="text-sm font-medium">{asset.operatingSystem}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Purchase Info */}
              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" /> Purchase Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Purchase Date</p>
                      <p className="text-sm font-medium">{formatDate(asset.purchaseDate)}</p>
                    </div>
                    {asset.purchasePrice && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Purchase Price</p>
                        <p className="text-sm font-medium">${asset.purchasePrice.toLocaleString()}</p>
                      </div>
                    )}
                    {asset.warrantyExpiry && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Warranty Until</p>
                        <p className="text-sm font-medium">{formatDate(asset.warrantyExpiry)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {asset.notes && (
                <Card className="border border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" /> Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{asset.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Support Tickets Tab */}
            <TabsContent value="tickets" className="space-y-6">
              <Card className="border border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Support Tickets</CardTitle>
                    <CardDescription>Issues and requests for this asset</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {tickets.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No tickets for this asset</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket) => {
                        const ticketStatus = getTicketStatusBadge(ticket.status);
                        return (
                          <div key={ticket.id} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{ticket.id}</span>
                                <Badge variant="outline" className={getPriorityBadge(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <Badge variant="outline" className={ticketStatus.style}>
                                {ticketStatus.label}
                              </Badge>
                            </div>
                            <h4 className="font-medium mb-1">{ticket.title}</h4>
                            <p className="text-sm text-muted-foreground mb-3">{ticket.description}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {ticket.createdBy}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {formatDate(ticket.createdAt)}
                              </span>
                              {ticket.resolvedAt && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Resolved {formatDate(ticket.resolvedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" /> Audit Log
                  </CardTitle>
                  <CardDescription>Complete history of changes to this asset</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative border-l border-border ml-3 space-y-6 pl-6">
                    {auditLog.map((entry, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full border-2 border-background bg-primary" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.action}</span>
                            <span className="text-xs text-muted-foreground">• {entry.date}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.details}</p>
                          <p className="text-xs text-muted-foreground">by {entry.user}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Info */}
              <Card className="border border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm">System Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p>{new Date(asset.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p>{new Date(asset.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
