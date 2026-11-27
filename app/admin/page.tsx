import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { canOpenAdminPage } from '@/lib/admin/shop-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const work = [
  {title:'Catalogue & photography',links:[
    ['Add a product','/admin/products/new','Capture the piece, record its details and prepare its listing.'],
    ['Products','/admin/products','Review drafts, prices and published pieces.'],
    ['Inventory','/admin/inventory','Check available stock and variants.'],
  ]},
  {title:'Customers & orders',links:[
    ['Fashion enquiries','/admin/enquiries','Reply to questions about the sarees and suit sets.'],
    ['Orders','/admin/orders','Review purchases and fulfilment.'],
    ['Returns','/admin/finance/returns','Review return requests and their progress.'],
    ['Customers','/admin/customers','Find an account or follow up on an enquiry.'],
  ]},
  {title:'Shop operations',links:[
    ['Bahi Khata','/admin/keeper','Inspect the latest shop checks and follow up on exceptions.'],
    ['Finance','/admin/finance','Review accounts, ledgers and reconciliation.'],
    ['Team & roles','/admin/team','Manage staff access.'],
    ['Site content','/admin/cms','Update the published shop pages.'],
  ]},
];

export default async function AdminDashboard() {
  const user = await getSession();
  if (!user) return null;
  const sections = work.map(group=>({...group,links:group.links.filter(([,href])=>canOpenAdminPage(user.role,href))})).filter(group=>group.links.length);
  return <div className="max-w-6xl mx-auto">
    <header className="mb-8"><h1 className="font-display text-4xl sm:text-5xl text-banarasi">Shop desk</h1>
      <p className="font-ui text-mitti mt-2">Welcome, {user.name?.trim().split(/\s+/)[0] || user.email.split('@')[0]}.</p></header>
    <div className="grid gap-6 lg:grid-cols-2">{sections.map(group=><section key={group.title} className="border border-beige bg-ivory p-5">
      <h2 className="font-display text-2xl mb-2">{group.title}</h2>
      {group.links.map(([title,href,detail])=><Link href={href} key={href} className="block rounded py-3 px-2 hover:bg-beige focus-visible:outline">
        <span className="font-ui font-semibold text-banarasi">{title}</span><span className="block mt-1 font-ui text-sm text-mitti">{detail}</span>
      </Link>)}</section>)}</div>
  </div>;
}
