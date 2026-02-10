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
  ShoppingCart, TrendingUp, AlertCircle, PackageCheck, PackageX, Layers,
  Receipt, Truck, Store, CircleDollarSign, Hash, CalendarDays, Save, X,
  FileText, Paperclip, ExternalLink, Image, File, FilePlus
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { Link } from "wouter";
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
import { AssetDetailModal, type AssetData } from "@/components/AssetCard";

// ==================== TYPE DEFINITIONS ====================

interface StockItem {
  id: string;
  name: string;
  category: string;
  productType?: string;
  quantity: number;
  available: number;
  faulty: number;
  description: string;
  minStock: number;
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
  status: "assigned" | "home" | "repair";
  assignedDate?: string;
  notes?: string;
  employeeId?: string;
  assetName?: string;
  assetCategory?: string;
  department?: string;
}

interface ProcurementItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vendor: string;
  purchaseDate: string;
  status: "received" | "pending" | "partial";
  assignedTo?: string;
  notes?: string;
}

interface ReceivedItem {
  id: string;
  itemName: string;
  quantity: number;
  receivedDate: string;
  category: string;
  notes?: string;
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
  totalAmount: number;
  items: string;
  fileName?: string;
  fileType?: string;
  fileData?: string; // Base64 encoded file data
  status: "pending" | "paid" | "overdue";
  notes?: string;
}

// ==================== API DATA TRANSFORMERS ====================

// Transform snake_case API response to camelCase frontend types
interface StockAssignment {
  id: string;
  assetId: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  assignedDate?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
}

const transformStockItem = (item: any): StockItem & { assignments?: StockAssignment[] } => {
  const base: StockItem = {
    id: item.id,
    name: item.name,
    category: item.category,
    productType: item.product_type,
    quantity: item.quantity,
    available: item.available,
    faulty: item.faulty,
    description: item.description || "",
    minStock: item.min_stock,
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
    assignedDate: a.assigned_date,
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
  status: item.status,
  assignedDate: item.assigned_date,
  notes: item.notes,
  employeeId: item.employee_id || undefined,
  assetName: item.asset_name || undefined,
  assetCategory: item.asset_category || undefined,
  department: item.department || undefined,
});

const transformProcurement = (item: any): ProcurementItem => ({
  id: item.id,
  itemName: item.item_name,
  quantity: item.quantity,
  unitPrice: parseFloat(item.unit_price) || 0,
  totalPrice: parseFloat(item.total_price) || 0,
  vendor: item.vendor,
  purchaseDate: item.purchase_date,
  status: item.status,
  assignedTo: item.assigned_to,
  notes: item.notes,
});

const transformReceived = (item: any): ReceivedItem => ({
  id: item.id,
  itemName: item.item_name,
  quantity: item.quantity,
  receivedDate: item.received_date,
  category: item.category,
  notes: item.notes,
});

