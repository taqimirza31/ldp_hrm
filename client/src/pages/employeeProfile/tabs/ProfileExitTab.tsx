import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateOnly } from "../types";
import type { EmployeeData } from "../types";

export interface ProfileExitTabProps {
  employee: EmployeeData;
}

function ProfileExitTab({ employee }: ProfileExitTabProps) {
  return (
    <Card className="border border-red-500/20 shadow-sm bg-red-500/10">
      <CardHeader>
        <CardTitle className="text-destructive">Separation Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
          <div>
            <p className="text-xs text-muted-foreground">Resignation Date</p>
            <p className="font-medium text-foreground">{formatDateOnly(employee.resignationDate) || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Working Date</p>
            <p className="font-medium text-foreground">{formatDateOnly(employee.lastWorkingDate) || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Exit Type</p>
            <Badge variant="outline" className="bg-red-500/10 text-destructive border-destructive/20">{employee.exitType || "Voluntary"}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible for Rehire</p>
            <p className="font-medium text-foreground">{employee.eligibleForRehire != null ? (employee.eligibleForRehire ? "Yes" : "No") : "Yes"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="font-medium text-foreground">{employee.resignationReason || "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProfileExitTab;
