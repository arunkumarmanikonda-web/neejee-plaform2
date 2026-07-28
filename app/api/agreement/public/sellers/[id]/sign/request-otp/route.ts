import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, requestOtp } from "@/lib/otp";
import { assertSigningToken, loadSellerForSigning, maskPhone, readAgreementWorkflow, updateAgreementWorkflow } from "@/lib/agreement-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || "");

    const seller = await loadSellerForSigning(id);
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const workflow = readAgreementWorkflow(seller.autoKycSummary);
    assertSigningToken(workflow, token);

    const phone = normalizePhone(String(body?.phone || workflow?.sellerSignaturePhone || seller.phone || ""));
    if (!phone) {
      return NextResponse.json({ error: "Valid phone is required" }, { status: 400 });
    }

    const result = await requestOtp({
      phone,
      purpose: "seller_agreement_sign",
      ipAddress: firstForwardedIp(request.headers.get("x-forwarded-for")),
      userAgent: request.headers.get("user-agent") || undefined,
    });

    await updateAgreementWorkflow(id, (current) => ({
      ...current,
      sellerSignaturePhone: phone,
      sellerSignaturePhoneMasked: maskPhone(phone),
      sellerSignatureStatus: "OTP_REQUESTED",
      sellerSignatureOtpRequestedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      phone: result.phone,
      purpose: result.purpose,
      expiresAt: result.expiresAt,
      expiresInSec: result.expiresInSec,
      cooldownSec: result.cooldownSec,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to send OTP" },
      { status: 400 }
    );
  }
}