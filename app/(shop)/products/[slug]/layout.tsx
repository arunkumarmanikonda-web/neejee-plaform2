import type { Metadata } from 'next';
import { buildProductJsonLd, buildProductMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return buildProductMetadata(params.slug);
}

export default async function ProductSeoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const jsonLd = await buildProductJsonLd(params.slug);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <div className="neejee-pdp-v25">{children}</div>
    </>
  );
}
