import Link from 'next/link';
import { LayoutDashboard, Package, ShoppingBag, Users, FileText, Store, Sparkles, Settings } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-ivory">
      <aside className="bg-kohl text-ivory p-6 sticky top-0 h-screen overflow-y-auto">
        <Link href="/" className="brand-wordmark text-2xl block">NE<span className="bindi"></span>JEE</Link>
        <p className="font-italic italic text-beige text-sm mt-1">Admin</p>
        <p className="label text-banarasi mt-6 mb-4">DASHBOARD</p>
        <nav className="space-y-1 font-ui text-sm">
          {[
            { href: '/admin', label: 'Overview', icon: LayoutDashboard },
            { href: '/admin/products', label: 'Products', icon: Package },
            { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
            { href: '/admin/customers', label: 'Customers', icon: Users },
            { href: '/admin/cms', label: 'CMS', icon: FileText },
            { href: '/admin/sellers', label: 'Sellers', icon: Store },
            { href: '/admin/ai', label: 'AI Manager', icon: Sparkles },
            { href: '/admin/settings', label: 'Settings', icon: Settings },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded text-beige/80 hover:bg-mitti/40 hover:text-ivory transition-colors">
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-mitti/30">
          <p className="label text-banarasi">SIGNED IN AS</p>
          <p className="font-italic italic text-beige mt-1">Nidhi Chauhan</p>
          <p className="font-ui text-[10px] text-beige/60 tracking-widest mt-1">SUPER ADMIN</p>
        </div>
      </aside>
      <main className="p-12">{children}</main>
    </div>
  );
}
