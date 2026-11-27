import type { SessionRole } from '@/lib/auth';

const managers: SessionRole[] = ['ADMIN','SUPER_ADMIN'];
const editors: SessionRole[] = [...managers,'CONTENT_EDITOR'];
const marketing: SessionRole[] = ['MARKETING_OPERATOR','MARKETING_MANAGER'];
const finance: SessionRole[] = [...managers,'FINANCE','FINANCE_OPERATOR'];
const staff = [...editors,...marketing,...finance,'QC_TEAM'];

const readers: Record<string,readonly SessionRole[]> = {
  enquiries: managers, team: managers, orders: managers, keeper: managers, customers: [...managers,...marketing,'TELECALLER'],
  inventory: editors, assets: editors, cms: editors, reviews: editors,
  finance, payroll: finance, settings: [...managers,'FINANCE'], 'legal-entity': [...managers,'FINANCE'],
  products: [...editors,...marketing],
};

export function canOpenAdminPage(role: SessionRole, href: string) {
  if (!staff.includes(role)) return false;
  const section = href.split(/[?#]/)[0].split('/')[2];
  if (href.split(/[?#]/)[0].startsWith('/admin/products/') && !editors.includes(role)) return false;
  return !section || !readers[section] || readers[section].includes(role);
}
