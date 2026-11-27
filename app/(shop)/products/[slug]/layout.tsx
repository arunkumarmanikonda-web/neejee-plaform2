import type { Metadata } from 'next';
import { buildProductJsonLd, buildProductMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return buildProductMetadata(params.slug);
}

export default async function ProductSeoLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

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
      {children}
    </>
  );
}
