import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { storageConfigured } from '@/lib/storage';
import { getIssuerProfile } from '@/lib/finance/legal-entity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminSettings() {
  const user = await getSession();
  // v23.40.16 â€” Store Information now reads from the live Legal Entity record
  // so editing in /admin/legal-entity reflects everywhere automatically.
  const issuer = await getIssuerProfile();
  const env = {
    database: !!process.env.DATABASE_URL,
    directUrl: !!process.env.DIRECT_URL,
    authSecret: !!process.env.AUTH_SECRET,
    razorpayKey: !!process.env.RAZORPAY_KEY_ID,
    razorpaySecret: !!process.env.RAZORPAY_KEY_SECRET,
    shiprocketEmail: !!process.env.SHIPROCKET_EMAIL,
    shiprocketPassword: !!process.env.SHIPROCKET_PASSWORD,
    watiKey: !!process.env.WATI_API_KEY,
    resendKey: !!process.env.RESEND_API_KEY,
    replicateToken: !!process.env.REPLICATE_API_TOKEN,
    falKey: !!process.env.FAL_KEY,
    openaiKey: !!process.env.OPENAI_API_KEY,
    supabaseUrl: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    storage: storageConfigured(),
    baseUrlConfigured: !!process.env.NEXT_PUBLIC_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
  };

  return (
    <>
      <p className="label text-madder">CONFIG</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Settings</h1>
      <p className="font-italic italic text-mitti mt-2">Platform configuration and status</p>
      <div className="madder-divider mt-4"></div>

      {/* Quick links to nested settings pages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        <Link href="/admin/settings/shipping" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">SHIPPING ZONES</p>
          <p className="font-display text-kohl mt-1">Configure rates by location</p>
          <p className="text-xs text-mitti mt-1 italic">Per-state / pincode Â· nearest â‚¹50 Â· inclusive/extra</p>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-12">
        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">SIGNED-IN ADMIN</p>
          <div className="space-y-2 font-ui text-sm">
            <Row label="Name" value={user?.name || 'â€”'} />
            <Row label="Email" value={user?.email || 'â€”'} />
            <Row label="Role" value={user?.role?.replace(/_/g, ' ') || 'â€”'} />
            <Row label="User ID" value={user?.id || 'â€”'} mono />
          </div>
        </section>

        <section className="bg-beige p-8">
          <p className="label text-madder mb-4">ENVIRONMENT STATUS</p>
          <div className="space-y-2 font-ui text-sm">
            <Row label="NODE_ENV" value={env.nodeEnv || 'â€”'} />
            <Row label="DATABASE_URL" value={env.database ? 'âœ“ Connected' : 'âœ— Not set'} color={env.database ? 'text-neem' : 'text-madder'} />
            <Row label="DIRECT_URL" value={env.directUrl ? 'âœ“ Set' : 'âš  Not set (Prisma migrations may fail)'} color={env.directUrl ? 'text-neem' : 'text-haldi'} />
            <Row label="AUTH_SECRET" value={env.authSecret ? 'configured' : 'missing'} />
            <Row label="SUPABASE_STORAGE" value={env.storage ? 'âœ“ Configured' : 'âœ— Not configured'} color={env.storage ? 'text-neem' : 'text-madder'} />
            <Row label="RAZORPAY_KEY_ID" value={env.razorpayKey ? 'âœ“ Set' : 'âœ— Not set'} color={env.razorpayKey ? 'text-neem' : 'text-madder'} />
            <Row label="RAZORPAY_KEY_SECRET" value={env.razorpaySecret ? 'âœ“ Set' : 'âœ— Not set'} color={env.razorpaySecret ? 'text-neem' : 'text-madder'} />
            <Row label="SHIPROCKET" value={(env.shiprocketEmail && env.shiprocketPassword) ? 'âœ“ Set' : 'âœ— Not set (manual fulfillment)'} color={(env.shiprocketEmail && env.shiprocketPassword) ? 'text-neem' : 'text-haldi'} />
            <Row label="WATI (WhatsApp)" value={env.watiKey ? 'âœ“ Set' : 'âœ— Not set'} color={env.watiKey ? 'text-neem' : 'text-haldi'} />
            <Row label="RESEND (Email)" value={env.resendKey ? 'âœ“ Set' : 'âœ— Not set'} color={env.resendKey ? 'text-neem' : 'text-haldi'} />
            <Row label="FAL_KEY (AI Mirror / Space)" value={env.falKey ? 'âœ“ Set' : 'âœ— Not set'} color={env.falKey ? 'text-neem' : 'text-haldi'} />
            <Row label="OPENAI (Gift / Content)" value={env.openaiKey ? 'âœ“ Set' : 'âœ— Not set'} color={env.openaiKey ? 'text-neem' : 'text-haldi'} />
            <Row label="REPLICATE (legacy)" value={env.replicateToken ? 'âœ“ Set' : 'âœ— Not set'} color={env.replicateToken ? 'text-neem' : 'text-mitti/40'} />
            <Row label="NEXT_PUBLIC_BASE_URL" value={env.baseUrlConfigured ? 'configured' : 'missing'} />
          </div>
        </section>

        {!env.storage && (
          <section className="bg-beige p-8 col-span-2 border-l-4 border-madder">
            <p className="label text-madder mb-3">âš  IMAGE UPLOAD NOT YET CONFIGURED</p>
            <p className="font-italic italic text-mitti mb-3">
              To enable product image uploads, add these to Vercel â†’ Environment Variables, then redeploy:
            </p>
            <div className="bg-ivory p-4 font-mono text-xs space-y-1">
              <p><span className="text-madder">NEXT_PUBLIC_SUPABASE_URL</span> should be configured in environment only, not documented with a live value here.</p>
              <p><span className="text-madder">SUPABASE_SERVICE_ROLE_KEY</span> = (from Supabase â†’ Settings â†’ API â†’ service_role key)</p>
              <p><span className="text-madder">SUPABASE_STORAGE_BUCKET</span> = neejee-media (default)</p>
            </div>
            <p className="font-italic italic text-mitti text-xs mt-3">
              Also create a public bucket called <span className="font-mono">neejee-media</span> in Supabase Dashboard â†’ Storage.
            </p>
          </section>
        )}

        <section className="bg-beige p-8 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="label text-madder">STORE INFORMATION</p>
            <Link href="/admin/legal-entity" className="text-xs text-banarasi hover:underline">
              Edit in Legal Entity â†’
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6 font-ui text-sm">
            <div className="space-y-2">
              <Row label="Legal name"    value={issuer.legalName} />
              <Row label="Brand name"    value={issuer.brandName} />
              <Row label="Tagline"       value={issuer.tagline} />
              <Row label="Support email" value={issuer.email || 'â€”'} />
              <Row label="Support phone" value={issuer.phone || 'â€”'} />
              <Row label="Authorised signatory" value={`${issuer.signatory}${issuer.signatoryTitle ? ` Â· ${issuer.signatoryTitle}` : ''}`} />
            </div>
            <div className="space-y-2">
              <Row label="GSTIN" value={issuer.gstin || 'â€”'} mono />
              <Row label="PAN"   value={issuer.pan   || 'â€”'} mono />
              <Row label="Address" value={issuer.address || 'â€”'} />
              <Row label="Bank"  value={issuer.bankName ? `${issuer.bankName}${issuer.bankAccountNumber ? ` Â· ${issuer.bankAccountNumber}` : ''}` : 'â€”'} />
              <Row label="IFSC"  value={issuer.bankIfsc || 'â€”'} mono />
              <Row label="Currency" value="INR (â‚¹)" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Row({ label, value, color = 'text-kohl', mono = false }: any) {
  return (
    <div className="flex justify-between items-baseline border-b border-mitti/10 pb-2">
      <span className="label text-mitti">{label}</span>
      <span className={`${color} ${mono ? 'font-mono text-xs' : ''} truncate ml-2 max-w-[60%]`}>{value}</span>
    </div>
  );
}



