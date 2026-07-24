import SellerAgreementSignClient from "./SellerAgreementSignClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SellerAgreementSignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;
  const token = String(qs?.token || "");

  return <SellerAgreementSignClient id={id} token={token} />;
}