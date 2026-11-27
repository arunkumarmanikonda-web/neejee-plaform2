'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNavLink({href,className,children}:{href:string;className:string;children:React.ReactNode}) {
  const active = usePathname() === href;
  return <Link prefetch={false} href={href} className={className+(active?' bg-mitti/40 text-ivory':'')} aria-current={active?'page':undefined}
    onClick={event=>{ const menu = event.currentTarget.closest('details'); if (menu) menu.open = false; }}>
    {children}
  </Link>;
}
