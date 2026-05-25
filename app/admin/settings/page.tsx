export default function AdminSettings() {
  return (
    <>
      <p className="label text-madder">CONFIG</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Settings</h1>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-2 gap-8 mt-12">
        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">STORE</p>
          <div className="space-y-3 font-ui text-sm">
            <label className="block"><span className="label">STORE NAME</span><input defaultValue="NEEJEE" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">SUPPORT EMAIL</span><input defaultValue="hello@neejee.com" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">SUPPORT PHONE</span><input defaultValue="+91 98765 12345" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">GSTIN</span><input placeholder="27AAACN1234A1Z5" className="w-full mt-1 p-2 bg-ivory" /></label>
          </div>
        </section>

        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">PAYMENTS</p>
          <div className="space-y-3 font-ui text-sm">
            <label className="block"><span className="label">RAZORPAY KEY ID</span><input placeholder="rzp_test_..." className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">RAZORPAY SECRET</span><input type="password" placeholder="••••••••" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> ACCEPT COD</label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> ACCEPT UPI</label>
          </div>
        </section>

        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">SHIPPING</p>
          <div className="space-y-3 font-ui text-sm">
            <label className="block"><span className="label">SHIPROCKET API TOKEN</span><input type="password" placeholder="••••••••" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">FREE SHIPPING ABOVE (₹)</span><input defaultValue="2500" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">METRO RATE (₹)</span><input defaultValue="100" className="w-full mt-1 p-2 bg-ivory" /></label>
            <label className="block"><span className="label">TIER 2/3 RATE (₹)</span><input defaultValue="150" className="w-full mt-1 p-2 bg-ivory" /></label>
          </div>
        </section>

        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">INTEGRATIONS</p>
          <div className="space-y-3 font-ui text-sm">
            <label className="flex items-center justify-between"><span>Klaviyo (Email)</span><span className="text-neem text-xs">● CONNECTED</span></label>
            <label className="flex items-center justify-between"><span>WATI (WhatsApp)</span><span className="text-neem text-xs">● CONNECTED</span></label>
            <label className="flex items-center justify-between"><span>Cloudinary (Media)</span><span className="text-neem text-xs">● CONNECTED</span></label>
            <label className="flex items-center justify-between"><span>Algolia (Search)</span><span className="text-monsoon text-xs">○ NOT SET</span></label>
            <label className="flex items-center justify-between"><span>GA4 (Analytics)</span><span className="text-neem text-xs">● CONNECTED</span></label>
            <label className="flex items-center justify-between"><span>Replicate (AI)</span><span className="text-neem text-xs">● CONNECTED</span></label>
          </div>
        </section>
      </div>

      <button className="btn-primary mt-12">SAVE ALL SETTINGS</button>
    </>
  );
}
