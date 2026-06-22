// Spend anomaly detection.
// For each ExpenseCategory, compute:
//   - this-week actual spend (in paise)
//   - 4-week rolling mean (excluding this week)
//   - 4-week rolling stddev
//   - z-score = (actual - mean) / stddev
// Flag categories with z > 1.5 as anomalies. Severity: HIGH (z>3), MED (z>2), LOW (z>1.5).
// Also flag categories that crossed 80% / 100% of their monthly budget.

import { prisma } from '@/lib/prisma';
import { periodThisWeek } from './period';

export type AnomalyDetection = {
  categoryId: string;
  categoryCode: string;
  categoryLabel: string;
  // Anomaly stats
  actualPaise: number;
  meanPaise: number;
  stdDevPaise: number;
  zScore: number;
  severity: 'HIGH' | 'MED' | 'LOW';
  // Budget overlay (this month)
  budgetPaise: number | null;
  monthSpendPaise: number | null;
  budgetPctUsed: number | null;
  budgetAlert: 'OVER_BUDGET' | 'NEAR_BUDGET' | null;
};

/** Run anomaly detection. Returns flagged categories. */
export async function detectAnomalies(): Promise<AnomalyDetection[]> {
  const thisWk = periodThisWeek();
  const fourWeeksAgo = new Date(thisWk.from.getTime() - 4 * 7 * 86_400_000);
  const oneWeekAgo = thisWk.from;

  // Aggregate by week × category over the last 5 weeks
  // We use Postgres date_trunc('week', ...) for simplicity
  type Row = { categoryId: string; weekStart: Date; total: number };
  let weekly: Row[] = [];
  try {
    weekly = await prisma.$queryRaw<Row[]>`
      SELECT
        "categoryId",
        date_trunc('week', "incurredOn")::timestamp AS "weekStart",
        SUM("amountPaise")::int AS "total"
      FROM "Expense"
      WHERE "status" = 'APPROVED'
        AND "incurredOn" >= ${fourWeeksAgo}
        AND "incurredOn" < ${thisWk.to}
      GROUP BY "categoryId", date_trunc('week', "incurredOn")
    `;
  } catch {
    return [];
  }

  // Bucket by category
  const byCat = new Map<string, { weekly: Map<number, number>; thisWeek: number }>();
  for (const r of weekly) {
    const weekTs = new Date(r.weekStart).getTime();
    let entry = byCat.get(r.categoryId);
    if (!entry) {
      entry = { weekly: new Map(), thisWeek: 0 };
      byCat.set(r.categoryId, entry);
    }
    if (weekTs >= oneWeekAgo.getTime()) {
      entry.thisWeek += r.total;
    } else {
      entry.weekly.set(weekTs, r.total);
    }
  }

  // Categories + budgets
  const [cats, budgets] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { id: { in: Array.from(byCat.keys()) } },
      select: { id: true, code: true, label: true },
    }),
    (() => {
      const ist = new Date(thisWk.from.getTime() + 5.5 * 3600 * 1000);
      return prisma.marketingBudget.findMany({
        where: { periodYear: ist.getUTCFullYear(), periodMonth: ist.getUTCMonth() + 1 },
        select: { expenseCategoryId: true, budgetPaise: true },
      });
    })(),
  ]);
  const catMap = new Map(cats.map(c => [c.id, c]));
  const budgetMap = new Map(budgets.map(b => [b.expenseCategoryId, b.budgetPaise]));

  // For month spend, pull MTD per-category sum
  const monthStart = (() => {
    const ist = new Date(thisWk.from.getTime() + 5.5 * 3600 * 1000);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, -5, -30));
  })();
  const monthRows = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: {
      status: 'APPROVED',
      incurredOn: { gte: monthStart, lt: thisWk.to },
      categoryId: { in: Array.from(byCat.keys()) },
    },
    _sum: { amountPaise: true },
  });
  const monthSpend = new Map(monthRows.map(r => [r.categoryId, r._sum.amountPaise || 0]));

  const out: AnomalyDetection[] = [];
  for (const [categoryId, entry] of byCat.entries()) {
    const cat = catMap.get(categoryId);
    if (!cat) continue;
    const past = Array.from(entry.weekly.values());
    if (past.length < 2) continue;   // not enough history
    const mean = past.reduce((s, v) => s + v, 0) / past.length;
    const variance = past.reduce((s, v) => s + (v - mean) ** 2, 0) / past.length;
    const stdDev = Math.sqrt(variance);
    const zScore = stdDev > 0 ? (entry.thisWeek - mean) / stdDev : 0;

    const budgetPaise = budgetMap.get(categoryId) ?? null;
    const monthSpendPaise = monthSpend.get(categoryId) ?? null;
    const budgetPctUsed = (budgetPaise && monthSpendPaise != null && budgetPaise > 0)
      ? Math.round((monthSpendPaise / budgetPaise) * 100)
      : null;
    const budgetAlert = budgetPctUsed == null ? null
      : budgetPctUsed >= 100 ? 'OVER_BUDGET'
      : budgetPctUsed >= 80  ? 'NEAR_BUDGET'
      : null;

    const severity: 'HIGH' | 'MED' | 'LOW' | null =
      zScore > 3   ? 'HIGH' :
      zScore > 2   ? 'MED'  :
      zScore > 1.5 ? 'LOW'  : null;

    if (severity || budgetAlert) {
      out.push({
        categoryId,
        categoryCode: cat.code,
        categoryLabel: cat.label,
        actualPaise: entry.thisWeek,
        meanPaise: Math.round(mean),
        stdDevPaise: Math.round(stdDev),
        zScore: Math.round(zScore * 100) / 100,
        severity: severity || 'LOW',
        budgetPaise,
        monthSpendPaise,
        budgetPctUsed,
        budgetAlert,
      });
    }
  }

  return out.sort((a, b) => b.zScore - a.zScore);
}

/** Persist current detections, return inserted rows. */
export async function persistAnomalies(): Promise<number> {
  const flagged = await detectAnomalies();
  if (flagged.length === 0) return 0;
  const thisWk = periodThisWeek();
  let n = 0;
  for (const f of flagged) {
    if (!f.severity) continue;
    await prisma.financeAnomalyAlert.create({
      data: {
        categoryId: f.categoryId,
        periodStart: thisWk.from,
        periodEnd: thisWk.to,
        actualPaise: f.actualPaise,
        meanPaise: f.meanPaise,
        stdDevPaise: f.stdDevPaise,
        zScore: f.zScore,
        severity: f.severity,
      },
    }).catch(() => {});
    n += 1;
  }
  return n;
}
