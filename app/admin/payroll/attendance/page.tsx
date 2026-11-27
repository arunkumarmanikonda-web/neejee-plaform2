import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canReadFinance,canWriteFinance } from '@/lib/finance/roles';
import { prisma } from '@/lib/prisma';
import { MonthlyAttendance } from './form';
export const dynamic = 'force-dynamic';
export default async function AttendancePage({searchParams}:{searchParams:Promise<{period?:string}>}) {
  const actor=await getSession();if(!canReadFinance(actor)) notFound();
  const selected=(await searchParams).period;
  const period=selected&&/^\d{4}-(0[1-9]|1[0-2])$/.test(selected)?selected:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'});
  const [year,month]=period.split('-').map(Number);
  const [rows,employees]=await Promise.all([
    prisma.attendance.findMany({where:{year,month},select:{employeeId:true,daysWorked:true,leavesPaid:true,leavesUnpaid:true,overtimeHours:true,notes:true,employee:{select:{employeeCode:true}}},orderBy:{employee:{employeeCode:'asc'}}}),
    prisma.employee.findMany({select:{id:true,employeeCode:true,firstName:true,lastName:true},orderBy:{employeeCode:'asc'}}),
  ]);
  return <section className="max-w-4xl space-y-5"><Link href="/admin/payroll">Back to payroll</Link>
    <h1 className="font-display text-3xl">Monthly attendance</h1>
    <form className="flex gap-3"><label>Month <input type="month" required name="period" defaultValue={period}/></label><button>View month</button></form>
    <MonthlyAttendance key={period} period={period} rows={rows} employees={employees} editable={canWriteFinance(actor)}/></section>;
}
