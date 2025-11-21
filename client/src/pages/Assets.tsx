import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Laptop, Smartphone, Monitor, Search, Plus, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

const assets = [
  { id: "AST-001", name: "MacBook Pro 16\"", type: "Laptop", assignedTo: "Sarah Connor", serial: "C02XYZ123", status: "Assigned", purchaseDate: "2023-01-15" },
  { id: "AST-002", name: "Dell XPS 15", type: "Laptop", assignedTo: "Neo Anderson", serial: "DELL-998877", status: "Assigned", purchaseDate: "2023-03-10" },
  { id: "AST-003", name: "iPhone 15 Pro", type: "Mobile", assignedTo: "Morpheus King", serial: "IMEI-882211", status: "Assigned", purchaseDate: "2023-11-05" },
  { id: "AST-004", name: "LG 4K Monitor", type: "Peripheral", assignedTo: "In Stock", serial: "LG-554433", status: "Available", purchaseDate: "2022-06-20" },
  { id: "AST-005", name: "MacBook Air M2", type: "Laptop", assignedTo: "Repair", serial: "C02ABC789", status: "Maintenance", purchaseDate: "2022-09-12" },
];

export default function Assets() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Asset Management</h1>
          <p className="text-slate-500 text-sm">Track hardware inventory and assignments.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Add Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Assets</p>
            <h3 className="text-3xl font-bold text-slate-900">142</h3>
            <p className="text-xs text-slate-500 mt-2">Value: $284,500</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Assigned</p>
            <h3 className="text-3xl font-bold text-blue-600">118</h3>
            <p className="text-xs text-slate-500 mt-2">83% Utilization</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">In Maintenance</p>
            <h3 className="text-3xl font-bold text-orange-600">4</h3>
            <p className="text-xs text-slate-500 mt-2">Avg repair: 5 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search by serial, name, or user..." className="pl-9" />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {assets.map((asset) => (
              <div key={asset.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 rounded-lg text-slate-600">
                    {asset.type === 'Laptop' ? <Laptop className="h-5 w-5" /> : 
                     asset.type === 'Mobile' ? <Smartphone className="h-5 w-5" /> : 
                     <Monitor className="h-5 w-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{asset.name}</h4>
                    <p className="text-xs text-slate-500 font-mono">{asset.serial}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                   <div className="text-right min-w-[120px]">
                      <p className="text-xs text-slate-400 uppercase font-bold">Assigned To</p>
                      <p className="text-sm font-medium text-slate-900">{asset.assignedTo}</p>
                   </div>
                   <Badge className={`w-24 justify-center
                      ${asset.status === 'Assigned' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                        asset.status === 'Available' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 
                        'bg-orange-100 text-orange-700 hover:bg-orange-200'}
                    `}>
                      {asset.status}
                   </Badge>
                   <Button variant="ghost" size="sm">Details</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
