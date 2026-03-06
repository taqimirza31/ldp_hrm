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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { 
  Laptop, Smartphone, Monitor, Search, Plus, Filter, Download, Upload,
  QrCode, Barcode, Package, Wrench, Archive, CheckCircle, CheckCircle2, AlertTriangle,
  Building, MapPin, Calendar, User, HardDrive, Cpu, MemoryStick, Box,
  MoreHorizontal, Eye, Edit2, Trash2, RefreshCw, FileSpreadsheet, Camera, ChevronsUpDown,
  Router, Server, Printer, Headphones, Keyboard, Mouse, Tablet, Wifi,
  TicketIcon, Clock, MessageSquare, Send, Inbox, Bell, DollarSign,
  TrendingUp, AlertCircle, PackageCheck, PackageX, Layers,
  Hash, CalendarDays, Save, X,
  Paperclip, ExternalLink, Image, File, FilePlus, FileText
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import QRCode from "qrcode";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PRODUCT_TYPES } from "@/lib/assetProductTypes";
import { EmployeeSelect } from "@/components/EmployeeSelect";

// ==================== TYPE DEFINITIONS ====================

interface StockItem {
  id: string;
  assetId?: string;
  name: string;
  category: string;
  productType?: string;
  quantity: number;
  available: number;
  description: string;
  location: string;
  specs?: Record<string, string | number>;
}

interface AssignedSystem {
  id: string;
  assetId: string;
  userId?: string;
  userName: string;
  userEmail: string;
  ram: string;
  storage: string;
  processor: string;
  generation: string;
  notes?: string;
  employeeId?: string;
  assetName?: string;
  assetCategory?: string;
  department?: string;
  createdAt?: string;
}

interface SupportTicket {
  id: string;
  ticketNumber: string;
  assetId?: string;
  assetName?: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  createdBy: { id: string; name: string; email: string; department: string; };
  assignedTo?: { id: string; name: string; };
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketComment {
  id: string;
  ticketId: string;
  message: string;
  authorId?: string;
  authorName: string;
  authorEmail?: string;
  authorRole: "employee" | "it_support" | "admin";
  isStatusUpdate?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  purchaseDate: string;
  totalAmount: string | number;
  items: string;
  fileName?: string | null;
  fileType?: string | null;
  filePath?: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== API DATA TRANSFORMERS ====================

// Transform snake_case API response to camelCase frontend types
interface StockAssignment {
  id: string;
  assetId: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
}

const transformStockItem = (item: any): StockItem & { assignments?: StockAssignment[] } => {
  const base: StockItem = {
    id: item.id,
    assetId: item.asset_id || undefined,
    name: item.name,
    category: item.category,
    productType: item.product_type,
    quantity: item.quantity,
    available: item.available,
    description: item.description || "",
    location: item.location || "IT Storage",
    specs: item.specs || undefined,
  };
  let rawAssignments = item.assignments;
  if (typeof rawAssignments === "string") {
    try {
      rawAssignments = JSON.parse(rawAssignments || "[]");
    } catch {
      rawAssignments = [];
    }
  }
  const assignments = Array.isArray(rawAssignments) ? rawAssignments.map((a: any) => ({
    id: a.id,
    assetId: a.asset_id,
    userId: a.user_id,
    userName: a.user_name || `${a.first_name || ""} ${a.last_name || ""}`.trim(),
    userEmail: a.user_email,
    employeeId: a.employee_id,
    firstName: a.first_name,
    lastName: a.last_name,
  })) : [];
  return { ...base, assignments: assignments.length > 0 ? assignments : undefined };
};

const transformSystem = (item: any): AssignedSystem => ({
  id: item.id,
  assetId: item.asset_id,
  userId: item.user_id || undefined,
  userName: item.user_name,
  userEmail: item.user_email,
  ram: item.ram,
  storage: item.storage,
  processor: item.processor,
  generation: item.generation,
  notes: item.notes,
  employeeId: item.employee_id || undefined,
  assetName: item.asset_name || undefined,
  assetCategory: item.asset_category || undefined,
  department: item.department || undefined,
  createdAt: item.created_at || undefined,
});

const transformInvoice = (item: any): Invoice => ({
  id: item.id,
  invoiceNumber: item.invoice_number,
  vendor: item.vendor,
  purchaseDate: item.purchase_date,
  totalAmount: item.total_amount ?? 0,
  items: item.items ?? "",
  fileName: item.file_name ?? null,
  fileType: item.file_type ?? null,
  filePath: item.file_path ?? null,
  status: item.status ?? "pending",
  notes: item.notes ?? null,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const transformTicket = (item: any): SupportTicket => ({
  id: item.id,
  ticketNumber: item.ticket_number,
  assetId: item.asset_id,
  assetName: item.asset_name,
  title: item.title,
  description: item.description,
  priority: item.priority,
  status: item.status,
  createdBy: {
    id: item.created_by_id || "",
    name: item.created_by_name,
    email: item.created_by_email || "",
    department: item.created_by_department || "",
  },
  assignedTo: item.assigned_to_id ? {
    id: item.assigned_to_id,
    name: item.assigned_to_name || "",
  } : undefined,
  resolution: item.resolution,
  resolvedAt: item.resolved_at,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const transformTicketComment = (item: any): TicketComment => ({
  id: item.id,
  ticketId: item.ticket_id,
  message: item.message,
  authorId: item.author_id,
  authorName: item.author_name,
  authorEmail: item.author_email,
  authorRole: item.author_role,
  isStatusUpdate: item.is_status_update,
  oldStatus: item.old_status,
  newStatus: item.new_status,
  createdAt: item.created_at,
});

// ==================== HELPER FUNCTIONS ====================

/** Out-of-stock only. */
const isOutOfStock = (item: StockItem) => item.available === 0;

/** Icon component for assigned asset: Laptop for systems, Package for peripherals. */
const AssignedAssetIcon = ({ system }: { system: { assetId?: string; notes?: string } }) => {
  const isPeripheral = system.assetId?.startsWith("PERIPH");
  const notes = (system.notes || "").toLowerCase();
  if (isPeripheral) {
    if (notes.includes("headphone")) return <Headphones className="h-4 w-4 text-violet-600 shrink-0" aria-hidden />;
    if (notes.includes("mouse")) return <Mouse className="h-4 w-4 text-slate-600 shrink-0" aria-hidden />;
    if (notes.includes("lcd") || notes.includes("led") || notes.includes("monitor")) return <Monitor className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />;
    if (notes.includes("keyboard")) return <Keyboard className="h-4 w-4 text-slate-600 shrink-0" aria-hidden />;
    return <Package className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />;
  }
  return <Laptop className="h-4 w-4 text-blue-600 shrink-0" aria-hidden />;
};

const getPriorityBadge = (priority: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    low: { label: "Low", className: "bg-slate-100 text-slate-700 border-slate-300" },
    medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    high: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-300" },
    critical: { label: "Critical", className: "bg-red-100 text-red-700 border-red-300 animate-pulse" }
  };
  return configs[priority] || configs.medium;
};

const getTicketStatusBadge = (status: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    open: { label: "Open", className: "bg-blue-100 text-blue-700 border-blue-300" },
    in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    resolved: { label: "Resolved", className: "bg-green-100 text-green-700 border-green-300" },
    closed: { label: "Closed", className: "bg-slate-100 text-slate-700 border-slate-300" }
  };
  return configs[status] || configs.open;
};

// Format date to DD/MM/YYYY
const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return original if invalid
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
};

// Format date for input fields (YYYY-MM-DD)
const formatDateForInput = (dateStr: string | undefined | null): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const generateId = () => `temp-${Date.now().toString()}`;

// ==================== DIALOG COMPONENTS ====================

// Add/Edit Stock Dialog - with product-type-specific specs
function StockDialog({ item, onSave, onClose, open }: { item?: StockItem; onSave: (item: StockItem) => void; onClose: () => void; open: boolean }) {
  const defaultForm: Partial<StockItem> = {
    name: "", category: "Systems", productType: "laptop", quantity: 0, available: 0,
    description: "", location: "IT Storage", specs: {}
  };
  const [formData, setFormData] = useState<Partial<StockItem>>(item ? {
    ...item,
    specs: item.specs || {}
  } : defaultForm);

  const selectedProductType = PRODUCT_TYPES.find(p => p.id === (formData.productType || "other")) || PRODUCT_TYPES.find(p => p.id === "other")!;

  // Update form data when item changes (for editing different rows)
  useEffect(() => {
    if (open) {
      setFormData(item ? { ...item, specs: item.specs || {} } : defaultForm);
    }
  }, [item, open]);

  const handleSpecChange = (key: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      specs: { ...(prev.specs || {}), [key]: value }
    }));
  };

