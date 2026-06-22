// Public seller application endpoint.
// Anyone can submit; creates a Seller row in KYC PENDING status + emails admin.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ApplySchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(/^\+\d{7,15}$/),
  craft: z.string().min(2),
  region: z.string().min(2),
  cluster: z.string().optional(),
  yearsOfPractice: z.number().int().min(0).max(100).optional(),
  story: z.string().min(50).max(3000),
  portfolio: z.array(z.string().url()).min(1).max(10),
  pan: z.string().optional(),
  gstin: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ApplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Reject if email already used
    const existing = await prisma.seller.findUnique({ where: { email: d.email } });
    if (existing) {
      return NextResponse.json({ error: 'A seller application with this email already exists' }, { status: 409 });
    }

    // Generate slug from business name
    const baseSlug = slugify(d.businessName);
    let slug = baseSlug;
    for (let n = 2; n < 20; n++) {
      const clash = await prisma.seller.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${n}`;
    }

    // Link to existing user account if logged in (or by email match)
    const session = await getSession();
    let userId: string | null = session?.id ?? null;
    if (!userId) {
      const u = await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } });
      userId = u?.id ?? null;
    }

    const seller = await prisma.seller.create({
      data: {
        userId,
        slug,
        businessName: d.businessName,
        contactName: d.contactName,
        email: d.email,
        phone: d.phone,
        craft: d.craft,
        region: d.region,
        cluster: d.cluster,
        yearsOfPractice: d.yearsOfPractice,
        story: d.story,
        portfolio: d.portfolio,
        pan: d.pan,
        gstin: d.gstin,
        kycStatus: 'PENDING',
      },
    });

    // Email applicant
    sendEmail({
      to: d.email,
      subject: 'Your NEEJEE seller application — received',
      html: sellerApplicationReceivedEmail(d.contactName, d.businessName),
    }).catch(() => {});

    // Email admin (best-effort)
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || 'hello@neejee.com';
    sendEmail({
      to: adminEmail,
      subject: `New seller application — ${d.businessName}`,
      html: `<p>A new seller has applied to NEEJEE.</p>
             <p><strong>${d.businessName}</strong> · ${d.craft} · ${d.region}<br/>
             ${d.contactName} · ${d.email} · ${d.phone}</p>
             <p>Review at <a href="https://www.neejee.com/admin/sellers">/admin/sellers</a>.</p>`,
    }).catch(() => {});

    return NextResponse.json({ success: true, sellerId: seller.id, slug: seller.slug });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function sellerApplicationReceivedEmail(name: string, businessName: string) {
  const first = (name || 'friend').split(' ')[0];
  return `
  <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    <div style="background:#1A1613;padding:36px;text-align:center;">
      <div style="font-family:Georgia,serif;color:#F4EFE6;font-size:32px;letter-spacing:0.18em;">NEE<span style="display:inline-block;width:6px;height:6px;background:#8B2E2A;border-radius:50%;margin:0 8px;vertical-align:middle"></span>JEE</div>
      <p style="color:#A47E3B;font-size:10px;letter-spacing:0.35em;margin-top:14px;font-style:italic;">FOUND · PERSONAL</p>
    </div>
    <div style="padding:48px 36px;">
      <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 12px;">APPLICATION RECEIVED</p>
      <h1 style="font-size:30px;color:#1A1613;margin:0 0 18px;font-weight:400;">Namaste, ${first}.</h1>
      <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 18px;">
        Thank you for sharing <strong>${businessName}</strong> with us.
      </p>
      <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
        We read every application personally. It usually takes 3–5 working days while we look at your portfolio, listen to your craft, and decide together whether NEEJEE is the right home for your work.
      </p>
      <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">
        We will write back from this same address. If you have anything more to share — a story, a photograph, a person who introduced you — simply reply to this note.
      </p>
      <p style="color:#1A1613;line-height:1.8;font-size:14px;margin:0 0 0;font-style:italic;">
        With respect for your work,<br/>
        — Nidhi, Founder
      </p>
    </div>
    <div style="background:#F4EFE6;padding:24px;text-align:center;color:#6B6862;font-size:11px;">
      <a href="https://www.neejee.com" style="color:#8B2E2A;text-decoration:none;">www.neejee.com</a>
    </div>
  </div>`;
}
