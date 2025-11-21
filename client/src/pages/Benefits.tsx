import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ShoppingCart, HeartPulse, Shield, Glasses } from "lucide-react";

const plans = [
  { id: 1, name: "Standard Health", provider: "BlueCross", cost: "Free", features: ["Primary Care", "Generic Rx", "Virtual Visits"], icon: HeartPulse, popular: false },
  { id: 2, name: "Premium PPO", provider: "BlueCross", cost: "$120/mo", features: ["Specialist Access", "Brand Rx", "Low Deductible"], icon: Shield, popular: true },
  { id: 3, name: "Vision Plus", provider: "VSP", cost: "$15/mo", features: ["Annual Exam", "$200 Frames Allowance"], icon: Glasses, popular: false },
];

export default function Benefits() {
  return (
    <Layout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Benefits Enrollment</h1>
          <p className="text-slate-500 text-sm">Select your health and wellness plans for 2025.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase font-bold">Open Enrollment Ends</p>
          <p className="text-xl font-bold text-red-600">Nov 30, 2024</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`border-2 shadow-sm relative overflow-hidden ${plan.popular ? 'border-blue-600' : 'border-slate-200'}`}>
            {plan.popular && (
              <div className="bg-blue-600 text-white text-xs font-bold text-center py-1 uppercase tracking-wider">Most Popular</div>
            )}
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${plan.popular ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                  <plan.icon className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{plan.cost}</h3>
              </div>
              
              <h3 className="font-bold text-lg text-slate-900 mb-1">{plan.name}</h3>
              <p className="text-sm text-slate-500 mb-6">{plan.provider}</p>

              <div className="space-y-3 mb-8 flex-1">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-green-500" />
                    {feat}
                  </div>
                ))}
              </div>

              <Button className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'} text-white`}>
                Select Plan
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </Layout>
  );
}
