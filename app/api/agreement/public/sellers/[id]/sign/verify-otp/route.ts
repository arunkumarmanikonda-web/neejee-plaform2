import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, verifyOtp } from "@/lib/otp";
import { assertSigningToken, loadSellerForSigning, readAgreementWorkflow, updateAgreementWorkflow } from "@/lib/agreement-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || "");
    const code = String(body?.code || "").trim();

    const seller = await loadSellerForSigning(id);
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const workflow = readAgreementWorkflow(seller.autoKycSummary);
    assertSigningToken(workflow, token);

    const phone = normalizePhone(String(body?.phone || workflow?.sellerSignaturePhone || seller.phone || ""));
    if (!phone) {
      return NextResponse.json({ error: "Valid phone is required" }, { status: 400 });
    }

    const verification = await verifyOtp({
      phone,
      code,
      purpose: "seller_agreement_sign",
    });

    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.reason || "OTP verification failed" },
        { status: 401 }
      );
    }

    await updateAgreementWorkflow(id, (current) => ({
      ...current,
      sellerSignaturePhone: phone,
      sellerSignaturePhoneMasked: current.sellerSignaturePhoneMasked || "",
      sellerSignatureStatus: "OTP_VERIFIED",
      sellerSignatureOtpVerifiedAt: new Date().toISOString(),
    }));

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to verify OTP" },
      { status: 400 }
    );
  }
}