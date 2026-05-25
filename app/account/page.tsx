'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { User, Package, Heart, MapPin, Sparkles, LogOut } from 'lucide-react';

export default function AccountPage() {
  const [tab, setTab] = useState('orders');

  // PRODUCTION: fetch from /api/me — show login form if not signed in
  const user = { name: 'Aanya M.', email: 'aanya@example.com', joinedAt: '2026-01-12' };

  return (
    <>
      <Header />
      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-12">
        <p className="label text-madder">YOUR TRUNK</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Namaste, {user.name.split(' ')[0]}.</h1>
        <p className="font-italic italic text-mitti mt-2">Member since {new Date(user.joinedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <div className="madder-divider mt-4"></div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-12 mt-12">
          <aside className="space-y-1 font-ui text-sm">
            {[
              { id: 'orders', label: 'My Orders', icon: Package },
              { id: 'wishlist', label: 'Wishlist', icon: Heart },
              { id: 'addresses', label: 'Addresses', icon: MapPin },
              { id: 'ai', label: 'AI Previews', icon: Sparkles },
              { id: 'profile', label: 'Profile', icon: User },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${tab === t.id ? 'bg-madder text-ivory' : 'hover:bg-beige text-kohl'}`}>
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            ))}
            <Link href="/api/auth/logout" className="w-full flex items-center gap-3 px-3 py-2 rounded text-monsoon hover:bg-beige mt-8">
              <LogOut className="w-4 h-4" /><span>Sign out</span>
            </Link>
          </aside>

          <div>
            {tab === 'orders' && <OrdersTab />}
            {tab === 'wishlist' && <WishlistTab />}
            {tab === 'addresses' && <AddressesTab />}
            {tab === 'ai' && <AiTab />}
            {tab === 'profile' && <ProfileTab user={user} />}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

function OrdersTab() {
  const orders = [
    { id: 'NEE-AB4521', date: '2026-05-18', total: '₹24,500', status: 'PACKED', items: 1, tracking: null },
    { id: 'NEE-AB3982', date: '2026-04-22', total: '₹3,200', status: 'DELIVERED', items: 2, tracking: 'TRACK' },
    { id: 'NEE-AB3215', date: '2026-03-08', total: '₹18,750', status: 'DELIVERED', items: 3, tracking: 'TRACK' },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">My orders ({orders.length})</h2>
      <div className="space-y-4">
        {orders.map(o => (
          <div key={o.id} className="bg-beige p-6 flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <p className="font-display text-lg">{o.id}</p>
              <p className="label">{new Date(o.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} · {o.items} item(s)</p>
            </div>
            <p className="font-display text-xl">{o.total}</p>
            <span className={`badge-founder ${o.status === 'DELIVERED' ? 'bg-neem' : 'bg-mitti'}`}>{o.status}</span>
            <Link href={`/orders/${o.id}`} className="btn-outline">VIEW</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function WishlistTab() {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Saved for later</h2>
      <p className="font-italic italic text-mitti">Heart any piece to save it here.</p>
    </div>
  );
}

function AddressesTab() {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Addresses</h2>
      <div className="bg-beige p-6">
        <p className="label text-madder">DEFAULT · HOME</p>
        <p className="font-display text-lg mt-2">Aanya M.</p>
        <p className="font-body text-kohl/85 mt-1">A-12, Sea View Apts, Worli<br />Mumbai, Maharashtra · 400018<br />+91 98213 12345</p>
        <button className="btn-outline mt-4">EDIT</button>
      </div>
      <button className="btn-primary mt-6">+ ADD NEW ADDRESS</button>
    </div>
  );
}

function AiTab() {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Your AI previews</h2>
      <p className="font-italic italic text-mitti">Previews are auto-deleted 30 days after creation.</p>
      <div className="mt-6 p-6 bg-beige border-l-2 border-madder">
        <p className="label text-madder">PRIVACY</p>
        <p className="font-body text-kohl/85 mt-2">We never sell or share your photos. You can delete all AI previews now using the button below.</p>
        <button className="btn-outline mt-4">DELETE ALL PREVIEWS</button>
      </div>
    </div>
  );
}

function ProfileTab({ user }: { user: any }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-kohl mb-6">Profile</h2>
      <div className="space-y-3 max-w-md">
        <label className="block"><span className="label">NAME</span><input defaultValue={user.name} className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui" /></label>
        <label className="block"><span className="label">EMAIL</span><input defaultValue={user.email} className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui" /></label>
        <label className="block"><span className="label">PHONE</span><input placeholder="+91" className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui" /></label>
        <button className="btn-primary">SAVE CHANGES</button>
      </div>
    </div>
  );
}
