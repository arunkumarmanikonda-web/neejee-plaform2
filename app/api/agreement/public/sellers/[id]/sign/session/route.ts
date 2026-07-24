import { NextRequest, NextResponse } from "next/server";
import { assertSigningToken, buildSellerSigningUrl, getRequestOrigin, loadSellerForSigning, readAgreementWorkflow } from "@/lib/agreement-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = new URL(request.url).searchParams.get("token") || "";
    const seller = await loadSellerForSigning(id);

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const workflow = readAgreementWorkflow(seller.autoKycSummary);
    assertSigningToken(workflow, token);

    return NextResponse.json({
      ok: true,
      seller: {
        id: seller.id,
        businessName: seller.businessName || "",
        contactName: seller.contactName || "",
        email: seller.email || "",
        phone: workflow.sellerSignaturePhone || seller.phone || "",
      },
      workflow: {
        status: workflow.status || "",
        sellerSignatureStatus: workflow.sellerSignatureStatus || "",
        sellerSigningUrl: workflow.sellerSigningUrl || buildSellerSigningUrl(getRequestOrigin(request), id, token),
        sellerSignaturePhoneMasked: workflow.sellerSignaturePhoneMasked || "",
        sellerSignatureImageUrl: workflow.sellerSignatureImageUrl || "",
        sellerSignatureProcessedUrl: workflow.sellerSignatureProcessedUrl || "",
        sellerSignatureOtpRequestedAt: workflow.sellerSignatureOtpRequestedAt || "",
        sellerSignatureOtpVerifiedAt: workflow.sellerSignatureOtpVerifiedAt || "",
        sellerSignedAt: workflow.sellerSignedAt || "",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load signing session" },
      { status: 401 }
    );
  }
}