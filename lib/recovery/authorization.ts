import { timingSafeEqual } from 'node:crypto';

function matches(header: string | null, expected: string | undefined) {
  if (!header || !expected) return false;
  const a = Buffer.from(header);
  const b = Buffer.from('Bearer ' + expected);
  return a.length === b.length && timingSafeEqual(a,b);
}

export function recoveryAuthorized(request: Request) {
  const header = request.headers.get('authorization');
  if (matches(header,process.env.CRON_SECRET)) return true;
  // A commissioning credential can invoke only these two recovery jobs, for one day.
  const token = process.env.RECOVERY_TRIGGER_KEY;
  const issued = Number(token?.split('.')[0]);
  const age = Date.now() - issued;
  return Number.isSafeInteger(issued) && age >= 0 && age <= 86_400_000 && matches(header,token);
}
