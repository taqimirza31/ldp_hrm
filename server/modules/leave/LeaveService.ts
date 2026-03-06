import { LeaveRepository } from "./LeaveRepository.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../../core/types/index.js";
import { memCache } from "../../lib/perf.js";
import { isFreshTeamConfigured, listEmployees as listFtEmployees, listTimeOffTypes as listFtTimeOffTypes, listTimeOffs as listFtTimeOffs, getEmployeeWithTimeOff as getFtEmployeeWithTimeOff, sleep, getFreshTeamDelayMs, type FreshTeamTimeOff } from "../../lib/freshteamApi.js";

const repo = () => new LeaveRepository();

// ── Business day counting ────────────────────────────────────────────────────────
async function countBusinessDays(startDate: string, endDate: string, dayType: string): Promise<number> {
  const r = new LeaveRepository();
  const holidays = await r.getHolidaysBetween(startDate, endDate);
  const holidaySet = new Set(holidays.map((h) => typeof h.date==="string"?h.date:(h.date as any).toISOString?.().slice(0,10)));
  const start=new Date(startDate+"T00:00:00"), end=new Date(endDate+"T00:00:00");
  let count=0; const cur=new Date(start);
  while(cur<=end) { const dow=cur.getDay(); const ds=cur.toISOString().slice(0,10); if(dow!==0&&dow!==6&&!holidaySet.has(ds)) count++; cur.setDate(cur.getDate()+1); }
  return dayType==="half"?count*0.5:count;
}

// ── Policy matching ─────────────────────────────────────────────────────────────
function parseJsonArray(v: any): string[] { if(Array.isArray(v)) return v; if(typeof v==="string"&&v) try{return JSON.parse(v)}catch{return []} return []; }
function policyAllowedForRole(policy: any, userRole: string) { const roles=parseJsonArray(policy.applicable_roles); return roles.length===0||roles.includes(userRole); }