  const handleProductTypeChange = (productTypeId: string) => {
    const pt = PRODUCT_TYPES.find(p => p.id === productTypeId);
    setFormData(prev => ({
      ...prev,
      productType: productTypeId,
      category: pt?.category || prev.category,
      specs: {} // Reset specs when changing product type
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { toast.error("Item name is required"); return; }
    const specs = formData.specs || {};
    Object.keys(specs).forEach(k => { if (specs[k] === "" || specs[k] == null) delete specs[k]; });
    onSave({
      id: item?.id || generateId(),
      name: formData.name || "",
      category: formData.category || selectedProductType.category,
      productType: formData.productType || undefined,
      quantity: Number(formData.quantity) || 0,
      available: Number(formData.available) || 0,
      description: formData.description || "",
      location: formData.location || "IT Storage",
      specs: Object.keys(specs).length > 0 ? specs : undefined
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
          <DialogDescription>Fill in details. Product type determines which spec fields appear.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Product Type *</Label>
              <Select value={formData.productType || "laptop"} onValueChange={handleProductTypeChange}>
                <SelectTrigger><SelectValue placeholder="Select product type" /></SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map(pt => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Item Name *</Label>
              <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={selectedProductType ? `e.g., Dell ${selectedProductType.label}` : "e.g., Laptop"} />
            </div>
            {/* Dynamic spec fields based on product type */}
            {selectedProductType.specFields.length > 0 && (
              <div className="col-span-2">
                <Separator className="my-2" />
                <p className="text-sm font-medium text-muted-foreground mb-3">Specifications</p>
                <div className="grid grid-cols-2 gap-3">
                  {selectedProductType.specFields.map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs">{field.label}</Label>
                      {field.type === "select" && field.options ? (
                        <Select value={String(formData.specs?.[field.key] || "")} onValueChange={(v) => handleSpecChange(field.key, v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
                          <SelectContent>
                            {field.options.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={formData.specs?.[field.key] ?? ""}
                          onChange={(e) => handleSpecChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="h-9"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Peripherals">Peripherals</SelectItem>
                  <SelectItem value="Components">Components</SelectItem>
                  <SelectItem value="Storage">Storage</SelectItem>
                  <SelectItem value="Network">Network</SelectItem>
                  <SelectItem value="Display">Display</SelectItem>
                  <SelectItem value="Systems">Systems</SelectItem>
                  <SelectItem value="Hardware">Hardware</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={formData.location || ""} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="IT Storage" />
            </div>
            <div className="space-y-2">
              <Label>Total Quantity</Label>
              <Input type="number" min={0} value={formData.quantity ?? 0} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Available</Label>
              <Input type="number" min={0} value={formData.available ?? 0} onChange={(e) => setFormData({ ...formData, available: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Additional details..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit"><Save className="h-4 w-4 mr-2" />{item ? "Update" : "Add"} Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Stock detail: right-side panel (inventory only — quantities, not people)
function StockDetailSheet({ item, onClose, open, onEdit, onShowQr }: { item?: StockItem; onClose: () => void; open: boolean; onEdit: (item: StockItem) => void; onShowQr?: (type: "stock", id: string, label: string, publicId?: string) => void }) {
  if (!item) return null;
  const assignments = (item as StockItem & { assignments?: StockAssignment[] }).assignments || [];
  const specEntries = item.specs && typeof item.specs === "object" && Object.keys(item.specs).length > 0
    ? Object.entries(item.specs) as [string, string | number][]
    : [];
  const productTypeLabel = item.productType ? PRODUCT_TYPES.find(pt => pt.id === item.productType)?.label ?? String(item.productType) : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></div>
            <span>{item.name}</span>
          </SheetTitle>
          <SheetDescription>Inventory item — quantities and specs. Assignments are in the list below.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 pt-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Overview</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Category</span><p className="font-medium">{item.category}</p></div>
              {productTypeLabel && <div><span className="text-muted-foreground">Product type</span><p className="font-medium">{productTypeLabel}</p></div>}
              <div><span className="text-muted-foreground">Location</span><p className="font-medium">{item.location || "—"}</p></div>
            </div>
          </div>
            <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Stock breakdown</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Total</span><p className="font-mono font-medium">{item.quantity}</p></div>
              <div><span className="text-muted-foreground">Available</span><p className="font-mono font-medium text-green-600 dark:text-green-400">{item.available}</p></div>
              <div><span className="text-muted-foreground">Assigned</span><p className="font-mono">{assignments.length}</p></div>
            </div>
          </div>
          {specEntries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Specs (structured)</p>
              <div className="flex flex-wrap gap-2">
                {specEntries.map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-normal capitalize">{k.replace(/([A-Z])/g, " $1").trim()}: {String(v)}</Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Assigned units ({assignments.length})</p>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units assigned. Use “Assign from stock” to assign to an employee.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.userName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{a.assetId}</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/assets/${a.id}`}>View profile</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {item.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
              <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-4 border-t mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
          {item.assetId && onShowQr && (
            <Button variant="outline" onClick={() => { onShowQr("stock", item.id, item.assetId || item.name, item.assetId ?? undefined); }} className="flex-1">
              <QrCode className="h-4 w-4 mr-2" /> QR code
            </Button>
          )}
          <Button onClick={() => { onClose(); onEdit(item); }} className="flex-1"><Edit2 className="h-4 w-4 mr-2" /> Edit</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Drawer: list of assigned employees for a stock item (opened when clicking Assigned number)
function StockAssignedDrawer({ item, open, onClose }: { item?: StockItem | null; open: boolean; onClose: () => void }) {
  if (!item) return null;
  const assignments = (item as StockItem & { assignments?: StockAssignment[] }).assignments || [];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" side="right">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Assigned units — {item.name}
          </SheetTitle>
          <SheetDescription>Employees who have this item assigned. Click “View profile” to open the asset record.</SheetDescription>
        </SheetHeader>
        <div className="pt-4 space-y-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No units assigned.</p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card text-card-foreground">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.userName}</p>
                  <p className="text-xs text-muted-foreground font-mono">Asset ID: {a.assetId}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/assets/${a.id}`}>View profile</Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Assign from Stock Dialog - stock item + employee selection
function AssignFromStockDialog({
  open,
  onClose,
  onSuccess,
  stockItems,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (employeeId?: string) => void;
  stockItems: StockItem[];
}) {
  const [stockItemId, setStockItemId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [processor, setProcessor] = useState("");
  const [generation, setGeneration] = useState("");
  const [loading, setLoading] = useState(false);
  const availableStock = stockItems.filter((s) => (s.available ?? 0) > 0);

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/employees");
      return res.json();
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockItemId || !employeeId) {
      toast.error("Select stock item and employee");
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/assets/systems/assign-from-stock", {
        stockItemId,
        employeeId,
        ...(ram && { ram }),
        ...(storage && { storage }),
        ...(processor && { processor }),
        ...(generation && { generation }),
      });
      // Validate the response is actually JSON from our API (not HTML from Vite catch-all)
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server returned an unexpected response. Please restart the server.");
      }
      const result = await response.json();
      if (!result?.id) {
        throw new Error("Assignment failed – no valid record returned.");
      }
      toast.success("System assigned successfully");
      const assignedToId = employeeId;
      setStockItemId("");
      setEmployeeId("");
      setRam("");
      setStorage("");
      setProcessor("");
      setGeneration("");
      onSuccess(assignedToId);
      window.dispatchEvent(new CustomEvent("employee-updated", { detail: { employeeId: assignedToId } }));
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign");
    } finally {
      setLoading(false);
    }
  };

  const selectedEmp = employees.find((e: any) => e.id === employeeId);
  const empLabel = selectedEmp
    ? `${selectedEmp.first_name} ${selectedEmp.last_name} (${selectedEmp.employee_id}) · ${selectedEmp.department || "-"}`
    : "Select employee...";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assign from Stock</DialogTitle>
          <DialogDescription>
            Select a stock item (one per model/pool) and employee. Optionally record this unit&apos;s specs so each assigned asset is tracked accurately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Stock Item *</Label>
            <Select value={stockItemId} onValueChange={setStockItemId} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Select available item" /></SelectTrigger>
              <SelectContent>
                {availableStock.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">No available items</div>
                ) : (
                  availableStock.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.available} available
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee *</Label>
            <EmployeeSelect
              value={employeeId}
              onChange={(id) => setEmployeeId(id)}
              employees={employees}
              disabled={loading}
              placeholder="Select employee..."
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">This unit&apos;s specs (optional — e.g. i5 8th Gen, 8 GB)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">RAM</Label>
                <Select value={ram} onValueChange={setRam} disabled={loading}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4 GB">4 GB</SelectItem>
                    <SelectItem value="8 GB">8 GB</SelectItem>
                    <SelectItem value="12 GB">12 GB</SelectItem>
                    <SelectItem value="16 GB">16 GB</SelectItem>
                    <SelectItem value="32 GB">32 GB</SelectItem>
                    <SelectItem value="64 GB">64 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Storage</Label>
                <Select value={storage} onValueChange={setStorage} disabled={loading}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128 GB">128 GB</SelectItem>
                    <SelectItem value="238 GB">238 GB</SelectItem>
                    <SelectItem value="256 GB">256 GB</SelectItem>
                    <SelectItem value="477 GB">477 GB</SelectItem>
                    <SelectItem value="500 GB">500 GB</SelectItem>
                    <SelectItem value="512 GB">512 GB</SelectItem>
                    <SelectItem value="1 TB">1 TB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Processor</Label>
                <Select value={processor} onValueChange={setProcessor} disabled={loading}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="i3">Intel Core i3</SelectItem>
                    <SelectItem value="i5">Intel Core i5</SelectItem>
                    <SelectItem value="i7">Intel Core i7</SelectItem>
                    <SelectItem value="i9">Intel Core i9</SelectItem>
                    <SelectItem value="Ryzen 5">AMD Ryzen 5</SelectItem>
                    <SelectItem value="Ryzen 7">AMD Ryzen 7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Generation</Label>
                <Select value={generation} onValueChange={setGeneration} disabled={loading}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3rd Gen">3rd Gen</SelectItem>
                    <SelectItem value="6th Gen">6th Gen</SelectItem>
                    <SelectItem value="8th Gen">8th Gen</SelectItem>
                    <SelectItem value="10th Gen">10th Gen</SelectItem>
                    <SelectItem value="11th Gen">11th Gen</SelectItem>
                    <SelectItem value="12th Gen">12th Gen</SelectItem>
                    <SelectItem value="13th Gen">13th Gen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!stockItemId || !employeeId || loading}>
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit System Dialog (existing assignment only)
function SystemDialog({ item, onSave, onClose, open }: { item?: AssignedSystem; onSave: (item: AssignedSystem) => void; onClose: () => void; open: boolean }) {
  const [formData, setFormData] = useState<Partial<AssignedSystem>>(item || {
    userName: "", userEmail: "", ram: "16 GB", storage: "256 GB", processor: "i5", generation: "8th Gen"
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(item?.userId || "");

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/employees"); return res.json(); },
    enabled: open,
  });

  useEffect(() => {
    if (open && item) {
      setFormData(item);
      setSelectedEmployeeId(item.userId || "");
    }
  }, [item, open]);

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find((e: any) => e.id === empId);
    if (emp) {
      setFormData((prev) => ({
        ...prev,
        userId: emp.id,
        userName: `${emp.first_name} ${emp.last_name}`,
        userEmail: emp.work_email || "",
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item?.id || (!formData.userName && !selectedEmployeeId)) { toast.error("Employee is required"); return; }
    onSave({
      ...item,
      userId: selectedEmployeeId || item.userId,
      userName: formData.userName || "",
      userEmail: formData.userEmail || "",
      ram: formData.ram || "16 GB",
      storage: formData.storage || "256 GB",
      processor: formData.processor || "i5",
      generation: formData.generation || "8th Gen",
      notes: formData.notes
    });
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit System Assignment</DialogTitle>
          <DialogDescription>Update assignment details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Assigned To *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{selectedEmployeeId ? (employees.find((e: any) => e.id === selectedEmployeeId) ? `${employees.find((e: any) => e.id === selectedEmployeeId).first_name} ${employees.find((e: any) => e.id === selectedEmployeeId).last_name}` : formData.userName) : (formData.userName || "Select employee...")}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp: any) => (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.first_name} ${emp.last_name} ${emp.employee_id} ${emp.department || ""}`}
                            onSelect={() => handleEmployeeChange(emp.id)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                              <span className="text-xs text-muted-foreground">{emp.employee_id} · {emp.department || "-"}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>RAM</Label>
              <Select value={formData.ram} onValueChange={(v) => setFormData({ ...formData, ram: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4 GB">4 GB</SelectItem>
                  <SelectItem value="8 GB">8 GB</SelectItem>
                  <SelectItem value="12 GB">12 GB</SelectItem>
                  <SelectItem value="16 GB">16 GB</SelectItem>
                  <SelectItem value="32 GB">32 GB</SelectItem>
                  <SelectItem value="64 GB">64 GB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Storage</Label>
              <Select value={formData.storage} onValueChange={(v) => setFormData({ ...formData, storage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="128 GB">128 GB</SelectItem>
                  <SelectItem value="238 GB">238 GB</SelectItem>
                  <SelectItem value="256 GB">256 GB</SelectItem>
                  <SelectItem value="477 GB">477 GB</SelectItem>
                  <SelectItem value="500 GB">500 GB</SelectItem>
                  <SelectItem value="512 GB">512 GB</SelectItem>
                  <SelectItem value="1 TB">1 TB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Processor</Label>
              <Select value={formData.processor} onValueChange={(v) => setFormData({ ...formData, processor: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="i3">Intel Core i3</SelectItem>
                  <SelectItem value="i5">Intel Core i5</SelectItem>
                  <SelectItem value="i7">Intel Core i7</SelectItem>
                  <SelectItem value="i9">Intel Core i9</SelectItem>
                  <SelectItem value="Ryzen 5">AMD Ryzen 5</SelectItem>
                  <SelectItem value="Ryzen 7">AMD Ryzen 7</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Generation</Label>
              <Select value={formData.generation} onValueChange={(v) => setFormData({ ...formData, generation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3rd Gen">3rd Gen</SelectItem>
                  <SelectItem value="6th Gen">6th Gen</SelectItem>
                  <SelectItem value="8th Gen">8th Gen</SelectItem>
                  <SelectItem value="10th Gen">10th Gen</SelectItem>
                  <SelectItem value="11th Gen">11th Gen</SelectItem>
                  <SelectItem value="12th Gen">12th Gen</SelectItem>
                  <SelectItem value="13th Gen">13th Gen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Notes</Label>
              <Input value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit"><Save className="h-4 w-4 mr-2" />{item ? "Update" : "Assign"} System</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Ticket Detail Dialog for IT Admins
function TicketDetailDialog({ 
  ticket, 
  onStatusChange 
}: { 
  ticket: SupportTicket; 
  onStatusChange: (ticketId: string, status: string, comment?: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState(ticket.status);
  const [statusComment, setStatusComment] = useState("");
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // Fetch comments for this ticket
  const { data: comments = [], isLoading: loadingComments, refetch: refetchComments } = useQuery({
    queryKey: ["ticket-comments", ticket.id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/assets/tickets/${ticket.id}/comments`);
      const data = await response.json();
      return Array.isArray(data) ? data.map(transformTicketComment) : [];
    },
    enabled: open,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", `/api/assets/tickets/${ticket.id}/comments`, { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Comment added successfully");
      setReply("");
    },
    onError: (error: any) => {
      toast.error("Failed to add comment", {
        description: error.message || "Please try again"
      });
    }
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: async ({ status, comment }: { status: string; comment?: string }) => {
      const response = await apiRequest("PATCH", `/api/assets/tickets/${ticket.id}/status`, { status, comment });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticket.id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket status updated");
      setShowStatusDialog(false);
      setStatusComment("");
    },
    onError: (error: any) => {
      toast.error("Failed to update status", {
        description: error.message || "Please try again"
      });
    }
  });

  const handleReply = () => {
    if (!reply.trim()) return;
    addCommentMutation.mutate(reply);
  };

  const handleStatusChange = () => {
    statusMutation.mutate({ status: newStatus, comment: statusComment || undefined });
  };

  const getAuthorRoleLabel = (role: string) => {
    switch (role) {
      case "it_support": return "IT Support";
      case "admin": return "Admin";
      case "employee": return "Employee";
      default: return role;
    }
  };

  const priorityBadge = getPriorityBadge(ticket.priority);
  const statusBadge = getTicketStatusBadge(ticket.status);

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setOpen(true)}
        className="gap-1"
      >
        <Eye className="h-4 w-4" />
        View
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2">
                <TicketIcon className="h-5 w-5 text-primary" />
                {ticket.ticketNumber}
              </DialogTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className={priorityBadge.className}>
                  {priorityBadge.label}
                </Badge>
                <Badge variant="outline" className={statusBadge.className}>
                  {statusBadge.label}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Ticket Info */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-lg">{ticket.title}</h4>
              <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>
              {ticket.assetName && (
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Related Asset:</span> {ticket.assetName}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{ticket.createdBy.name}</p>
                  <p className="text-xs text-muted-foreground">{ticket.createdBy.email}</p>
                  {ticket.createdBy.department && (
                    <p className="text-xs text-muted-foreground">{ticket.createdBy.department}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(ticket.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">Updated: {formatDate(ticket.updatedAt)}</p>
                </div>
              </div>
            </div>

            {/* Status Management */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant="outline" className={statusBadge.className}>
                  {statusBadge.label}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowStatusDialog(true)}
              >
                Update Status
              </Button>
            </div>

            <Separator />

            {/* Activity Log / Comments */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Activity Log
                </h5>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetchComments()}
                  disabled={loadingComments}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingComments ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-lg p-3">
                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Spinner className="h-6 w-6" />
                  </div>
                ) : comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.isStatusUpdate === "true"
                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                            : comment.authorRole === "employee"
                              ? "bg-primary/5 border border-primary/20 ml-4"
                              : "bg-muted mr-4"
                        }`}
                      >
                        {comment.isStatusUpdate === "true" ? (
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="font-medium">{comment.authorName}</span>
                            <span className="text-muted-foreground">changed status:</span>
                            <Badge variant="outline" className={getTicketStatusBadge(comment.oldStatus || "").className}>
                              {getTicketStatusBadge(comment.oldStatus || "").label}
                            </Badge>
                            <span>→</span>
                            <Badge variant="outline" className={getTicketStatusBadge(comment.newStatus || "").className}>
                              {getTicketStatusBadge(comment.newStatus || "").label}
                            </Badge>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.authorName}</span>
                              <Badge variant="outline" className="text-xs">
                                {getAuthorRoleLabel(comment.authorRole)}
                              </Badge>
                            </div>
                            <p className="text-sm">{comment.message}</p>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No activity yet.
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* Reply Box */}
            {ticket.status !== "closed" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Add Response</Label>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your response to the employee..."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      className="flex-1"
                      disabled={addCommentMutation.isPending}
                    />
                    <Button 
                      onClick={handleReply} 
                      size="icon" 
                      className="h-auto"
                      disabled={addCommentMutation.isPending || !reply.trim()}
                    >
                      {addCommentMutation.isPending ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Resolution info */}
            {ticket.resolution && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h5 className="font-medium text-green-800 dark:text-green-300 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Resolution
                </h5>
                <p className="text-sm text-green-700 dark:text-green-400">{ticket.resolution}</p>
                {ticket.resolvedAt && (
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Resolved on {formatDate(ticket.resolvedAt)}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Ticket Status</DialogTitle>
            <DialogDescription>
              Change the status of this ticket. An update will be logged and visible to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comment (Optional)</Label>
              <Textarea
                placeholder="Add a note about this status change..."
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={statusMutation.isPending || newStatus === ticket.status}
            >
              {statusMutation.isPending ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Add/Edit Invoice Dialog
function InvoiceDialog({ item, onSave, onClose, open }: { item?: Invoice; onSave: (inv: Invoice) => void; onClose: () => void; open: boolean }) {
  const [formData, setFormData] = useState<Partial<Invoice> & { filePath?: string | null }>(item ?? {
    invoiceNumber: "", vendor: "", purchaseDate: new Date().toISOString().split("T")[0], totalAmount: "", items: "", status: "pending", notes: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      if (item) {
        setFormData({
          ...item,
          purchaseDate: item.purchaseDate ? formatDateForInput(String(item.purchaseDate)) : new Date().toISOString().split("T")[0],
          filePath: item.filePath ?? undefined,
        });
      } else {
        setFormData({
          invoiceNumber: "", vendor: "", purchaseDate: new Date().toISOString().split("T")[0], totalAmount: "", items: "", status: "pending", notes: "",
          fileName: null, fileType: null, filePath: null,
        });
      }
    }
  }, [item, open]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormData((prev) => ({ ...prev, fileName: file.name, fileType: file.type, filePath: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const handleRemoveFile = () => {
    setFormData((prev) => ({ ...prev, fileName: null, fileType: null, filePath: null }));
    fileInputRef.current?.value && (fileInputRef.current.value = "");
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.invoiceNumber?.trim()) { toast.error("Invoice number is required"); return; }
    if (!formData.vendor?.trim()) { toast.error("Vendor is required"); return; }
    if (!formData.items?.trim()) { toast.error("Items description is required"); return; }
    const purchaseDate = formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : new Date().toISOString();
    onSave({
      id: item?.id ?? "",
      invoiceNumber: formData.invoiceNumber!.trim(),
      vendor: formData.vendor!.trim(),
      purchaseDate,
      totalAmount: formData.totalAmount !== undefined && formData.totalAmount !== "" ? Number(formData.totalAmount) : 0,
      items: formData.items!.trim(),
      status: (formData.status as Invoice["status"]) ?? "pending",
      notes: formData.notes?.trim() || null,
      fileName: formData.fileName ?? item?.fileName ?? null,
      fileType: formData.fileType ?? item?.fileType ?? null,
      filePath: formData.filePath ?? item?.filePath ?? null,
    });
    onClose();
  };
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Invoice" : "Add Invoice"}</DialogTitle>
          <DialogDescription>Record a purchase invoice for asset tracking. You can attach a PDF.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice number *</Label>
              <Input value={formData.invoiceNumber ?? ""} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} placeholder="e.g. INV-2024-001" />
            </div>
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Input value={formData.vendor ?? ""} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} placeholder="Vendor name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase date *</Label>
              <Input type="date" value={formData.purchaseDate ?? ""} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Total amount</Label>
              <Input type="number" step="0.01" min="0" value={formData.totalAmount ?? ""} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Items / description *</Label>
            <Textarea value={formData.items ?? ""} onChange={(e) => setFormData({ ...formData, items: e.target.value })} placeholder="e.g. 5x Laptop, 2x Monitor" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Upload PDF (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Choose PDF file"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileText className="h-4 w-4 mr-2" /> Choose PDF
              </Button>
              {(formData.fileName || item?.fileName) && (
                <>
                  <span className="text-sm text-muted-foreground truncate max-w-[180px]" title={formData.fileName || item?.fileName || ""}>
                    {formData.fileName || item?.fileName}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile} className="text-muted-foreground">Remove</Button>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status ?? "pending"} onValueChange={(v) => setFormData({ ...formData, status: v as Invoice["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes ?? ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit"><Save className="h-4 w-4 mr-2" /> Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// QR Code Dialog — show QR (client-generated when publicId is set, else API). Works even when API isn't reached.
function QRCodeDialog({ open, onClose, type, id, label, publicId }: { open: boolean; onClose: () => void; type: "stock" | "system"; id: string; label: string; publicId?: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const publicViewUrl = publicId ? `${window.location.origin}/assets/view/${encodeURIComponent(publicId)}` : null;

  useEffect(() => {
    if (!open || (!id && !publicId)) {
      setQrDataUrl(null);
      setQrBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (publicViewUrl) {
      setQrLoading(true);
      QRCode.toDataURL(publicViewUrl, { width: 256, margin: 2, type: "image/png" })
        .then(setQrDataUrl)
        .catch(() => toast.error("Failed to generate QR code"))
        .finally(() => setQrLoading(false));
      return;
    }
    let blobUrl: string | null = null;
    setQrLoading(true);
    setQrDataUrl(null);
    fetch(`/api/assets/${type}/${encodeURIComponent(id)}/qr?size=256`, { credentials: "include" })
      .then((res) => {
        const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
        if (contentType.includes("text/html")) throw new Error("HTML");
        if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized" : "Failed to load QR");
        if (!contentType.includes("image/")) throw new Error("Not an image");
        return res.blob();
      })
      .then((blob) => {
        blobUrl = URL.createObjectURL(blob);
        setQrBlobUrl(blobUrl);
      })
      .catch((err) => {
        if (err?.message === "HTML") toast.error("QR request hit the app instead of the API. Restart the dev server (npm run dev).");
        else if (err?.message === "Unauthorized") toast.error("Please sign in again.");
        else toast.error("Failed to load QR code");
      })
      .finally(() => setQrLoading(false));
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [open, id, type, publicId, publicViewUrl]);

  const handleDownload = async () => {
    try {
      if (publicViewUrl) {
        const dataUrl = await QRCode.toDataURL(publicViewUrl, { width: 512, margin: 2, type: "image/png" });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `asset-qr-${label.replace(/\s+/g, "-")}.png`;
        a.click();
        toast.success("QR code downloaded");
        return;
      }
      const res = await fetch(`/api/assets/${type}/${encodeURIComponent(id)}/qr?size=512`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asset-qr-${label.replace(/\s+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("QR code downloaded");
    } catch {
      toast.error("Failed to download QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR code
          </DialogTitle>
          <DialogDescription>
            Scan to open asset details on any device. Print and stick on the asset if needed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-64 h-64 rounded-lg border bg-white flex items-center justify-center">
            {qrLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!qrLoading && (qrDataUrl || qrBlobUrl) && <img src={qrDataUrl || qrBlobUrl!} alt="Asset QR code" className="w-full h-full object-contain rounded-lg" />}
            {!qrLoading && !qrDataUrl && !qrBlobUrl && <div className="text-sm text-muted-foreground">No preview</div>}
          </div>
          <Button variant="outline" className="w-full" onClick={handleDownload} disabled={qrLoading}>
            <Download className="h-4 w-4 mr-2" />
            Download PNG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Delete Confirmation Dialog
function DeleteConfirmDialog({ open, onClose, onConfirm, itemName, type }: { open: boolean; onClose: () => void; onConfirm: () => void; itemName: string; type?: string }) {
  const consequence = type === "stock"
    ? "This will permanently remove the stock item from inventory. Assigned units will not be automatically unassigned."
    : type === "system"
      ? "This assignment will be removed and the unit will return to available stock (if it was assigned from stock)."
      : type === "invoice"
        ? "This invoice record will be permanently removed from asset management."
        : "This action cannot be undone. This will permanently delete this item from the system.";
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ==================== MAIN COMPONENT ====================

export default function Assets() {
  const { isAdmin, isHR, isIT } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [stockDialog, setStockDialog] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [stockDetailSheet, setStockDetailSheet] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [stockAssignedDrawer, setStockAssignedDrawer] = useState<{ open: boolean; item?: StockItem | null }>({ open: false, item: null });
  const [assignFromStockOpen, setAssignFromStockOpen] = useState(false);
  const [systemDialog, setSystemDialog] = useState<{ open: boolean; item?: AssignedSystem }>({ open: false });
  const [invoiceDialog, setInvoiceDialog] = useState<{ open: boolean; item?: Invoice }>({ open: false });
  const [, setLocation] = useLocation();
  const [stockPage, setStockPage] = useState(0);
  const [systemsPage, setSystemsPage] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(0);
  const STOCK_PAGE_SIZE = 20;
  const SYSTEMS_PAGE_SIZE = 20;
  const INVOICES_PAGE_SIZE = 15;
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string; name: string }>({ open: false, type: "", id: "", name: "" });
  const [qrDialog, setQrDialog] = useState<{ open: boolean; type: "stock" | "system"; id: string; label: string; publicId?: string }>({ open: false, type: "stock", id: "", label: "" });

  const canManageAssets = isAdmin || isHR;
  const canManageInvoices = isAdmin || isHR || isIT;

  // ==================== DATA FETCHING WITH REACT QUERY ====================
  
  const { data: stockData = [], isLoading: stockLoading } = useQuery({
    queryKey: ["/api/assets/stock"],
    select: (data: any[]) => data.map(transformStockItem),
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ["/api/assets/systems"],
    select: (data: any[]) => data.map(transformSystem),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["/api/assets/tickets"],
    select: (data: any[]) => data.map(transformTicket),
  });

  const { data: invoicesData = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/assets/invoices"],
    select: (data: any[]) => data.map(transformInvoice),
  });

  const isLoading = stockLoading || systemsLoading || ticketsLoading || invoicesLoading;

  // ==================== MUTATIONS ====================

  // Stock mutations
  const stockMutation = useMutation({
    mutationFn: async (item: StockItem) => {
      const isUpdate = item.id && !item.id.startsWith('temp-');
      const payload = {
        name: item.name,
        category: item.category,
        productType: item.productType,
        quantity: item.quantity,
        available: item.available,
        description: item.description,
        location: item.location,
        specs: item.specs,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/stock/${item.id}` : "/api/assets/stock",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/stock"] });
    },
  });

  // System mutations
  const systemMutation = useMutation({
    mutationFn: async (item: AssignedSystem) => {
      const isUpdate = item.id && !item.id.startsWith('temp-');
      const payload = {
        assetId: item.assetId,
        userId: item.userId || null,
        userName: item.userName,
        userEmail: item.userEmail,
        ram: item.ram,
        storage: item.storage,
        processor: item.processor,
        generation: item.generation,
        notes: item.notes,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/systems/${item.id}` : "/api/assets/systems",
        payload
      );
      return { data: await res.json(), userId: item.userId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/systems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets/stock"] });
      // Refresh employee profile asset section
      if (result.userId) {
        queryClient.invalidateQueries({ queryKey: ["/api/assets/systems/user", result.userId] });
        window.dispatchEvent(new CustomEvent("employee-updated", { detail: { employeeId: result.userId } }));
      }
    },
  });

  // Ticket status mutation
  const ticketMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/assets/tickets/${ticketId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/tickets"] });
    },
  });

  // Invoice mutation
  const invoiceMutation = useMutation({
    mutationFn: async (inv: Invoice) => {
      const isUpdate = inv.id && !inv.id.startsWith("temp-");
      const payload = {
        invoice_number: inv.invoiceNumber,
        vendor: inv.vendor,
        purchase_date: typeof inv.purchaseDate === "string" ? inv.purchaseDate : new Date(inv.purchaseDate).toISOString(),
        total_amount: Number(inv.totalAmount) ?? 0,
        items: inv.items,
        status: inv.status,
        notes: inv.notes ?? null,
        file_name: inv.fileName ?? null,
        file_type: inv.fileType ?? null,
        file_path: inv.filePath ?? null,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/invoices/${inv.id}` : "/api/assets/invoices",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/invoices"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      // Capture userId before deleting so we can invalidate employee queries
      let userId: string | undefined;
      if (type === "system") {
        const sys = systems.find((s) => s.id === id);
        userId = sys?.userId;
      }
      const endpoints: Record<string, string> = {
        stock: `/api/assets/stock/${id}`,
        system: `/api/assets/systems/${id}`,
        ticket: `/api/assets/tickets/${id}`,
        invoice: `/api/assets/invoices/${id}`,
      };
      await apiRequest("DELETE", endpoints[type]);
      return { userId };
    },
    onSuccess: (result, { type }) => {
      const queryKeys: Record<string, string> = {
        stock: "/api/assets/stock",
        system: "/api/assets/systems",
        ticket: "/api/assets/tickets",
        invoice: "/api/assets/invoices",
      };
      queryClient.invalidateQueries({ queryKey: [queryKeys[type]] });
      // When a system is deleted/unassigned, refresh stock and employee profile
      if (type === "system") {
        queryClient.invalidateQueries({ queryKey: ["/api/assets/stock"] });
        if (result.userId) {
          queryClient.invalidateQueries({ queryKey: ["/api/assets/systems/user", result.userId] });
          window.dispatchEvent(new CustomEvent("employee-updated", { detail: { employeeId: result.userId } }));
        }
      }
    },
  });

  // Statistics
  const stats = {
    totalSystems: systems.length,
    totalStockItems: stockData.reduce((sum, item) => sum + item.quantity, 0),
    outOfStock: stockData.filter(item => item.available === 0).length,
    openTickets: tickets.filter(t => t.status === "open").length,
    criticalTickets: tickets.filter(t => t.priority === "critical" && t.status !== "resolved").length,
  };

  // ==================== CRUD HANDLERS ====================
  
  const handleSaveStock = (item: StockItem) => {
    stockMutation.mutate(item, {
      onSuccess: () => toast.success(item.id && !item.id.startsWith('temp-') ? "Stock item updated" : "Stock item added"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  const handleAssignFromStockSuccess = async (employeeId?: string) => {
    // Force refetch (not just invalidate) so data is immediately fresh
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/assets/stock"] }),
      queryClient.refetchQueries({ queryKey: ["/api/assets/systems"] }),
    ]);
    if (employeeId) {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/systems/user", employeeId] });
    }
  };

  const handleSaveSystem = (item: AssignedSystem) => {
    systemMutation.mutate(item, {
      onSuccess: () => toast.success("System updated"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  const handleDelete = () => {
    const { type, id } = deleteDialog;
    deleteMutation.mutate({ type, id }, {
      onSuccess: () => {
        toast.success("Item deleted successfully");
        setDeleteDialog({ open: false, type: "", id: "", name: "" });
      },
      onError: (err) => toast.error(`Failed to delete: ${err.message}`),
    });
  };

  const handleUpdateTicketStatus = (ticketId: string, newStatus: string) => {
    ticketMutation.mutate({ ticketId, status: newStatus }, {
      onSuccess: () => toast.success("Ticket status updated"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  const handleSaveInvoice = (inv: Invoice) => {
    invoiceMutation.mutate(inv, {
      onSuccess: () => toast.success(inv.id ? "Invoice updated" : "Invoice added"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  // Export handlers
  const handleExportStock = () => {
    const headers = ["Item Name", "Category", "Product Type", "Specs", "Total Qty", "Available", "Location"];
    const rows = stockData.map(item => [
      item.name,
      item.category,
      item.productType || "-",
      item.specs && Object.keys(item.specs).length > 0 ? Object.entries(item.specs).map(([k, v]) => `${k}: ${v}`).join("; ") : "-",
      item.quantity,
      item.available,
      item.location
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Stock report exported");
  };

  const handleExportSystems = () => {
    const headers = ["Asset ID", "User", "Email", "RAM", "Storage", "Processor", "Generation"];
    const rows = systems.map(s => [s.assetId, s.userName, s.userEmail, s.ram, s.storage, s.processor, s.generation]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `assigned_systems_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Systems report exported");
  };

  // Loading state
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading asset data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Dialogs */}
      <StockDialog open={stockDialog.open} item={stockDialog.item} onSave={handleSaveStock} onClose={() => setStockDialog({ open: false })} />
      <StockDetailSheet open={stockDetailSheet.open} item={stockDetailSheet.item} onClose={() => setStockDetailSheet({ open: false })} onEdit={(item) => setStockDialog({ open: true, item })} onShowQr={(type, id, label, publicId) => setQrDialog({ open: true, type, id, label, publicId })} />
      <StockAssignedDrawer item={stockAssignedDrawer.item} open={stockAssignedDrawer.open} onClose={() => setStockAssignedDrawer({ open: false, item: null })} />
      <AssignFromStockDialog
        open={assignFromStockOpen}
        onClose={() => setAssignFromStockOpen(false)}
        onSuccess={handleAssignFromStockSuccess}
        stockItems={stockData}
      />
      <SystemDialog open={systemDialog.open} item={systemDialog.item} onSave={handleSaveSystem} onClose={() => setSystemDialog({ open: false })} />
      <InvoiceDialog open={invoiceDialog.open} item={invoiceDialog.item} onSave={handleSaveInvoice} onClose={() => setInvoiceDialog({ open: false })} />
      <DeleteConfirmDialog open={deleteDialog.open} itemName={deleteDialog.name} type={deleteDialog.type} onClose={() => setDeleteDialog({ open: false, type: "", id: "", name: "" })} onConfirm={handleDelete} />
      <QRCodeDialog open={qrDialog.open} onClose={() => setQrDialog({ open: false, type: "stock", id: "", label: "" })} type={qrDialog.type} id={qrDialog.id} label={qrDialog.label} publicId={qrDialog.publicId} />

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">IT Asset Management</h1>
          <p className="text-muted-foreground text-sm">Inventory, stock and assigned asset tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Scan feature coming soon")}>
            <Camera className="h-4 w-4 mr-2" /> Scan
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Import feature coming soon")}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="gap-2 text-xs md:text-sm"><Layers className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="stock" className="gap-2 text-xs md:text-sm"><Package className="h-4 w-4" /> Stock {stats.outOfStock > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1">{stats.outOfStock}</Badge>}</TabsTrigger>
          <TabsTrigger value="systems" className="gap-2 text-xs md:text-sm"><Laptop className="h-4 w-4" /> Assigned Assets</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2 text-xs md:text-sm"><TicketIcon className="h-4 w-4" /> Tickets {stats.openTickets > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1">{stats.openTickets}</Badge>}</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2 text-xs md:text-sm"><FileText className="h-4 w-4" /> Invoices</TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Laptop className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.totalSystems}</p><p className="text-xs text-muted-foreground">Assigned (systems & peripherals)</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><Package className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.totalStockItems}</p><p className="text-xs text-muted-foreground">Stock Items</p></div></div></CardContent></Card>
            <Card className={stats.outOfStock > 0 ? "border-red-300 bg-red-50 dark:bg-red-900/10" : ""}><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><PackageX className="h-5 w-5 text-red-600" /></div><div><p className="text-2xl font-bold">{stats.outOfStock}</p><p className="text-xs text-muted-foreground">Out of Stock</p></div></div></CardContent></Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" />Stock Alerts</CardTitle></CardHeader><CardContent><div className="space-y-2">{stockData.filter(item => item.available === 0).map(item => (<div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-muted-foreground">Available: {item.available}</p></div><Badge variant="outline" className="text-red-600 border-red-300">Out of stock</Badge></div>))}{stockData.filter(item => item.available === 0).length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">All items in stock</p>)}</div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="h-5 w-5 text-blue-500" />Recent Assignments</CardTitle></CardHeader><CardContent><div className="space-y-2">{systems.slice(-5).reverse().map(system => {
              const isPeripheral = system.assetId?.startsWith("PERIPH");
              const label = isPeripheral && system.notes ? system.notes.split(" | ")[0]?.trim() : `${system.processor || ""} ${system.generation || ""} | ${system.ram || ""}`.trim() || "Asset";
              return (
              <div key={system.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{system.userName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium text-sm">{system.userName}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
                {system.createdAt && <span className="text-xs text-muted-foreground">{formatDate(system.createdAt)}</span>}
              </div>
            ); })}</div></CardContent></Card>
          </div>
        </TabsContent>

        {/* ==================== STOCK TAB (Card layout — specs like Brand, Model visible) ==================== */}
        <TabsContent value="stock" className="space-y-4">
          <p className="text-sm text-muted-foreground">Inventory quantities. Brand, model and other specs are shown on each card. Assignments are tracked under Assigned Assets.</p>
          <p className="text-xs text-muted-foreground">Tip: Use one stock item per model or pool (e.g. &quot;Dell Latitude&quot;). Record each unit&apos;s specs (RAM, processor, storage) when assigning so variants (i5/i7, 8GB/16GB, etc.) are tracked per assigned asset.</p>
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search stock items..." className="pl-9" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setStockPage(0); }} aria-label="Search stock items" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportStock}><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button onClick={() => setStockDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </div>
          </div>
          <div className="space-y-4">
            {(() => {
              const filtered = stockData.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
              const paginated = filtered.slice(stockPage * STOCK_PAGE_SIZE, (stockPage + 1) * STOCK_PAGE_SIZE);
              if (filtered.length === 0) {
                return (
                  <Card className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mb-3 opacity-50" />
                    <p className="font-medium">No stock items yet</p>
                    <p className="text-sm mt-1 text-center px-4">Add items to track inventory quantities. Stock is inventory only; assignments appear under Assigned Assets.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStockDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add first item</Button>
                  </Card>
                );
              }
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {paginated.map(item => {
                      const assignments = (item as StockItem & { assignments?: StockAssignment[] }).assignments || [];
                      const assignedCount = assignments.length;
                      const specEntries = item.specs && typeof item.specs === "object" && Object.keys(item.specs).length > 0
                        ? (Object.entries(item.specs) as [string, string | number][]).filter(([, v]) => v !== "" && v != null)
                        : [];
                      const specLabel = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^\w/, (c) => c.toUpperCase()).trim();
                      return (
                        <Card
                          key={item.id}
                          className={`cursor-pointer hover:shadow-md transition-all overflow-hidden ${item.available === 0 ? "border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800" : ""}`}
                          onClick={() => setStockDetailSheet({ open: true, item })}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setStockDetailSheet({ open: true, item }); } }}
                        >
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate" title={item.name}>{item.name}</h3>
                                <Badge variant="outline" className="mt-1.5 text-xs font-normal">{item.category}</Badge>
                              </div>
                              <div onClick={(e) => e.stopPropagation()} className="flex gap-0.5 shrink-0">
                                {item.assetId && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`QR code for ${item.name}`} onClick={() => setQrDialog({ open: true, type: "stock", id: item.id, label: item.assetId || item.name, publicId: item.assetId ?? undefined })}><QrCode className="h-4 w-4" /></Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${item.name}`} onClick={() => setStockDialog({ open: true, item })}><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Delete ${item.name}`} onClick={() => setDeleteDialog({ open: true, type: "stock", id: item.id, name: item.name })}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>
                            {specEntries.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {specEntries.map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                    <span className="text-foreground/80">{specLabel(k)}:</span>&nbsp;<span className="text-foreground">{String(v)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2" title={item.description}>{item.description}</p>
                            )}
                            <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-sm">
                              <span className="font-mono"><span className="text-muted-foreground">Total</span> {item.quantity}</span>
                              <span className="font-mono font-medium text-green-600 dark:text-green-400"><span className="text-muted-foreground">Available</span> {item.available}</span>
                              <span onClick={(e) => { e.stopPropagation(); if (assignedCount > 0) setStockAssignedDrawer({ open: true, item }); }} className={assignedCount > 0 ? "font-mono text-blue-600 hover:underline cursor-pointer" : "font-mono text-muted-foreground"}>
                                <span className="text-muted-foreground">Assigned</span> {assignedCount}
                              </span>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  {filtered.length > STOCK_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-1 py-2">
                      <p className="text-sm text-muted-foreground">
                        Page {stockPage + 1} of {Math.ceil(filtered.length / STOCK_PAGE_SIZE)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={stockPage === 0} onClick={() => setStockPage(p => Math.max(0, p - 1))}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={stockPage >= Math.ceil(filtered.length / STOCK_PAGE_SIZE) - 1} onClick={() => setStockPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </TabsContent>

        {/* ==================== ASSIGNED ASSETS TAB (physical assets assigned to people) ==================== */}
        <TabsContent value="systems" className="space-y-4">
          <p className="text-sm text-muted-foreground">Systems and peripherals assigned to employees. Each row is one asset.</p>
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, processor, asset..." className="pl-9" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setSystemsPage(0); }} aria-label="Search assigned assets" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportSystems}><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button onClick={() => setAssignFromStockOpen(true)}><Plus className="h-4 w-4 mr-2" /> Assign from stock</Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Asset</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead>Processor</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const filtered = systems.filter(s => {
                    const term = searchTerm.toLowerCase();
                    const notes = (s.notes || "").toLowerCase();
                    const assetLabel = (s.assetCategory || s.assetName || (s.assetId?.startsWith("PERIPH") && s.notes ? s.notes.split(" | ")[0] : "") || "").toLowerCase();
                    return s.userName.toLowerCase().includes(term) || (s.processor ?? "").toLowerCase().includes(term) || (s.assetName || "").toLowerCase().includes(term) || (s.assetId ?? "").toLowerCase().includes(term) || notes.includes(term) || assetLabel.includes(term);
                  });
                  const paginated = filtered.slice(systemsPage * SYSTEMS_PAGE_SIZE, (systemsPage + 1) * SYSTEMS_PAGE_SIZE);
                  if (filtered.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          <Laptop className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No assigned assets</p>
                          <p className="text-sm mt-1">Assign from stock to give equipment to employees. Stock items are in the Stock tab.</p>
                          <Button variant="outline" className="mt-4" onClick={() => setAssignFromStockOpen(true)}><Plus className="h-4 w-4 mr-2" /> Assign from stock</Button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                    return paginated.map(system => {
                    const isPeripheral = system.assetId?.startsWith("PERIPH");
                    const peripheralLabel = isPeripheral && system.notes ? system.notes.split(" | ")[0]?.trim() : null;
                    const assetType = system.assetCategory || system.assetName || peripheralLabel || "Asset";
                    const sourceStock = system.assetId?.includes("-")
                      ? (system.assetId.startsWith("PERIPH") ? "Peripheral" : system.assetId.split("-")[0])
                      : null;
                    return (
                      <TableRow
                        key={system.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setLocation(`/assets/${system.id}`)}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLocation(`/assets/${system.id}`); } }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <AssignedAssetIcon system={system} />
                            <div>
                              <p className="font-medium text-sm">{assetType}</p>
                              <p className="text-xs text-muted-foreground font-mono">Asset ID: {system.assetId}</p>
                              {sourceStock && <p className="text-xs text-muted-foreground">From stock: {sourceStock}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{system.userName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium text-sm">{system.userName}</p>
                              <p className="text-xs text-muted-foreground">{system.employeeId || system.userEmail || "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isPeripheral ? (
                            <Badge variant="secondary" className="text-xs font-normal">Peripheral</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {system.ram && <Badge variant="outline" className="text-xs font-normal"><MemoryStick className="h-3 w-3 mr-1" />{system.ram}</Badge>}
                              {system.storage && <Badge variant="outline" className="text-xs font-normal"><HardDrive className="h-3 w-3 mr-1" />{system.storage}</Badge>}
                              {!system.ram && !system.storage && <span className="text-muted-foreground text-xs">—</span>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isPeripheral ? (
                              <span className="text-muted-foreground text-sm">—</span>
                            ) : (
                              <>
                                <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{system.processor || "—"}</span>
                                {system.generation && <span className="text-muted-foreground text-sm">{system.generation}</span>}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`QR code for ${system.assetId}`} onClick={() => setQrDialog({ open: true, type: "system", id: system.assetId, label: system.assetId || system.userName, publicId: system.assetId })}><QrCode className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${system.assetId}`} onClick={() => setSystemDialog({ open: true, item: system })}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Delete assignment`} onClick={() => setDeleteDialog({ open: true, type: "system", id: system.id, name: system.assetId || system.userName })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
            {systems.filter(s => {
              const term = searchTerm.toLowerCase();
              return s.userName.toLowerCase().includes(term) || (s.processor ?? "").toLowerCase().includes(term) || (s.assetName || "").toLowerCase().includes(term) || (s.assetId ?? "").toLowerCase().includes(term);
            }).length > SYSTEMS_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Page {systemsPage + 1} of {Math.ceil(systems.filter(s => {
                    const term = searchTerm.toLowerCase();
                    return s.userName.toLowerCase().includes(term) || (s.processor ?? "").toLowerCase().includes(term) || (s.assetName || "").toLowerCase().includes(term) || (s.assetId ?? "").toLowerCase().includes(term);
                  }).length / SYSTEMS_PAGE_SIZE)}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={systemsPage === 0} onClick={() => setSystemsPage(p => Math.max(0, p - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={systemsPage >= Math.ceil(systems.filter(s => {
                    const term = searchTerm.toLowerCase();
                    return s.userName.toLowerCase().includes(term) || (s.processor ?? "").toLowerCase().includes(term) || (s.assetName || "").toLowerCase().includes(term) || (s.assetId ?? "").toLowerCase().includes(term);
                  }).length / SYSTEMS_PAGE_SIZE) - 1} onClick={() => setSystemsPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ==================== TICKETS TAB ==================== */}
        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div><CardTitle className="text-base flex items-center gap-2"><TicketIcon className="h-5 w-5" />Support Tickets{stats.openTickets > 0 && <Badge variant="destructive">{stats.openTickets} Open</Badge>}</CardTitle><CardDescription>Manage IT support requests from employees</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map(ticket => {
                    const priorityBadge = getPriorityBadge(ticket.priority);
                    const statusBadge = getTicketStatusBadge(ticket.status);
                    return (
                      <TableRow key={ticket.id} className={ticket.priority === "critical" ? "bg-red-50 dark:bg-red-900/10" : ""}>
                        <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground">{ticket.assetName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {ticket.createdBy.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm">{ticket.createdBy.name}</p>
                              <p className="text-xs text-muted-foreground">{ticket.createdBy.department}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorityBadge.className}>
                            {priorityBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(ticket.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <TicketDetailDialog 
                            ticket={ticket} 
                            onStatusChange={handleUpdateTicketStatus}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== INVOICES TAB ==================== */}
        <TabsContent value="invoices" className="space-y-4">
          <p className="text-sm text-muted-foreground">Purchase invoices for asset/IT procurement. Record vendor, amount, and items for audit and tracking.</p>
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, vendor..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setInvoicesPage(0); }}
                aria-label="Search invoices"
              />
            </div>
            {canManageInvoices && (
              <Button onClick={() => setInvoiceDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add Invoice</Button>
            )}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Purchase date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[90px]">PDF</TableHead>
                  {canManageInvoices && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const term = searchTerm.toLowerCase().trim();
                  const filtered = term
                    ? invoicesData.filter(
                        (inv) =>
                          (inv.invoiceNumber || "").toLowerCase().includes(term) ||
                          (inv.vendor || "").toLowerCase().includes(term) ||
                          (inv.items || "").toLowerCase().includes(term)
                      )
                    : invoicesData;
                  const paginated = filtered.slice(invoicesPage * INVOICES_PAGE_SIZE, (invoicesPage + 1) * INVOICES_PAGE_SIZE);
                  if (filtered.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={canManageInvoices ? 7 : 6} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No invoices yet</p>
                          <p className="text-sm mt-1">Add purchase invoices to track asset procurement.</p>
                          {canManageInvoices && (
                            <Button variant="outline" className="mt-4" onClick={() => setInvoiceDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add first invoice</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  const statusLabels: Record<string, string> = { pending: "Pending", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" };
                  const openPdf = async (invoiceId: string) => {
                    try {
                      const res = await apiRequest("GET", `/api/assets/invoices/${invoiceId}/file`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank", "noopener");
                      setTimeout(() => URL.revokeObjectURL(url), 60000);
                    } catch {
                      toast.error("Failed to open PDF");
                    }
                  };
                  return paginated.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.vendor}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.purchaseDate)}</TableCell>
                      <TableCell className="text-right font-mono">{typeof inv.totalAmount === "number" ? inv.totalAmount.toFixed(2) : inv.totalAmount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">{statusLabels[inv.status] ?? inv.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {(inv.fileName || inv.filePath) ? (
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => openPdf(inv.id)}>
                            <FileText className="h-3 w-3" /> View PDF
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canManageInvoices && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${inv.invoiceNumber}`} onClick={() => setInvoiceDialog({ open: true, item: inv })}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" aria-label={`Delete ${inv.invoiceNumber}`} onClick={() => setDeleteDialog({ open: true, type: "invoice", id: inv.id, name: inv.invoiceNumber })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
            {(() => {
              const term = searchTerm.toLowerCase().trim();
              const filtered = term ? invoicesData.filter((inv) => (inv.invoiceNumber || "").toLowerCase().includes(term) || (inv.vendor || "").toLowerCase().includes(term) || (inv.items || "").toLowerCase().includes(term)) : invoicesData;
              if (filtered.length <= INVOICES_PAGE_SIZE) return null;
              return (
                <div className="flex items-center justify-between border-t px-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Page {invoicesPage + 1} of {Math.ceil(filtered.length / INVOICES_PAGE_SIZE)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={invoicesPage === 0} onClick={() => setInvoicesPage((p) => Math.max(0, p - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={invoicesPage >= Math.ceil(filtered.length / INVOICES_PAGE_SIZE) - 1} onClick={() => setInvoicesPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              );
            })()}
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
