// app/recovery/opt-out/page.tsx
// v26.3a — One-click opt-out from recovery emails. Link target from the
// "No more notes, please" footer link in each recovery email.
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function OptOutPage({ searchParams }: { searchParams: { cart?: string } }) {
  const cartId = searchParams?.cart;
  let result: 'done' | 'not-found' | 'no-id' = 'no-id';

  if (cartId) {
    const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } });
    if (cart) {
      await prisma.abandonedCart.update({
        where: { id: cartId },
        data: { optedOut: true, nextActionAt: null } as any,
      });
      // Also opt-out future carts from the same email
      await prisma.abandonedCart.updateMany({
        where: { email: cart.email },
        data: { optedOut: true, nextActionAt: null } as any,
      });
      result = 'done';
    } else {
      result = 'not-found';
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#F4EFE6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      padding: '24px',
    }}>
      <div style={{
        background: '#FFFEFB',
        padding: '48px 36px',
        maxWidth: 480,
        textAlign: 'center',
        border: '1px solid #E8E0D2',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          color: '#1A1613',
          fontSize: 28,
          letterSpacing: '0.12em',
          marginBottom: 8,
        }}>
          NEE<span style={{ color: '#B43F3F' }}>·</span>JEE
        </div>
        <div style={{ fontSize: 11, color: '#A89A86', letterSpacing: '0.25em', marginBottom: 32 }}>
          HERITAGE CRAFTS · INDIA
        </div>

        {result === 'done' && (
          <>
            <h1 style={{ fontSize: 22, color: '#1A1613', fontWeight: 400, marginBottom: 16 }}>
              Understood. No more notes.
            </h1>
            <p style={{ fontSize: 15, color: '#3A3128', lineHeight: 1.7 }}>
              We will not send any more recovery emails to this address.<br />
              Should you ever wish to return, the door is always open.
            </p>
          </>
        )}
        {result === 'not-found' && (
          <>
            <h1 style={{ fontSize: 22, color: '#1A1613', fontWeight: 400, marginBottom: 16 }}>
              That link has rested.
            </h1>
            <p style={{ fontSize: 15, color: '#3A3128', lineHeight: 1.7 }}>
              We couldn't find this trunk. It may already have been recovered or removed.
            </p>
          </>
        )}
        {result === 'no-id' && (
          <>
            <h1 style={{ fontSize: 22, color: '#1A1613', fontWeight: 400, marginBottom: 16 }}>
              Missing reference
            </h1>
            <p style={{ fontSize: 15, color: '#3A3128', lineHeight: 1.7 }}>
              This opt-out link needs a valid cart reference. Please use the link from your email.
            </p>
          </>
        )}

        <div style={{ marginTop: 36 }}>
          <a href="/" style={{
            background: '#1A1613',
            color: '#F4EFE6',
            textDecoration: 'none',
            padding: '12px 28px',
            fontSize: 12,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'inline-block',
          }}>Return home</a>
        </div>
      </div>
    </main>
  );
}