async function findAllMatchingPolicies(department: string, employeeType: string, userRole?: string, todayStr?: string): Promise<any[]> {
  const r = new LeaveRepository();
  const today = todayStr??new Date().toISOString().split("T")[0];
  const policies = await r.getAllActivePolicies(today);
  const scored: {policy:any;score:number}[] = [];
  for (const p of policies) {
    if (userRole&&!policyAllowedForRole(p,userRole)) continue;
    const depts=parseJsonArray(p.applicable_departments); const types=parseJsonArray(p.applicable_employment_types);
    const deptMatch=depts.length===0||depts.includes(department); const typeMatch=types.length===0||types.includes(employeeType);
    if(!deptMatch||!typeMatch) continue;
    let score=0; if(depts.length>0) score+=2; if(types.length>0) score+=1;
    scored.push({policy:p,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  return scored.map(s=>s.policy);
}

async function initializeEmployeeBalances(employeeId: string, department: string, employeeType: string, performedBy?: string) {
  const r = new LeaveRepository();
  const policies = await findAllMatchingPolicies(department, employeeType);
  if(!policies.length) return;
  const policy = policies[0];
  const [leaveTypes, existing] = await Promise.all([r.getPolicyTypes(policy.id), r.getBalance(employeeId, policy.id)]);
  const existingSet = new Set((await r.getBalancesForEmployee(employeeId, leaveTypes.map((lt:any)=>lt.id))).map((b:any)=>b.leave_type_id));
  const toInsert = leaveTypes.filter((lt:any)=>!existingSet.has(lt.id));
  await Promise.all(toInsert.map(async (lt:any)=>{
    const isEarned = lt.accrual_type==="monthly"&&/earned|annual|^el$/i.test(String(lt.name).trim());
    const init = lt.accrual_type==="yearly"?lt.max_balance:0;
    if (isEarned) await r.insertBalanceWithNullAccrual(employeeId, lt.id);
    else await r.insertBalance(employeeId, lt.id, init);
    await r.audit("balance",employeeId,"initialize",performedBy||"system",{leaveTypeId:lt.id,policyId:policy.id,initialBalance:isEarned?0:init});
  }));
}

// ── Accrual engines ─────────────────────────────────────────────────────────────
async function runMonthlyAccrual() {
  const r = new LeaveRepository();
  const currentMonth = new Date().toISOString().slice(0,7);
  const balances = await r.getMonthlyAccrualBalances(currentMonth);
  const toAccrue = balances.map((b:any)=>{const rate=parseFloat(b.accrual_rate||"0"),cur=parseFloat(b.balance||"0"),max=parseInt(b.max_balance||"999"),nb=Math.min(cur+rate,max);return nb>cur?{...b,rate,cur,nb}:null}).filter(Boolean) as any[];
  const BATCH=20;
  for(let i=0;i<toAccrue.length;i+=BATCH) { const batch=toAccrue.slice(i,i+BATCH); await Promise.all(batch.map(async(b:any)=>{await r.updateAccrual(b.id,b.nb); await r.audit("balance",b.employee_id,"accrue","system",{leaveTypeId:b.leave_type_id,accrued:b.rate,prev:b.cur,new:b.nb});})); }
  return toAccrue.length;
}

async function runEarnedLeaveAccrual(): Promise<number> {
  const r = new LeaveRepository();
  const elTypeId = await r.findEarnedLeaveTypeId();
  if(!elTypeId) return 0;
  const [activeEmployees, existingRows] = await Promise.all([r.getActiveEmployees(), r.getExistingELBalanceEmployeeIds(elTypeId)]);
  const existingSet = new Set(existingRows.map((row:any)=>row.employee_id));
  for(const emp of activeEmployees as any[]) { if(!existingSet.has(emp.id)) { await initializeEmployeeBalances(emp.id,emp.department||"Other",emp.employee_type||"full_time","system"); existingSet.add(emp.id); } }
  const rows = await r.getEarnedLeaveBalances(elTypeId);
  const today=new Date(); today.setHours(0,0,0,0); const yesterday=new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const msPerDay=86400000;
  let processed=0;
  for(const row of rows as any[]) {
    const joinDate=row.join_date?new Date(new Date(row.join_date).toISOString().slice(0,10)+"T00:00:00.000Z"):null;
    if(!joinDate||joinDate>yesterday) continue;
    const curBal=parseFloat(row.balance||"0"), lastAt=row.last_accrual_at?new Date(row.last_accrual_at):null;
    const start=lastAt?new Date(lastAt):new Date(joinDate); if(lastAt) start.setDate(start.getDate()+1); start.setHours(0,0,0,0);
    if(start>yesterday) continue;
    const days=Math.floor((yesterday.getTime()-start.getTime())/msPerDay)+1; const blocks=Math.floor(days/15); if(blocks<=0) continue;
    const totalAccrual=blocks*0.5; const nb=Math.min(curBal+totalAccrual,12);
    const lastEnd=new Date(start); lastEnd.setDate(lastEnd.getDate()+blocks*15-1);
    const lastAtStr=lastEnd.toISOString().slice(0,10)+"T23:59:59.999Z";
    await r.updateEarnedLeaveAccrual(row.id,nb,lastAtStr);
    await r.audit("balance",row.employee_id,"accrue","system",{leaveTypeId:row.leave_type_id,accrued:totalAccrual,prev:curBal,new:nb,blocks15:blocks});
    processed++;
  }
  return processed;
}

export async function ensureAccrualRun() {
  const r = new LeaveRepository();
  await runEarnedLeaveAccrual();
  try {
    const now=new Date(); const cy=now.getFullYear(); const cm=now.getMonth();
    const lm=cm===0?{y:cy-1,m:11}:{y:cy,m:cm-1};
    const period=`${lm.y}-${String(lm.m+1).padStart(2,"0")}`;
    const inserted=await r.tryInsertAccrualRun(period);
    if(inserted.length>0) await runMonthlyAccrual();
  } catch {}
}

// ── Year-end reset ──────────────────────────────────────────────────────────────
async function processBereavementYearEnd(year: number, employees: any[], performedBy: string|null) {
  const r = new LeaveRepository();
  const btId=await r.findBereavementLeaveTypeId(); if(!btId) return 0;
  const resetDate=`${year}-01-01T00:00:00.000Z`; const DAYS=2; let count=0;
  for(const emp of employees) {
    try {
      const rows=await r.getELBalance(emp.id,btId);
      if(!rows.length) { await r.snapshotBalance(emp.id,btId,year,0,0); await r.insertBereavementBalance(emp.id,btId,DAYS,resetDate); await r.audit("balance",emp.id,"YEAR_END_RESET",performedBy,{leave_type_id:btId,year,set_balance:DAYS}); count++; continue; }
      const row=rows[0]; if(row.last_reset_at&&new Date(row.last_reset_at).getFullYear()===year) continue;
      await r.snapshotBalance(emp.id,btId,year,row.balance||0,row.used||0); await r.resetBereavementBalance(row.id,DAYS,resetDate); await r.audit("balance",row.id,"YEAR_END_RESET",performedBy,{employee_id:emp.id,leave_type_id:btId,year,set_balance:DAYS}); count++;
    } catch {}
  }
  return count;
}

// ── Approval chain ──────────────────────────────────────────────────────────────
function shouldAutoApprove(leaveType: any, totalDays: number, inNotice: boolean) {
  if(inNotice) return false;
  if(!leaveType.requires_approval) return true;
  const rules=leaveType.auto_approve_rules;
  if(rules&&typeof rules==="object") { const maxDays=(rules as any).maxDays; if(maxDays!=null&&totalDays<=maxDays) return true; }
  return false;
}

async function buildApprovalChain(employeeId: string, leaveType: any, totalDays: number, inNotice: boolean) {
  const r = new LeaveRepository();
  const chain: {approverId:string;approverRole:string;stepOrder:number}[] = [];
  const emp=await r.getEmployeeManager(employeeId);
  if(emp?.manager_id) {
    let mgrEmpId: string|null=null;
    if((await r.getEmployeeById(emp.manager_id))) mgrEmpId=emp.manager_id;
    else { const byUser=await r.getUserEmployeeId(emp.manager_id); if(byUser) mgrEmpId=byUser; }
    if(mgrEmpId&&mgrEmpId!==employeeId) chain.push({approverId:mgrEmpId,approverRole:"manager",stepOrder:1});
  }
  const noManager=chain.length===0;
  const needsHR=leaveType.hr_approval_required||inNotice||totalDays>5||noManager;
  if(needsHR) {
    let hrs=await r.getHrAdminUsers(employeeId);
    if(!hrs.length) {
      const hrUsers=await r.getHrUsers();
      for(const hu of hrUsers) {
        if(hu.employee_id) { if((await r.verifyEmployee(hu.employee_id))&&hu.employee_id!==employeeId) { hrs=[{employee_id:hu.employee_id,user_id:hu.id,role:hu.role}]; break; } }
        if(hu.email) { const eByEmail=await r.getEmployeeByEmail(hu.email); if(eByEmail?.id&&eByEmail.id!==employeeId) { await r.updateUserEmployeeId(hu.id,eByEmail.id); hrs=[{employee_id:eByEmail.id,user_id:hu.id,role:hu.role}]; break; } if(hu.email) { const ne=await r.createSystemEmployee(hu.email,hu.role); if(ne) { await r.updateUserEmployeeId(hu.id,ne.id); hrs=[{employee_id:ne.id,user_id:hu.id,role:hu.role}]; break; } } }
      }
    }
    if(hrs.length>0&&!chain.some(s=>s.approverId===hrs[0].employee_id)) chain.push({approverId:hrs[0].employee_id,approverRole:"hr",stepOrder:chain.length+1});
    else if(!hrs.length) console.warn("[leave] WARNING: No HR/admin approver found.");
  }
  const ids=chain.map(s=>s.approverId); if(!ids.length) return [];
  const verified=await r.verifyEmployees(ids);
  const vSet=new Set(verified.map((r:any)=>r.id));
  return chain.filter(s=>vSet.has(s.approverId));
}

// ── Attendance sync ─────────────────────────────────────────────────────────────
async function syncLeaveToAttendance(requestId: string): Promise<boolean> {
  const r = new LeaveRepository();
  const req=await r.getRequestForSync(requestId); if(!req) return false;
  const start=new Date(req.start_date+"T00:00:00"), end=new Date(req.end_date+"T00:00:00");
  const holidays=await r.getHolidaysBetween(req.start_date,req.end_date);
  const holidaySet=new Set(holidays.map((h:any)=>typeof h.date==="string"?h.date:(h.date as any).toISOString?.().slice(0,10)));
  const cur=new Date(start);
  while(cur<=end) { const dateStr=cur.toISOString().split("T")[0]; const dow=cur.getDay(); if(dow!==0&&dow!==6&&!holidaySet.has(dateStr)) { const status=req.day_type==="half"?"half_day":"absent"; const remarks=`On leave: ${req.type_name} (${req.day_type} day)`; const existing=await r.getAttendanceRecord(req.employee_id,dateStr); await r.upsertAttendanceLeave(req.employee_id,dateStr,status,remarks,existing); } cur.setDate(cur.getDate()+1); }
  return true;
}

async function reverseAttendanceSync(requestId: string) {
  const r = new LeaveRepository();
  const req=await r.getRequestById(requestId); if(!req) return;
  const start=new Date(req.start_date+"T00:00:00"), end=new Date(req.end_date+"T00:00:00"); const cur=new Date(start);
  while(cur<=end) { if(cur.getDay()!==0&&cur.getDay()!==6) { const ds=cur.toISOString().split("T")[0]; await r.deleteLeaveAttendance(req.employee_id,ds); } cur.setDate(cur.getDate()+1); }
}

export class LeaveService {
  private readonly r = new LeaveRepository();

  // ── Policies ────────────────────────────────────────────────────────────────────
  async listPolicies() {
    const cached=memCache.get<any[]>("leave:policies"); if(cached) return cached;
    const p=await this.r.listPolicies(); memCache.set("leave:policies",p,30_000); return p;
  }
  async getPolicyById(id: string) {
    const p=await this.r.getPolicyById(id); if(!p) throw new NotFoundError("Policy",id);
    const types=await this.r.getPolicyTypes(id); return {...p, leave_types:types};
  }
  async updatePolicy(id: string, body: any, performedBy: string) {
    const p=await this.r.updatePolicy(id, body); if(!p) throw new NotFoundError("Policy",id);
    await this.r.audit("policy",id,"update",performedBy,body); memCache.invalidate("leave:policies"); return p;
  }
  async deletePolicy(id: string) {
    if(await this.r.policyHasRequests(id)) throw new ForbiddenError("Cannot delete policy: leave requests exist.");
    await this.r.deletePolicy(id); memCache.invalidate("leave:policies");
  }

  // ── Leave Types ──────────────────────────────────────────────────────────────────
  async updateType(id: string, body: any, performedBy: string) {
    if(body.maxBalance!=null) { const n=parseInt(String(body.maxBalance),10); if(!Number.isNaN(n)&&(await this.r.typeBalancesAbove(id,n))) throw new ValidationError("Cannot reduce max_balance: some employees have balance above the new maximum."); }
    const t=await this.r.updateType(id, body); if(!t) throw new NotFoundError("Leave type",id);
    await this.r.audit("type",id,"update",performedBy,body); return t;
  }
  async deleteType(id: string) {
    if(await this.r.typeHasRequests(id)) throw new ForbiddenError("Cannot delete leave type: leave requests reference it.");
    await this.r.deleteType(id);
  }

  // ── Balances ──────────────────────────────────────────────────────────────────────
  async getBalances(employeeId: string) { await ensureAccrualRun(); return this.r.getBalances(employeeId); }
  async initializeBalances(employeeId: string, performedBy: string) {
    const emp=await this.r.getEmployeeDeptType(employeeId); if(!emp) throw new NotFoundError("Employee",employeeId);
    await initializeEmployeeBalances(employeeId, emp.department||"Other", emp.employee_type||"full_time", performedBy);
    return {success:true};
  }
  async adjustBalance(balanceId: string, newBalance: number, reason: string, performedBy: string) {
    if(newBalance==null) throw new ValidationError("newBalance required");
    if(!reason) throw new ValidationError("Reason required");
    const existing=await this.r.getBalanceById(balanceId); if(!existing) throw new NotFoundError("Balance",balanceId);
    if(!(existing.type_name||"").toLowerCase().includes("earned")) throw new ForbiddenError("Balance adjustments are only allowed for Earned Leave.");
    await this.r.adjustBalance(balanceId, newBalance);
    await this.r.audit("balance",existing.employee_id,"adjust",performedBy,{balanceId,previousBalance:existing.balance,newBalance,reason});
    return {success:true};
  }
  async addBalance(employeeId: string, leaveTypeId: string, daysToAdd: number, reason: string, performedBy: string) {
    if(!reason) throw new ValidationError("Reason required");
    const delta=parseFloat(String(daysToAdd)); if(Number.isNaN(delta)) throw new ValidationError("daysToAdd must be a number");
    const emp=await this.r.getEmployeeDeptType(employeeId); if(!emp) throw new NotFoundError("Employee",employeeId);
    const lt=await this.r.getTypeById(leaveTypeId); if(!lt) throw new NotFoundError("Leave type",leaveTypeId);
    if(!(lt.name||"").toLowerCase().includes("earned")) throw new ForbiddenError("Adding days is only allowed for Earned Leave.");
    let balRows=await this.r.getBalance(employeeId,leaveTypeId);
    if(!balRows.length) { await initializeEmployeeBalances(employeeId,emp.department||"Other",emp.employee_type||"full_time",performedBy); balRows=await this.r.getBalance(employeeId,leaveTypeId); }
    if(!balRows.length) throw new NotFoundError("Balance record",`${employeeId}/${leaveTypeId}`);
    const cur=parseFloat((balRows[0] as any).balance||"0"); const nb=Math.max(0,cur+delta);
    await this.r.addToBalance((balRows[0] as any).id, nb);
    await this.r.audit("balance",employeeId,"add",performedBy,{leaveTypeId,daysToAdd:delta,previousBalance:cur,newBalance:nb,reason});
    return {success:true,previousBalance:cur,newBalance:nb};
  }
  async runAccrual() { const [e,o]=await Promise.all([runEarnedLeaveAccrual(),runMonthlyAccrual()]); return {success:true,accruedCount:e+o,earnedLeaveAccrued:e}; }
  async processYearEnd(year: number, performedBy: string|null) {
    const r=this.r; const errors: string[] = []; let processed=0, skipped=0;
    const elTypeId=await r.findEarnedLeaveTypeId();
    if(elTypeId) {
      const resetDate=`${year}-01-01T00:00:00.000Z`;
      const employees=await r.getActiveEmployeesWithCode();
      for(const emp of employees as any[]) {
        try {
          let balRows=await r.getELBalance(emp.id,elTypeId);
          if(!balRows.length) { const d=await r.getEmployeeDeptType(emp.id); if(d) await initializeEmployeeBalances(emp.id,d.department||"Other",d.employee_type||"full_time",performedBy||undefined); balRows=await r.getELBalance(emp.id,elTypeId); }
          if(!balRows.length) { skipped++; continue; }
          const row=balRows[0]; if(row.last_reset_at&&new Date(row.last_reset_at).getFullYear()===year) { skipped++; continue; }
          await r.snapshotBalance(emp.id,elTypeId,year,row.balance||0,row.used||0);
          await r.resetELBalance(row.id,resetDate);
          await r.audit("balance",row.id,"YEAR_END_RESET",performedBy,{employee_id:emp.id,leave_type_id:elTypeId,year,set_balance:0});
          processed++;
        } catch(e:any) { errors.push(`employee ${(emp as any).employee_id}: ${e?.message??String(e)}`); }
      }
    }
    const employees=await r.getActiveEmployeesWithCode();
    const bereavementProcessed=await processBereavementYearEnd(year,employees,performedBy);
    return {processed,skipped,errors,bereavementProcessed};
  }

  // ── Holidays ──────────────────────────────────────────────────────────────────────
  async listHolidays() { return this.r.listHolidays(); }
  async createHoliday(date: string, name?: string) {
    if(!date||typeof date!=="string") throw new ValidationError("date required (YYYY-MM-DD)");
    const d=String(date).trim().slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ValidationError("Invalid date; use YYYY-MM-DD");
    return this.r.createHoliday(d, name?String(name).trim()||null:null);
  }
  async deleteHoliday(id: string) { const ok=await this.r.deleteHoliday(id); if(!ok) throw new NotFoundError("Holiday",id); }

  // ── Leave Requests ────────────────────────────────────────────────────────────────
  async getMyRequests(employeeId: string|null|undefined, limit: number, offset: number) {
    if(!employeeId) return [];
    return this.r.getMyRequests(employeeId, Math.min(limit,200), offset);
  }
  async submitRequest(employeeId: string|null|undefined, body: any, userId: string, userTz: string) {
    if(!employeeId) throw new ValidationError("No employee profile linked");
    const {leaveTypeId,startDate,endDate,dayType,reason,attachmentUrl}=body;
    if(!leaveTypeId||!startDate||!endDate) throw new ValidationError("leaveTypeId, startDate, endDate required");
    if(endDate<startDate) throw new ValidationError("End date cannot be before start date");
    const [emp,lt]=await Promise.all([this.r.getEmployeeDetails(employeeId), this.r.getTypeById(leaveTypeId)]);
    if(!emp) throw new NotFoundError("Employee",employeeId);
    if(!lt) throw new NotFoundError("Leave type",leaveTypeId);
    if(emp.employment_status==="offboarded") throw new ValidationError("Offboarded employees cannot apply");
    if(emp.join_date&&startDate<new Date(emp.join_date).toISOString().split("T")[0]) throw new ValidationError("Cannot apply before joining date");
    if(emp.exit_date) { const exitStr=new Date(emp.exit_date).toISOString().split("T")[0]; if(endDate>exitStr) throw new ValidationError(`Cannot take leave beyond exit date (${exitStr})`); }
    const ltPolicy=await this.r.getPolicyById(lt.policy_id); if(!ltPolicy?.is_active) throw new ValidationError(`Leave type "${lt.name}" belongs to an inactive or missing policy`);
    const today=userTz.slice(0,10)||new Date().toISOString().slice(0,10);
    if(ltPolicy.effective_from>today||(ltPolicy.effective_to&&ltPolicy.effective_to<today)) throw new ValidationError(`Leave type "${lt.name}" belongs to a policy outside its effective date range`);
    const inNotice=await this.r.isInNoticePeriod(employeeId);
    if(lt.blocked_during_notice&&inNotice) throw new ValidationError(`${lt.name} is blocked during notice period`);
    if(lt.requires_document&&!attachmentUrl) throw new ValidationError(`${lt.name} requires a supporting document`);
    const totalDays=await countBusinessDays(startDate,endDate,dayType||"full");
    if(totalDays<=0) throw new ValidationError("Invalid date range (no business days)");
    if(lt.max_days_per_request&&totalDays>lt.max_days_per_request) throw new ValidationError(`Max ${lt.max_days_per_request} days per request`);
    if(lt.min_days&&totalDays<lt.min_days) throw new ValidationError(`Min ${lt.min_days} days required`);
    if(lt.paid) {
      let balRows=await this.r.getBalance(employeeId,leaveTypeId);
      if(!balRows.length) { await initializeEmployeeBalances(employeeId,emp.department||"Other",emp.employee_type||"full_time",userId); balRows=await this.r.getBalance(employeeId,leaveTypeId); }
      const bal=balRows.length>0?parseFloat((balRows[0] as any).balance):0;
      if(bal<totalDays) throw new ValidationError(`Insufficient balance (${bal} available, ${totalDays} requested).`);
    }
    const overlap=await this.r.checkOverlap(employeeId,startDate,endDate);
    if(overlap.length>0) throw new ValidationError("Overlapping leave request exists for these dates");
    const policySnapshot=JSON.stringify({policyName:ltPolicy.name||null,leaveTypeName:lt.name||null,maxBalance:lt.max_balance!=null?Number(lt.max_balance):null,paid:!!lt.paid,requiresApproval:!!lt.requires_approval});
    const autoApprove=shouldAutoApprove(lt,totalDays,inNotice);
    if(autoApprove) {
      const req=await this.r.createAutoApprovedRequest({employeeId,leaveTypeId,startDate,endDate,dayType,totalDays,reason,attachmentUrl,policySnapshot});
      if(lt.paid) await this.r.deductBalance(employeeId,leaveTypeId,totalDays);
      let syncOk=false; try{syncOk=await syncLeaveToAttendance(req.id)}catch{}
      await this.r.updateRequestSyncStatus(req.id,syncOk?"synced":"failed");
      await this.r.audit("request",req.id,"auto_approve","system",{totalDays,leaveType:lt.name});
      return {...req,autoApproved:true};
    }
    const chain=await buildApprovalChain(employeeId,lt,totalDays,inNotice);
    if(!chain.length) throw new ValidationError("Leave requires approval but no valid approvers found.");
    const req=await this.r.createRequest({employeeId,leaveTypeId,startDate,endDate,dayType,totalDays,reason,attachmentUrl,policySnapshot});
    for(const step of chain) await this.r.createApproval({requestId:req.id,approverId:step.approverId,approverRole:step.approverRole,stepOrder:step.stepOrder});
    await this.r.audit("request",req.id,"create",employeeId,{totalDays,leaveType:lt.name,chain:chain.map(s=>({role:s.approverRole,approverId:s.approverId,step:s.stepOrder}))});
    return req;
  }
  async cancelRequest(id: string, employeeId: string|null|undefined, userId: string, role: string) {
    const req=await this.r.getRequestById(id); if(!req) throw new NotFoundError("Request",id);
    if(req.employee_id!==employeeId&&role!=="admin"&&role!=="hr") throw new ForbiddenError("Can only cancel your own requests");
    if(req.status==="cancelled") throw new ValidationError("Already cancelled");
    const wasApproved=req.status==="approved";
    const cancelled=await this.r.cancelRequest(id);
    if(!cancelled.length) throw new ValidationError("Request already cancelled or rejected");
    await this.r.cancelPendingApprovals(id);
    if(wasApproved&&req.paid) { await this.r.restoreBalance(req.employee_id,req.leave_type_id,req.total_days); await reverseAttendanceSync(id); }
    await this.r.audit("request",id,"cancel",employeeId||userId,{wasApproved});
    return {success:true};
  }
  async listRequests(role: string, employeeId: string|null|undefined, query: any) {
    if(role==="employee") return [];
    const limit=Math.min(parseInt(query.limit)||200,500), offset=parseInt(query.offset)||0;
    return this.r.listRequests({role,employeeId,status:query.status,from:query.from,to:query.to,limit,offset});
  }
  async getRequestDetail(id: string, role: string, employeeId: string|null|undefined) {
    const req=await this.r.getRequestWithType(id); if(!req) throw new NotFoundError("Request",id);
    if(role==="employee"&&req.employee_id!==employeeId) throw new ForbiddenError("Access denied");
    if(role==="employee") return req;
    const approvals=await this.r.getApprovals(id);
    return {...req, approvals};
  }
  async getEmployeeRequests(employeeId: string, userId: string, role: string, myEmployeeId: string|null|undefined) {
    const allowed=role==="admin"||role==="hr"||myEmployeeId===employeeId||(role==="manager"&&myEmployeeId&&(await this.r.isManagerOf(myEmployeeId,employeeId)));
    if(!allowed) throw new ForbiddenError("Access denied");
    return this.r.getEmployeeRequests(employeeId);
  }

  // ── Approvals ──────────────────────────────────────────────────────────────────────
  async getPendingApprovals(employeeId: string|null|undefined, role: string) {
    if(!employeeId) return [];
    const mine=await this.r.getMyApprovals(employeeId);
    if(role!=="hr"&&role!=="admin") return mine;
    const hrApprovals=await this.r.getHrApprovals(employeeId);
    const seen=new Set(mine.map((r:any)=>r.id));
    return [...mine,...hrApprovals.filter((r:any)=>!seen.has(r.id))];
  }
  async approveRequest(approvalId: string, body: any, employeeId: string|null|undefined, userId: string, role: string) {
    const {remarks,hrOverride}=body||{};
    const isHRAdmin=role==="hr"||role==="admin";
    const approval=await this.r.getApprovalById(approvalId); if(!approval) throw new NotFoundError("Approval",approvalId);
    const lr=await this.r.getRequestById(approval.leave_request_id); if(!lr) throw new NotFoundError("Request",approval.leave_request_id);
    if(lr.employee_id===employeeId) throw new ForbiddenError("Cannot approve your own leave request");
    const isAssigned=approval.approver_id===employeeId;
    if(!isAssigned&&!isHRAdmin) throw new ForbiddenError("Not authorized");
    if(hrOverride===true&&!isHRAdmin) throw new ForbiddenError("HR override is only allowed for HR/Admin");
    const actedById=isHRAdmin&&!isAssigned?(employeeId||userId):null;
    const updated=await this.r.setApprovalApproved(approvalId, actedById, remarks);
    if(!updated.length) throw new ValidationError("Already actioned");
    const pending=await this.r.getPendingApprovals(approval.leave_request_id);
    if(pending.length>0) { await this.r.audit("approval",approvalId,"approve",employeeId||userId,{step:approval.step_order,remaining:pending.length,hrOverride:hrOverride===true||undefined}); return {success:true,fullyApproved:false}; }
    const reqDetail=await this.r.getRequestById(approval.leave_request_id); if(!reqDetail) throw new NotFoundError("Request",approval.leave_request_id);
    if(reqDetail.status!=="pending") return {success:true,fullyApproved:true,alreadyApproved:true};
    if(reqDetail.paid) { const deducted=await this.r.deductBalance(reqDetail.employee_id,reqDetail.leave_type_id,reqDetail.total_days); if(!deducted.length) throw new ValidationError("Insufficient balance (concurrent update). Please retry."); }
    const approved=await this.r.approveRequest(approval.leave_request_id,employeeId||userId);
    if(!approved.length) { if(reqDetail.paid) await this.r.restoreBalance(reqDetail.employee_id,reqDetail.leave_type_id,reqDetail.total_days); return {success:true,fullyApproved:true,alreadyApproved:true}; }
    let syncOk=false; try{syncOk=await syncLeaveToAttendance(approval.leave_request_id)}catch{}
    await this.r.updateRequestSyncStatus(approval.leave_request_id,syncOk?"synced":"failed");
    await this.r.audit("request",approval.leave_request_id,"approve",employeeId||userId,{finalApprover:true,totalDays:reqDetail.total_days,hrOverride:hrOverride===true||undefined,attendance_sync:syncOk?"synced":"failed"});
    return {success:true,fullyApproved:true};
  }
  async rejectApproval(approvalId: string, body: any, employeeId: string|null|undefined, userId: string, role: string) {
    const {remarks,hrOverride}=body||{};
    const isHRAdmin=role==="hr"||role==="admin";
    const approval=await this.r.getApprovalById(approvalId); if(!approval) throw new NotFoundError("Approval",approvalId);
    const reqRow=await this.r.getRequestById(approval.leave_request_id); if(!reqRow) throw new NotFoundError("Request",approval.leave_request_id);
    if(reqRow.employee_id===employeeId) throw new ForbiddenError("Cannot reject your own leave request");
    const isAssigned=approval.approver_id===employeeId;
    if(!isAssigned&&!isHRAdmin) throw new ForbiddenError("Not authorized");
    if(hrOverride===true&&!isHRAdmin) throw new ForbiddenError("HR override is only allowed for HR/Admin");
    const actedById=isHRAdmin&&!isAssigned?(employeeId||userId):null;
    const updated=await this.r.setApprovalRejected(approvalId, actedById, remarks); if(!updated.length) throw new ValidationError("Already actioned");
    await this.r.autoRejectRemaining(approval.leave_request_id);
    const rejected=await this.r.rejectRequest(approval.leave_request_id,employeeId||userId,remarks||"Rejected");
    if(!rejected.length) { await this.r.audit("request",approval.leave_request_id,"reject",employeeId||userId,{step:approval.step_order,requestAlreadyDecided:true}); return {success:true}; }
    await this.r.audit("request",approval.leave_request_id,"reject",employeeId||userId,{step:approval.step_order,remarks,hrOverride:hrOverride===true||undefined});
    return {success:true};
  }

  // ── Calendar / Team / Stats ────────────────────────────────────────────────────────
  async getCalendar(userTz: string, from?: string, to?: string, department?: string) {
    const today=userTz.slice(0,10)||new Date().toISOString().slice(0,10);
    const startDate=from||today.slice(0,8)+"01";
    const endDate=to||(()=>{const[y,m]=[today.slice(0,4),today.slice(5,7)];const last=new Date(Number(y),Number(m),0).getDate();return`${y}-${m}-${String(last).padStart(2,"0")}`})();
    return this.r.getCalendar(startDate, endDate, department);
  }
  async getTeam(managerId: string) {
    const team=await this.r.getTeam(managerId); if(!team.length) return [];
    const teamIds=team.map((m:any)=>m.id); const allBalances=await this.r.getTeamBalances(teamIds);
    const balanceMap=new Map<string,any[]>(); for(const b of allBalances){if(!balanceMap.has(b.employee_id))balanceMap.set(b.employee_id,[]);balanceMap.get(b.employee_id)!.push({balance:b.balance,used:b.used,type_name:b.type_name,color:b.color});}
    return team.map((m:any)=>({...m,balances:balanceMap.get(m.id)||[]}));
  }
  async getStats(role: string, employeeId: string|null|undefined, userTz: string) {
    await ensureAccrualRun();
    const today=userTz.slice(0,10)||new Date().toISOString().slice(0,10);
    return this.r.getStats(role,employeeId,today);
  }
  async getTypesForEmployee(employeeId: string, role: string, userTz: string) {
    await ensureAccrualRun();
    const emp=await this.r.getEmployeeDeptType(employeeId); if(!emp) throw new NotFoundError("Employee",employeeId);
    const today=userTz.slice(0,10)||new Date().toISOString().slice(0,10);
    let policies=await findAllMatchingPolicies(emp.department,emp.employee_type||"full_time",role,today);
    if(!policies.length) {
      const allPolicies=await this.r.getAllActivePolicies(today);
      for(const p of allPolicies) { if(!policyAllowedForRole(p,role)) continue; const tc=await this.r.getTypeByPolicyId(p.id); if(tc.length>0){policies.push(p);break;} }
    }
    if(!policies.length) return [];
    const policyIds=policies.map((p:any)=>p.id); const allTypes=await this.r.getTypesByPolicyIds(policyIds);
    const policyLookup=new Map(policies.map((p:any)=>[p.id,p.name]));
    const seenNames=new Set<string>(); const result: any[] = [];
    for(const policy of policies) { for(const lt of allTypes.filter((t:any)=>t.policy_id===policy.id)) { if(seenNames.has(lt.name.toLowerCase())) continue; seenNames.add(lt.name.toLowerCase()); result.push({...lt,policy_id:policy.id,policy_name:policyLookup.get(policy.id)}); } }
    const typeIds=result.map((lt:any)=>lt.id); const balances=await this.r.getBalancesForEmployee(employeeId,typeIds);
    const balMap=new Map(balances.map((b:any)=>[b.leave_type_id,b]));
    const missing=result.filter((lt:any)=>!balMap.has(lt.id));
    if(missing.length) { for(const lt of missing) { const init=lt.accrual_type==="yearly"?lt.max_balance:0; await this.r.insertBalance(employeeId,lt.id,init); balMap.set(lt.id,{balance:init,used:0}); } }
    return result.map((lt:any)=>{const bal=balMap.get(lt.id);return{...lt,balance:bal?.balance??0,used:bal?.used??0};});
  }

  // ── FreshTeam sync ────────────────────────────────────────────────────────────────
  async migrateFromFreshteam() {
    if(!isFreshTeamConfigured()) throw new ValidationError("FreshTeam is not configured.",503);
    const delayMs=getFreshTeamDelayMs();
    const stats={total:0,created:0,updated:0,skipped:0,failed:0,employeeNotFound:0,leaveTypeNotFound:0};
    const ftEmpMap=new Map<number,string>(); let page=1; const pp=50;
    do { const ftEmps=await listFtEmployees(page,pp); await sleep(delayMs); for(const ft of ftEmps){const email=(ft.official_email||"").trim().toLowerCase();if(!email)continue;const rows=await this.r.getEmployeesByEmail(email);if(rows.length>0)ftEmpMap.set(ft.id,(rows[0] as any).id);} page++; if((await listFtEmployees(page,pp)).length===0)break; } while(true);
    const ftTypeMap=new Map<number,string>(); page=1;
    do { const ftTypes=await listFtTimeOffTypes(page,pp); await sleep(delayMs); for(const ft of ftTypes){if(ft.deleted)continue;const ourId=await this.r.resolveLeaveTypeByName(ft.name||"");if(ourId)ftTypeMap.set(ft.id,ourId);} page++; if((await listFtTimeOffTypes(page,pp)).length===0)break; } while(true);
    page=1;
    const toDate="2030-12-31"; const fromDate="2026-01-01";
    do {
      const timeOffs=await listFtTimeOffs({page,per_page:pp,start_date:fromDate,end_date:toDate}); await sleep(delayMs); stats.total+=timeOffs.length;
      for(const to of timeOffs as FreshTeamTimeOff[]) {
        try {
          const ourEmpId=ftEmpMap.get(to.user_id)??ftEmpMap.get(to.applied_by_id); if(!ourEmpId){stats.employeeNotFound++;stats.skipped++;continue;}
          const ourTypeId=ftTypeMap.get(to.leave_type_id); if(!ourTypeId){stats.leaveTypeNotFound++;stats.skipped++;continue;}
          const status=((s:string)=>s==="approved"?"approved":s==="declined"?"rejected":s==="cancelled"?"cancelled":"pending")((to.status||"").toLowerCase());
          const totalDays=Math.max(0.5,Number(to.leave_units)||0); const appliedAt=to.created_at||new Date().toISOString();
          const decidedAt=to.rejected_at||to.cancelled_at||(status==="approved"?to.updated_at:null)||null;
          const rejectionReason=status==="rejected"||status==="cancelled"?(to.status_comments??null):null;
          const decidedBy=status==="approved"?(to.approved_by_id!=null?ftEmpMap.get(to.approved_by_id)??null:null):status==="rejected"?(to.rejected_by_id!=null?ftEmpMap.get(to.rejected_by_id)??null:null):status==="cancelled"?(to.cancelled_by_id!=null?ftEmpMap.get(to.cancelled_by_id)??null:null):null;
          const ftId=String(to.id); const existing=await this.r.getRequestsByFtId(ftId);
          if(existing.length>0) {
            const row=existing[0]; const oldStatus=row.status; const oldDays=parseFloat(row.total_days||"0")||0;
            if(oldStatus==="approved"&&status!=="approved"&&oldDays>0) { const bal=await this.r.getBalance(ourEmpId,ourTypeId); if(bal.length>0){const pu=parseFloat((bal[0] as any).used||"0")||0;await this.r.updateFtBalance(ourEmpId,ourTypeId,Math.max(0,pu-oldDays));} }
            else if(oldStatus!=="approved"&&status==="approved"&&totalDays>0) { const bal=await this.r.getBalance(ourEmpId,ourTypeId); const pu=bal.length>0?parseFloat((bal[0] as any).used||"0")||0:0;await this.r.updateFtBalance(ourEmpId,ourTypeId,pu+totalDays); }
            await this.r.updateFtRequest(row.id,{employeeId:ourEmpId,leaveTypeId:ourTypeId,startDate:to.start_date,endDate:to.end_date,totalDays,reason:to.comments??null,status,appliedAt,decidedAt,decidedBy,rejectionReason}); stats.updated++;
          } else {
            await this.r.createFtRequest({employeeId:ourEmpId,leaveTypeId:ourTypeId,startDate:to.start_date,endDate:to.end_date,totalDays,reason:to.comments??null,status,appliedAt,decidedAt,decidedBy,rejectionReason,ftId}); stats.created++;
            if(status==="approved"&&totalDays>0) { const bal=await this.r.getBalance(ourEmpId,ourTypeId); const pu=bal.length>0?parseFloat((bal[0] as any).used||"0")||0:0; await this.r.updateFtBalance(ourEmpId,ourTypeId,pu+totalDays); }
          }
        } catch(err){stats.failed++;}
      }
      page++; if(timeOffs.length<pp) break;
    } while(true);
    return {success:true,...stats,message:`Processed ${stats.total} time-offs: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed.`};
  }

  async syncBalancesFromFreshteam() {
    if(!isFreshTeamConfigured()) throw new ValidationError("FreshTeam is not configured.",503);
    const delayMs=getFreshTeamDelayMs(); const stats={employeesProcessed:0,balancesUpdated:0,skipped:0,failed:0};
    const ftEmpMap=new Map<number,string>(); let page=1; const pp=50;
    do { const ftEmps=await listFtEmployees(page,pp); await sleep(delayMs); for(const ft of ftEmps){const email=(ft.official_email||"").trim().toLowerCase();if(!email)continue;const rows=await this.r.getEmployeesByEmail(email);if(rows.length>0)ftEmpMap.set(ft.id,(rows[0] as any).id);} page++; if((await listFtEmployees(page,pp)).length===0)break; } while(true);
    const ftTypeMap=new Map<number,string>(); page=1;
    do { const ftTypes=await listFtTimeOffTypes(page,pp); await sleep(delayMs); for(const ft of ftTypes){if(ft.deleted)continue;const ourId=await this.r.resolveLeaveTypeByName(ft.name||"");if(ourId)ftTypeMap.set(ft.id,ourId);} page++; if((await listFtTimeOffTypes(page,pp)).length===0)break; } while(true);
    for(const [ftId,ourEmpId] of ftEmpMap) {
      try {
        const ftEmp=await getFtEmployeeWithTimeOff(ftId); await sleep(delayMs);
        const timeOff=ftEmp.time_off; if(!Array.isArray(timeOff)||!timeOff.length){stats.skipped++;continue;}
        for(const to of timeOff){const ftLtId=to.leave_type?.id;if(ftLtId==null)continue;const ourLtId=ftTypeMap.get(ftLtId);if(!ourLtId)continue;const credits=Number(to.leave_credits),availed=Number(to.leaves_availed);if(!Number.isFinite(credits))continue;await this.r.syncFtBalance(ourEmpId,ourLtId,Math.max(0,credits),Number.isFinite(availed)?Math.max(0,availed):0);stats.balancesUpdated++;}
        stats.employeesProcessed++;
      } catch{stats.failed++;}
    }
    return {success:true,...stats,message:`Synced balances for ${stats.employeesProcessed} employees, ${stats.balancesUpdated} balance rows updated.`};
  }
}
