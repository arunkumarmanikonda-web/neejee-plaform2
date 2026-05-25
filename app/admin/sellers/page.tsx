import { artisans } from '@/lib/data';

export default function AdminSellers() {
  return (
    <>
      <p className="label text-madder">MARKETPLACE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Sellers · Artisans</h1>
      <p className="font-italic italic text-mitti mt-2">{artisans.length} artisan partners onboarded</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-4 gap-4 mt-8">
        <div className="bg-beige p-5"><p className="label">ACTIVE SELLERS</p><p className="font-display text-3xl mt-2">{artisans.length}</p></div>
        <div className="bg-beige p-5"><p className="label">PENDING KYC</p><p className="font-display text-3xl mt-2 text-haldi">12</p></div>
        <div className="bg-beige p-5"><p className="label">PAYOUTS DUE</p><p className="font-display text-3xl mt-2">₹4.2L</p></div>
        <div className="bg-beige p-5"><p className="label">QC PASS RATE</p><p className="font-display text-3xl mt-2 text-neem">94%</p></div>
      </div>

      <div className="flex justify-between items-center mt-12">
        <p className="label text-madder">ARTISAN PARTNERS</p>
        <button className="btn-primary">+ INVITE SELLER</button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {artisans.map(a => (
          <div key={a.slug} className="bg-beige p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg">{a.name}</p>
                <p className="font-italic italic text-mitti text-sm mt-1">{a.craft}</p>
                <p className="label text-monsoon mt-2">{a.region.toUpperCase()}</p>
              </div>
              <span className="badge-founder bg-neem">VERIFIED</span>
            </div>
            <p className="font-body text-sm text-kohl/85 mt-4">{a.story}</p>
            <div className="flex gap-3 mt-4 text-xs font-ui text-monsoon">
              <span>{a.yearsOfPractice} yrs experience</span>
              <span>·</span>
              <span>{a.productIds.length} SKU{a.productIds.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
