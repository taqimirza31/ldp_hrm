import Layout from "@/components/layout/Layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const orgData = {
  name: "Bruce Wayne",
  role: "CEO",
  img: "https://github.com/shadcn.png",
  dept: "Executive",
  children: [
    {
      name: "Morpheus King",
      role: "VP of Operations",
      img: "https://github.com/shadcn.png",
      dept: "Operations",
      children: [
        {
          name: "Neo Anderson",
          role: "Lead Architect",
          img: "https://github.com/shadcn.png",
          dept: "Engineering",
          children: [
             { name: "Cypher Reagan", role: "Frontend Dev", img: "https://github.com/shadcn.png", dept: "Engineering" },
             { name: "Tank Dozer", role: "DevOps", img: "https://github.com/shadcn.png", dept: "Engineering" }
          ]
        },
        {
          name: "Trinity Moss",
          role: "Product Director",
          img: "https://github.com/shadcn.png",
          dept: "Product",
          children: []
        }
      ]
    },
    {
      name: "Sarah Connor",
      role: "HR Director",
      img: "https://github.com/shadcn.png",
      dept: "HR",
      children: [
        {
          name: "Oracle Jones",
          role: "HR BP",
          img: "https://github.com/shadcn.png",
          dept: "HR",
           children: []
        }
      ]
    }
  ]
};

const OrgNode = ({ data, level = 0 }: { data: any, level?: number }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = data.children && data.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10"
      >
        <Card className={`w-64 p-4 flex flex-col items-center text-center border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group bg-white relative ${level === 0 ? 'border-t-4 border-t-blue-600' : ''}`}>
          {hasChildren && (
             <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm z-20 hover:bg-slate-50"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? <Minus className="h-3 w-3 text-slate-500" /> : <Plus className="h-3 w-3 text-slate-500" />}
            </Button>
          )}
          
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4 text-slate-400" />
          </div>

          <Avatar className="h-16 w-16 mb-3 border-2 border-slate-100 shadow-sm">
            <AvatarImage src={data.img} />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          
          <h3 className="font-bold text-slate-900 leading-tight">{data.name}</h3>
          <p className="text-blue-600 text-sm font-medium mb-1">{data.role}</p>
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-[10px]">
            {data.dept}
          </Badge>
        </Card>
      </motion.div>

      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center"
          >
            <div className="h-8 w-px bg-slate-300" /> {/* Vertical line from parent */}
            <div className="flex gap-8 pt-4 border-t border-slate-300 relative px-4"> 
              {/* Horizontal connector line logic needs to be handled carefully or use a simpler visual trick */}
              {/* The border-t works for the horizontal bar, but we need to hide the "ends" if straightforward flex */}
              
              {data.children.map((child: any, i: number) => (
                <div key={i} className="flex flex-col items-center relative">
                  {/* Vertical line to child */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-slate-300" /> 
                  <OrgNode data={child} level={level + 1} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function OrgChart() {
  return (
    <Layout>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-display font-bold text-slate-900">Organizational Structure</h1>
        <p className="text-slate-500 text-sm">Interactive hierarchy visualization.</p>
      </div>

      <div className="overflow-auto pb-20 pt-10 cursor-grab active:cursor-grabbing min-h-[600px] flex justify-center">
        <div className="min-w-max px-10">
          <OrgNode data={orgData} />
        </div>
      </div>
    </Layout>
  );
}