const transformInvoice = (item: any): Invoice => ({
  id: item.id,
  invoiceNumber: item.invoice_number,
  vendor: item.vendor,
  purchaseDate: item.purchase_date,
  totalAmount: parseFloat(item.total_amount) || 0,
  items: item.items,
  fileName: item.file_name,
  fileType: item.file_type,
  fileData: item.file_data,
  status: item.status,
  notes: item.notes,
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

const getStockStatus = (item: StockItem) => {
  if (item.available === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-300" };
  if (item.available < item.minStock) return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700 border-yellow-300" };
  if (item.faulty > 0) return { label: "Has Faulty", color: "bg-orange-100 text-orange-700 border-orange-300" };
  return { label: "In Stock", color: "bg-green-100 text-green-700 border-green-300" };
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
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

const getInvoiceStatusBadge = (status: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
    paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-300" },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-300" }
  };
  return configs[status] || configs.pending;
};

const generateId = () => `temp-${Date.now().toString()}`;
const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

// ==================== DIALOG COMPONENTS ====================

// Add/Edit Stock Dialog - with product-type-specific specs
function StockDialog({ item, onSave, onClose, open }: { item?: StockItem; onSave: (item: StockItem) => void; onClose: () => void; open: boolean }) {
  const defaultForm: Partial<StockItem> = {
    name: "", category: "Systems", productType: "laptop", quantity: 0, available: 0, faulty: 0,
    description: "", minStock: 5, location: "IT Storage", specs: {}
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
      faulty: Number(formData.faulty) || 0,
      description: formData.description || "",
      minStock: Number(formData.minStock) || 5,
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
            <div className="space-y-2">
              <Label>Faulty</Label>
              <Input type="number" min={0} value={formData.faulty ?? 0} onChange={(e) => setFormData({ ...formData, faulty: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Min Stock Alert</Label>
              <Input type="number" min={0} value={formData.minStock ?? 5} onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 5 })} />
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

// Stock Item Detail Dialog - view description and full details
function StockDetailDialog({ item, onClose, open, onEdit }: { item?: StockItem; onClose: () => void; open: boolean; onEdit: (item: StockItem) => void }) {
  if (!item) return null;
  const specEntries = item.specs && Object.keys(item.specs).length > 0
    ? Object.entries(item.specs)
    : [];
  const status = item.available === 0 ? "Out of Stock" : item.available < item.minStock ? "Low Stock" : "In Stock";
  const statusColor = item.available === 0 ? "bg-red-100 text-red-700" : item.available < item.minStock ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700";
  const assignments = (item as StockItem & { assignments?: StockAssignment[] }).assignments || [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {item.name}
          </DialogTitle>
          <DialogDescription>Stock item details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Category</span><p className="font-medium">{item.category}</p></div>
            {item.productType && <div><span className="text-muted-foreground">Product Type</span><p className="font-medium capitalize">{item.productType}</p></div>}
            <div><span className="text-muted-foreground">Total</span><p className="font-mono font-medium">{item.quantity}</p></div>
            <div><span className="text-muted-foreground">Available</span><p className="font-mono font-medium text-green-600">{item.available}</p></div>
            <div><span className="text-muted-foreground">Faulty</span><p className="font-mono font-medium text-orange-600">{item.faulty}</p></div>
            <div><span className="text-muted-foreground">Min Stock</span><p className="font-mono">{item.minStock}</p></div>
            <div><span className="text-muted-foreground">Location</span><p className="font-medium">{item.location || "-"}</p></div>
            <div><span className="text-muted-foreground">Status</span><p><Badge variant="outline" className={statusColor}>{status}</Badge></p></div>
          </div>
          {specEntries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Specifications</p>
              <div className="flex flex-wrap gap-2">
                {specEntries.map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-normal">{k}: {v}</Badge>
                ))}
              </div>
            </div>
          )}
          {assignments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Assigned To ({assignments.length})</p>
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{a.userName?.split(" ").map((n: string) => n[0]).join("") || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{a.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.employeeId || "—"}{a.assignedDate ? ` · ${formatDate(a.assignedDate)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
            <p className="text-sm bg-muted/50 rounded-lg p-3 min-h-[60px] whitespace-pre-wrap">{item.description || "No description added."}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => { onClose(); onEdit(item); }}><Edit2 className="h-4 w-4 mr-2" /> Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <DialogTitle>Assign System from Stock</DialogTitle>
          <DialogDescription>
            Select an available stock item and the employee to assign it to.
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!stockItemId || !employeeId || loading}>
              {loading ? "Assigning..." : "Assign System"}
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
    userName: "", userEmail: "", ram: "16 GB", storage: "256 GB", processor: "i5", generation: "8th Gen", status: "assigned", assignedDate: new Date().toISOString()
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
      status: (formData.status as "assigned" | "home" | "repair") || "assigned",
      assignedDate: formData.assignedDate,
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as "assigned" | "home" | "repair" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned">Assigned (Office)</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="repair">In Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned Date</Label>
              <Input type="date" value={formatDateForInput(formData.assignedDate)} onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })} />
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

// Add/Edit Procurement Dialog
function ProcurementDialog({ item, onSave, onClose, open }: { item?: ProcurementItem; onSave: (item: ProcurementItem) => void; onClose: () => void; open: boolean }) {
  const [formData, setFormData] = useState<Partial<ProcurementItem>>(item || {
    itemName: "", quantity: 1, unitPrice: 0, vendor: "", purchaseDate: new Date().toISOString(), status: "pending", assignedTo: ""
  });

  // Update form data when item changes (for editing different rows)
  useEffect(() => {
    if (open) {
      setFormData(item || {
        itemName: "", quantity: 1, unitPrice: 0, vendor: "", purchaseDate: new Date().toISOString(), status: "pending", assignedTo: ""
      });
    }
  }, [item, open]);

  const totalPrice = (Number(formData.quantity) || 0) * (Number(formData.unitPrice) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName) { toast.error("Item name is required"); return; }
    if (!formData.vendor) { toast.error("Vendor is required"); return; }
    onSave({
      id: item?.id || generateId(),
      itemName: formData.itemName || "",
      quantity: Number(formData.quantity) || 1,
      unitPrice: Number(formData.unitPrice) || 0,
      totalPrice: totalPrice,
      vendor: formData.vendor || "",
      purchaseDate: formData.purchaseDate || "",
      status: (formData.status as "received" | "pending" | "partial") || "pending",
      assignedTo: formData.assignedTo,
      notes: formData.notes
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Billing Entry" : "Add Billing Entry"}</DialogTitle>
          <DialogDescription>Record procurement/purchase details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Item Name *</Label>
              <Input value={formData.itemName || ""} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} placeholder="e.g., Dell Monitor 24 inch" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={formData.quantity || 1} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Unit Price (PKR)</Label>
              <Input type="number" value={formData.unitPrice || 0} onChange={(e) => setFormData({ ...formData, unitPrice: parseInt(e.target.value) })} />
            </div>
            <div className="col-span-2 p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Amount:</span>
                <span className="font-bold text-lg">{formatCurrency(totalPrice)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Input value={formData.vendor || ""} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} placeholder="Vendor name" />
            </div>
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={formatDateForInput(formData.purchaseDate)} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as "received" | "pending" | "partial" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input value={formData.assignedTo || ""} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })} placeholder="e.g., IT Dept, John Doe" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit"><Save className="h-4 w-4 mr-2" />{item ? "Update" : "Add"} Entry</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Add/Edit Received Item Dialog
function ReceivedDialog({ item, onSave, onClose, open }: { item?: ReceivedItem; onSave: (item: ReceivedItem) => void; onClose: () => void; open: boolean }) {
  const [formData, setFormData] = useState<Partial<ReceivedItem>>(item || {
    itemName: "", quantity: 1, receivedDate: new Date().toISOString(), category: "Peripherals", notes: ""
  });

  // Update form data when item changes (for editing different rows)
  useEffect(() => {
    if (open) {
      setFormData(item || {
        itemName: "", quantity: 1, receivedDate: new Date().toISOString(), category: "Peripherals", notes: ""
      });
    }
  }, [item, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName) { toast.error("Item name is required"); return; }
    onSave({
      id: item?.id || generateId(),
      itemName: formData.itemName || "",
      quantity: Number(formData.quantity) || 1,
      receivedDate: formData.receivedDate || "",
      category: formData.category || "Peripherals",
      notes: formData.notes
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Received Item" : "Add Received Item"}</DialogTitle>
          <DialogDescription>Log items received into inventory</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input value={formData.itemName || ""} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} placeholder="e.g., USB Mouse" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={formData.quantity || 1} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Received Date</Label>
                <Input type="date" value={formatDateForInput(formData.receivedDate)} onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Peripherals">Peripherals</SelectItem>
                  <SelectItem value="Components">Components</SelectItem>
                  <SelectItem value="Network">Network</SelectItem>
                  <SelectItem value="Cables">Cables</SelectItem>
                  <SelectItem value="Supplies">Supplies</SelectItem>
                  <SelectItem value="Tools">Tools</SelectItem>
                  <SelectItem value="Electrical">Electrical</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Printer">Printer</SelectItem>
                  <SelectItem value="Systems">Systems</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional details..." />
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

// Delete Confirmation Dialog
// Add/Edit Invoice Dialog with File Upload
function InvoiceDialog({ 
  item, 
  onSave, 
  onClose, 
  open 
}: { 
  item?: Invoice; 
  onSave: (item: Invoice) => void; 
  onClose: () => void; 
  open: boolean 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Invoice>>(item || {
    invoiceNumber: generateInvoiceNumber(),
    vendor: "",
    purchaseDate: new Date().toISOString().split('T')[0],
    totalAmount: 0,
    items: "",
    status: "pending",
    notes: ""
  });
  const [fileName, setFileName] = useState(item?.fileName || "");

  // Update form data when item changes (for editing different rows)
  useEffect(() => {
    if (open) {
      setFormData(item || {
        invoiceNumber: generateInvoiceNumber(),
        vendor: "",
        purchaseDate: new Date().toISOString().split('T')[0],
        totalAmount: 0,
        items: "",
        status: "pending",
        notes: ""
      });
      setFileName(item?.fileName || "");
    }
  }, [item, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      
      // Check file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only PDF and image files are allowed");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          fileName: file.name,
          fileType: file.type,
          fileData: event.target?.result as string
        }));
        setFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setFormData(prev => ({
      ...prev,
      fileName: undefined,
      fileType: undefined,
      fileData: undefined
    }));
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (!formData.vendor || !formData.items || !formData.totalAmount) {
      toast.error("Please fill in vendor, items, and total amount");
      return;
    }
    onSave({
      id: item?.id || generateId(),
      invoiceNumber: formData.invoiceNumber || generateInvoiceNumber(),
      vendor: formData.vendor || "",
      purchaseDate: formData.purchaseDate || new Date().toISOString().split('T')[0],
      totalAmount: formData.totalAmount || 0,
      items: formData.items || "",
      fileName: formData.fileName,
      fileType: formData.fileType,
      fileData: formData.fileData,
      status: formData.status as "pending" | "paid" | "overdue" || "pending",
      notes: formData.notes || ""
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {item ? "Edit Invoice" : "Add New Invoice"}
          </DialogTitle>
          <DialogDescription>
            {item ? "Update invoice details and attached file" : "Create a new invoice record with optional file attachment"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={formData.invoiceNumber || ""}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                placeholder="INV-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={formatDateForInput(formData.purchaseDate)}
                onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                value={formData.vendor || ""}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g., TechZone Pakistan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount (PKR) *</Label>
              <Input
                id="totalAmount"
                type="number"
                value={formData.totalAmount || ""}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 150000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="items">Items Description *</Label>
            <Textarea
              id="items"
              value={formData.items || ""}
              onChange={(e) => setFormData({ ...formData, items: e.target.value })}
              placeholder="e.g., 3x 256GB SSD NVMe, 4x 8GB DDR4 RAM"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Payment Status</Label>
            <Select
              value={formData.status || "pending"}
              onValueChange={(value) => setFormData({ ...formData, status: value as "pending" | "paid" | "overdue" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label>Invoice File (PDF or Image)</Label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4">
              {fileName ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {formData.fileType?.includes('pdf') ? (
                      <File className="h-8 w-8 text-red-500" />
                    ) : (
                      <Image className="h-8 w-8 text-blue-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{fileName}</p>
                      <p className="text-xs text-slate-500">
                        {formData.fileType?.includes('pdf') ? 'PDF Document' : 'Image File'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {formData.fileData && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = formData.fileData!;
                          link.download = fileName;
                          link.click();
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500 mb-2">
                    Upload invoice file (PDF, JPG, PNG - max 5MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileChange}
                    className="hidden"
                    id="invoice-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FilePlus className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this invoice..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {item ? "Update Invoice" : "Add Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, onClose, onConfirm, itemName }: { open: boolean; onClose: () => void; onConfirm: () => void; itemName: string }) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemName}?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone. This will permanently delete this item from the system.</AlertDialogDescription>
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
  const { isAdmin, isHR } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [stockDialog, setStockDialog] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [stockDetailDialog, setStockDetailDialog] = useState<{ open: boolean; item?: StockItem }>({ open: false });
  const [assignFromStockOpen, setAssignFromStockOpen] = useState(false);
  const [systemDialog, setSystemDialog] = useState<{ open: boolean; item?: AssignedSystem }>({ open: false });
  const [systemDetailAsset, setSystemDetailAsset] = useState<AssignedSystem | null>(null);
  const [procurementDialog, setProcurementDialog] = useState<{ open: boolean; item?: ProcurementItem }>({ open: false });
  const [receivedDialog, setReceivedDialog] = useState<{ open: boolean; item?: ReceivedItem }>({ open: false });
  const [invoiceDialog, setInvoiceDialog] = useState<{ open: boolean; item?: Invoice }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string; name: string }>({ open: false, type: "", id: "", name: "" });

  const canManageAssets = isAdmin || isHR;

  // ==================== DATA FETCHING WITH REACT QUERY ====================
  
  const { data: stockData = [], isLoading: stockLoading } = useQuery({
    queryKey: ["/api/assets/stock"],
    select: (data: any[]) => data.map(transformStockItem),
  });

  const { data: systems = [], isLoading: systemsLoading } = useQuery({
    queryKey: ["/api/assets/systems"],
    select: (data: any[]) => data.map(transformSystem),
  });

  const { data: procurement = [], isLoading: procurementLoading } = useQuery({
    queryKey: ["/api/assets/procurement"],
    select: (data: any[]) => data.map(transformProcurement),
  });

  const { data: received = [], isLoading: receivedLoading } = useQuery({
    queryKey: ["/api/assets/received"],
    select: (data: any[]) => data.map(transformReceived),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/assets/invoices"],
    select: (data: any[]) => data.map(transformInvoice),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["/api/assets/tickets"],
    select: (data: any[]) => data.map(transformTicket),
  });

  const isLoading = stockLoading || systemsLoading || procurementLoading || receivedLoading || invoicesLoading || ticketsLoading;

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
        faulty: item.faulty,
        description: item.description,
        minStock: item.minStock,
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
        status: item.status,
        assignedDate: item.assignedDate,
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

  // Procurement mutations
  const procurementMutation = useMutation({
    mutationFn: async (item: ProcurementItem) => {
      const isUpdate = item.id && !item.id.startsWith('temp-');
      const payload = {
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        vendor: item.vendor,
        purchaseDate: item.purchaseDate,
        status: item.status,
        assignedTo: item.assignedTo,
        notes: item.notes,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/procurement/${item.id}` : "/api/assets/procurement",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/procurement"] });
    },
  });

  // Received mutations
  const receivedMutation = useMutation({
    mutationFn: async (item: ReceivedItem) => {
      const isUpdate = item.id && !item.id.startsWith('temp-');
      const payload = {
        itemName: item.itemName,
        quantity: item.quantity,
        receivedDate: item.receivedDate,
        category: item.category,
        notes: item.notes,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/received/${item.id}` : "/api/assets/received",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/received"] });
    },
  });

  // Invoice mutations
  const invoiceMutation = useMutation({
    mutationFn: async (item: Invoice) => {
      const isUpdate = item.id && !item.id.startsWith('temp-');
      const payload = {
        invoiceNumber: item.invoiceNumber,
        vendor: item.vendor,
        purchaseDate: item.purchaseDate,
        totalAmount: item.totalAmount,
        items: item.items,
        fileName: item.fileName,
        fileType: item.fileType,
        fileData: item.fileData,
        status: item.status,
        notes: item.notes,
      };
      const res = await apiRequest(
        isUpdate ? "PATCH" : "POST",
        isUpdate ? `/api/assets/invoices/${item.id}` : "/api/assets/invoices",
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets/invoices"] });
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
        procurement: `/api/assets/procurement/${id}`,
        received: `/api/assets/received/${id}`,
        invoice: `/api/assets/invoices/${id}`,
        ticket: `/api/assets/tickets/${id}`,
      };
      await apiRequest("DELETE", endpoints[type]);
      return { userId };
    },
    onSuccess: (result, { type }) => {
      const queryKeys: Record<string, string> = {
        stock: "/api/assets/stock",
        system: "/api/assets/systems",
        procurement: "/api/assets/procurement",
        received: "/api/assets/received",
        invoice: "/api/assets/invoices",
        ticket: "/api/assets/tickets",
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
    homeSystems: systems.filter(s => s.status === "home").length,
    totalStockItems: stockData.reduce((sum, item) => sum + item.quantity, 0),
    outOfStock: stockData.filter(item => item.available === 0).length,
    lowStock: stockData.filter(item => item.available > 0 && item.available < item.minStock).length,
    faultyItems: stockData.reduce((sum, item) => sum + item.faulty, 0),
    totalProcurement: procurement.reduce((sum, item) => sum + item.totalPrice, 0),
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

  const handleSaveProcurement = (item: ProcurementItem) => {
    procurementMutation.mutate(item, {
      onSuccess: () => toast.success(item.id && !item.id.startsWith('temp-') ? "Billing entry updated" : "Billing entry added"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  const handleSaveReceived = (item: ReceivedItem) => {
    receivedMutation.mutate(item, {
      onSuccess: () => toast.success(item.id && !item.id.startsWith('temp-') ? "Received item updated" : "Received item added"),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    });
  };

  const handleSaveInvoice = (item: Invoice) => {
    invoiceMutation.mutate(item, {
      onSuccess: () => toast.success(item.id && !item.id.startsWith('temp-') ? "Invoice updated" : "Invoice added"),
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

  // Export handlers
  const handleExportStock = () => {
    const headers = ["Item Name", "Category", "Product Type", "Specs", "Total Qty", "Available", "Faulty", "Status", "Location"];
    const rows = stockData.map(item => [
      item.name,
      item.category,
      item.productType || "-",
      item.specs && Object.keys(item.specs).length > 0 ? Object.entries(item.specs).map(([k, v]) => `${k}: ${v}`).join("; ") : "-",
      item.quantity,
      item.available,
      item.faulty,
      getStockStatus(item).label,
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
    const headers = ["Asset ID", "User", "Email", "RAM", "Storage", "Processor", "Generation", "Status", "Assigned Date"];
    const rows = systems.map(s => [s.assetId, s.userName, s.userEmail, s.ram, s.storage, s.processor, s.generation, s.status, formatDate(s.assignedDate) || ""]);
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
      <StockDetailDialog open={stockDetailDialog.open} item={stockDetailDialog.item} onClose={() => setStockDetailDialog({ open: false })} onEdit={(item) => setStockDialog({ open: true, item })} />
      <AssignFromStockDialog
        open={assignFromStockOpen}
        onClose={() => setAssignFromStockOpen(false)}
        onSuccess={handleAssignFromStockSuccess}
        stockItems={stockData}
      />
      <SystemDialog open={systemDialog.open} item={systemDialog.item} onSave={handleSaveSystem} onClose={() => setSystemDialog({ open: false })} />
      <ProcurementDialog open={procurementDialog.open} item={procurementDialog.item} onSave={handleSaveProcurement} onClose={() => setProcurementDialog({ open: false })} />
      <ReceivedDialog open={receivedDialog.open} item={receivedDialog.item} onSave={handleSaveReceived} onClose={() => setReceivedDialog({ open: false })} />
      <InvoiceDialog open={invoiceDialog.open} item={invoiceDialog.item} onSave={handleSaveInvoice} onClose={() => setInvoiceDialog({ open: false })} />
      <DeleteConfirmDialog open={deleteDialog.open} itemName={deleteDialog.name} onClose={() => setDeleteDialog({ open: false, type: "", id: "", name: "" })} onConfirm={handleDelete} />

      {/* System Detail Modal */}
      {systemDetailAsset && (
        <AssetDetailModal
          asset={{
            id: systemDetailAsset.id,
            asset_id: systemDetailAsset.assetId,
            asset_name: systemDetailAsset.assetName,
            asset_category: systemDetailAsset.assetCategory,
            user_name: systemDetailAsset.userName,
            user_email: systemDetailAsset.userEmail,
            user_id: systemDetailAsset.userId,
            employee_id: systemDetailAsset.employeeId,
            department: systemDetailAsset.department,
            ram: systemDetailAsset.ram,
            storage: systemDetailAsset.storage,
            processor: systemDetailAsset.processor,
            generation: systemDetailAsset.generation,
            status: systemDetailAsset.status,
            assigned_date: systemDetailAsset.assignedDate,
            notes: systemDetailAsset.notes,
          }}
          open={true}
          onClose={() => setSystemDetailAsset(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">IT Asset Management</h1>
          <p className="text-muted-foreground text-sm">Complete inventory, stock, procurement and system tracking</p>
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
        <TabsList className="grid grid-cols-2 md:grid-cols-7 gap-1 h-auto p-1">
          <TabsTrigger value="overview" className="gap-2 text-xs md:text-sm"><Layers className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="stock" className="gap-2 text-xs md:text-sm"><Package className="h-4 w-4" /> Stock {stats.outOfStock > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1">{stats.outOfStock}</Badge>}</TabsTrigger>
          <TabsTrigger value="systems" className="gap-2 text-xs md:text-sm"><Laptop className="h-4 w-4" /> Systems</TabsTrigger>
          <TabsTrigger value="procurement" className="gap-2 text-xs md:text-sm"><ShoppingCart className="h-4 w-4" /> Billing</TabsTrigger>
          <TabsTrigger value="received" className="gap-2 text-xs md:text-sm"><Truck className="h-4 w-4" /> Received</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2 text-xs md:text-sm"><FileText className="h-4 w-4" /> Invoices</TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2 text-xs md:text-sm"><TicketIcon className="h-4 w-4" /> Tickets {stats.openTickets > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1">{stats.openTickets}</Badge>}</TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Laptop className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{stats.totalSystems}</p><p className="text-xs text-muted-foreground">Assigned Systems</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><Package className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold">{stats.totalStockItems}</p><p className="text-xs text-muted-foreground">Stock Items</p></div></div></CardContent></Card>
            <Card className={stats.outOfStock > 0 ? "border-red-300 bg-red-50 dark:bg-red-900/10" : ""}><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><PackageX className="h-5 w-5 text-red-600" /></div><div><p className="text-2xl font-bold">{stats.outOfStock}</p><p className="text-xs text-muted-foreground">Out of Stock</p></div></div></CardContent></Card>
            <Card className={stats.lowStock > 0 ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10" : ""}><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div><div><p className="text-2xl font-bold">{stats.lowStock}</p><p className="text-xs text-muted-foreground">Low Stock</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><Wrench className="h-5 w-5 text-orange-600" /></div><div><p className="text-2xl font-bold">{stats.faultyItems}</p><p className="text-xs text-muted-foreground">Faulty Items</p></div></div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><CircleDollarSign className="h-5 w-5 text-purple-600" /></div><div><p className="text-lg font-bold">{formatCurrency(stats.totalProcurement)}</p><p className="text-xs text-muted-foreground">Total Spent</p></div></div></CardContent></Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-500" />Stock Alerts</CardTitle></CardHeader><CardContent><div className="space-y-2">{stockData.filter(item => item.available === 0 || item.available < item.minStock).map(item => { const status = getStockStatus(item); return (<div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-muted-foreground">Available: {item.available} / Min: {item.minStock}</p></div><Badge variant="outline" className={status.color}>{status.label}</Badge></div>); })}{stockData.filter(item => item.available === 0 || item.available < item.minStock).length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">All items in stock</p>)}</div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="h-5 w-5 text-blue-500" />Recent Assignments</CardTitle></CardHeader><CardContent><div className="space-y-2">{systems.filter(s => s.assignedDate).slice(-5).reverse().map(system => (<div key={system.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{system.userName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar><div><p className="font-medium text-sm">{system.userName}</p><p className="text-xs text-muted-foreground">{system.processor} {system.generation} | {system.ram}</p></div></div><span className="text-xs text-muted-foreground">{formatDate(system.assignedDate)}</span></div>))}</div></CardContent></Card>
          </div>
        </TabsContent>

        {/* ==================== STOCK TAB ==================== */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search stock items..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportStock}><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button onClick={() => setStockDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Available</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-center">Faulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockData.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                  const status = getStockStatus(item);
                  const specStr = item.specs && Object.keys(item.specs).length > 0
                    ? Object.entries(item.specs).map(([k, v]) => `${k}: ${v}`).join(" · ")
                    : "-";
                  const assignments = (item as StockItem & { assignments?: StockAssignment[] }).assignments || [];
                  const assignedCount = assignments.length;
                  return (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${item.available === 0 ? "bg-red-50 dark:bg-red-900/10" : ""}`}
                      onClick={() => setStockDetailDialog({ open: true, item })}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={specStr}>{specStr}</TableCell>
                      <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-green-600">{item.available}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {assignedCount > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="link" size="sm" className="font-mono p-0 h-auto text-blue-600 hover:text-blue-800">
                                {assignedCount} {assignedCount === 1 ? "employee" : "employees"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                              <div className="p-3 border-b">
                                <p className="text-sm font-medium">Assigned to ({assignedCount})</p>
                                <p className="text-xs text-muted-foreground">{item.name}</p>
                              </div>
                              <ScrollArea className={assignedCount > 4 ? "h-48" : ""}>
                                <div className="p-2 space-y-1">
                                  {assignments.map((a) => (
                                    <div key={a.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm">
                                      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{a.userName?.split(" ").map((n: string) => n[0]).join("") || "?"}</AvatarFallback></Avatar>
                                      <div className="min-w-0">
                                        <p className="font-medium truncate">{a.userName}</p>
                                        <p className="text-xs text-muted-foreground">{a.employeeId || "—"}{a.assignedDate ? ` · ${formatDate(a.assignedDate)}` : ""}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-orange-600">{item.faulty > 0 ? item.faulty : "-"}</TableCell>
                      <TableCell><Badge variant="outline" className={status.color}>{status.label}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{item.description || "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStockDialog({ open: true, item })}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteDialog({ open: true, type: "stock", id: item.id, name: item.name })}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== SYSTEMS TAB ==================== */}
        <TabsContent value="systems" className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, processor..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportSystems}><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button onClick={() => setAssignFromStockOpen(true)}><Plus className="h-4 w-4 mr-2" /> Assign System</Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.filter(s => {
                  const term = searchTerm.toLowerCase();
                  return s.userName.toLowerCase().includes(term) || s.processor.toLowerCase().includes(term) || (s.assetName || "").toLowerCase().includes(term);
                }).map(system => (
                  <TableRow key={system.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSystemDetailAsset(system)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-blue-600 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{system.assetName || "System"}</p>
                          <p className="text-xs text-muted-foreground">{system.assetCategory || "—"}</p>
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
                      <div className="flex flex-wrap gap-1">
                        {system.ram && <Badge variant="outline" className="text-xs"><MemoryStick className="h-3 w-3 mr-1" />{system.ram}</Badge>}
                        {system.storage && <Badge variant="outline" className="text-xs"><HardDrive className="h-3 w-3 mr-1" />{system.storage}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1"><Cpu className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{system.processor}</span><span className="text-muted-foreground text-sm">{system.generation}</span></div></TableCell>
                    <TableCell><Badge variant="outline" className={system.status === "home" ? "bg-purple-100 text-purple-700" : system.status === "repair" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}>{system.status === "home" ? "Home" : system.status === "repair" ? "Repair" : "Office"}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(system.assignedDate) || "-"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSystemDialog({ open: true, item: system })}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteDialog({ open: true, type: "system", id: system.id, name: system.userName })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== PROCUREMENT TAB ==================== */}
        <TabsContent value="procurement" className="space-y-4">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-muted-foreground">Total Procurement</p><p className="text-3xl font-bold text-purple-700">{formatCurrency(stats.totalProcurement)}</p></div>
                <Button onClick={() => setProcurementDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add Entry</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procurement.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatCurrency(item.totalPrice)}</TableCell>
                    <TableCell className="text-sm">{item.vendor}</TableCell>
                    <TableCell className="text-sm">{formatDate(item.purchaseDate)}</TableCell>
                    <TableCell><Badge variant="outline" className={item.status === "received" ? "bg-green-100 text-green-700" : item.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}>{item.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.assignedTo || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setProcurementDialog({ open: true, item })}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteDialog({ open: true, type: "procurement", id: item.id, name: item.itemName })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-right">Grand Total:</TableCell>
                  <TableCell className="text-right font-mono text-lg">{formatCurrency(stats.totalProcurement)}</TableCell>
                  <TableCell colSpan={5}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== RECEIVED ITEMS TAB ==================== */}
        <TabsContent value="received" className="space-y-4">
          <div className="flex justify-between items-center">
            <div><h3 className="text-lg font-semibold">Items Received Log</h3><p className="text-sm text-muted-foreground">Track all items received with dates</p></div>
            <Button onClick={() => setReceivedDialog({ open: true })}><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {received.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                    <TableCell><div className="flex items-center gap-1 text-sm"><CalendarDays className="h-4 w-4 text-muted-foreground" />{formatDate(item.receivedDate)}</div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.notes || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReceivedDialog({ open: true, item })}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteDialog({ open: true, type: "received", id: item.id, name: item.itemName })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ==================== INVOICES TAB ==================== */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Purchase Invoices
                  </CardTitle>
                  <CardDescription>Manage and track invoices for IT purchases</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const headers = ["Invoice #", "Vendor", "Date", "Items", "Amount", "Status", "Has File", "Notes"];
                    const rows = invoices.map(i => [i.invoiceNumber, i.vendor, i.purchaseDate, `"${i.items}"`, i.totalAmount, i.status, i.fileName ? "Yes" : "No", `"${i.notes || ""}"`]);
                    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "invoices_export.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Invoices exported");
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  {canManageAssets && (
                    <Button size="sm" onClick={() => setInvoiceDialog({ open: true })}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Invoice
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Invoice Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-slate-50 dark:bg-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Invoices</p>
                        <p className="text-lg font-bold">{invoices.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Paid</p>
                        <p className="text-lg font-bold">{invoices.filter(i => i.status === "paid").length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Pending</p>
                        <p className="text-lg font-bold">{invoices.filter(i => i.status === "pending").length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                        <CircleDollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total Value</p>
                        <p className="text-lg font-bold">{formatCurrency(invoices.reduce((sum, i) => sum + i.totalAmount, 0))}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Invoices Table */}
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File</TableHead>
                      {canManageAssets && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const statusBadge = getInvoiceStatusBadge(invoice.status);
                      return (
                        <TableRow key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-slate-400" />
                              {invoice.vendor}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-slate-400" />
                              {formatDate(invoice.purchaseDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm max-w-xs truncate block" title={invoice.items}>
                              {invoice.items}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(invoice.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusBadge.className} border`}>{statusBadge.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {invoice.fileName ? (
                              <div className="flex items-center gap-2">
                                {invoice.fileType?.includes('pdf') ? (
                                  <File className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Image className="h-4 w-4 text-blue-500" />
                                )}
                                {invoice.fileData && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = invoice.fileData!;
                                      link.download = invoice.fileName!;
                                      link.click();
                                    }}
                                    title={`Download ${invoice.fileName}`}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">No file</span>
                            )}
                          </TableCell>
                          {canManageAssets && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setInvoiceDialog({ open: true, item: invoice })} title="Edit">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => setDeleteDialog({ open: true, type: "invoice", id: invoice.id, name: invoice.invoiceNumber })} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
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
      </Tabs>
    </Layout>
  );
}
