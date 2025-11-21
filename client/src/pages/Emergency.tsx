import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, AlertTriangle, Search, MapPin } from "lucide-react";

const contacts = [
  { id: 1, name: "Neo Anderson", relation: "Self", phone: "+1 (555) 0199", email: "neo@matrix.com", emergencyName: "Morpheus", emergencyRel: "Mentor", emergencyPhone: "+1 (555) 0200" },
  { id: 2, name: "Trinity Moss", relation: "Self", phone: "+1 (555) 0201", email: "trinity@matrix.com", emergencyName: "Cypher", emergencyRel: "Friend", emergencyPhone: "+1 (555) 0202" },
  { id: 3, name: "John Wick", relation: "Self", phone: "+1 (555) 0300", email: "john@continental.com", emergencyName: "Winston", emergencyRel: "Manager", emergencyPhone: "+1 (555) 0301" },
];

export default function Emergency() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Emergency Contacts</h1>
          <p className="text-slate-500 text-sm">Critical contact information for all employees.</p>
        </div>
        <Button variant="destructive" className="shadow-sm">
          <AlertTriangle className="h-4 w-4 mr-2" /> Broadcast Alert
        </Button>
      </div>

      <Card className="border border-slate-200 shadow-sm mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search by employee name..." className="pl-9 bg-white" />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border border-slate-200">
                    <AvatarFallback>{contact.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-slate-900">{contact.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="flex items-center"><Phone className="h-3 w-3 mr-1" /> {contact.phone}</span>
                      <span className="flex items-center"><Mail className="h-3 w-3 mr-1" /> {contact.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 md:max-w-md bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-bold text-red-800 uppercase mb-2 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Emergency Contact
                  </p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{contact.emergencyName}</p>
                      <p className="text-xs text-slate-500">{contact.emergencyRel}</p>
                    </div>
                    <div className="text-right">
                      <Button size="sm" variant="outline" className="h-8 bg-white border-red-200 text-red-700 hover:bg-red-50">
                        <Phone className="h-3 w-3 mr-2" /> Call Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
