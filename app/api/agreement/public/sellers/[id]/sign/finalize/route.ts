import { NextRequest, NextResponse } from "next/server";
import { assertSigningToken, loadSellerForSigning, readAgreementWorkflow, updateAgreementWorkflow } from "@/lib/agreement-signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
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

    if (body?.reviewAccepted !== true) {
      return NextResponse.json(
        { error: "Agreement review acknowledgement is required before signing" },
        { status: 400 }
      );
    }

    const submittedInstrumentId = String(body?.instrumentId || "").trim();
    const submittedAgreementNumber = String(body?.agreementNumber || "").trim();
    const workflowInstrumentId = String(workflow?.instrumentId || "").trim();
    const workflowAgreementNumber = String(workflow?.agreementNumber || "").trim();

    if (workflowInstrumentId && submittedInstrumentId && workflowInstrumentId !== submittedInstrumentId) {
      return NextResponse.json({ error: "The agreement changed. Reload the signing page and review the current instrument." }, { status: 409 });
    }
    if (workflowAgreementNumber && submittedAgreementNumber && workflowAgreementNumber !== submittedAgreementNumber) {
      return NextResponse.json({ error: "The agreement reference changed. Reload the signing page and review the current instrument." }, { status: 409 });
    }

    if (!workflow?.sellerSignatureOtpVerifiedAt) {
      return NextResponse.json(
        { error: "OTP verification is required before finalizing signature" },
        { status: 400 }
      );
    }

    const signatureImageUrl = String(body?.signatureImageUrl || "").trim();
    const signatureProcessedUrl = String(body?.signatureProcessedUrl || signatureImageUrl).trim();

    if (!signatureImageUrl) {
      return NextResponse.json({ error: "Signature image URL is required" }, { status: 400 });
    }

    const ip = getIp(request);
    const userAgent = request.headers.get("user-agent") || "";
    const reviewedAt = new Date().toISOString();

    const result = await updateAgreementWorkflow(id, (current, sellerRow) => {
      const trail = Array.isArray(current.sellerSignatureAuditTrail)
        ? current.sellerSignatureAuditTrail
        : [];

      return {
        ...current,
        status: "SELLER_SIGNED",
        sellerSignatureStatus: "SELLER_SIGNED",
        sellerSignatureImageUrl: signatureImageUrl,
        sellerSignatureProcessedUrl: signatureProcessedUrl,
        sellerSignedAt: reviewedAt,
        sellerAgreementReviewedAt: reviewedAt,
        sellerAgreementReviewAccepted: true,
        sellerAgreementReviewedInstrumentId: workflowInstrumentId || submittedInstrumentId,
        sellerAgreementReviewedNumber: workflowAgreementNumber || submittedAgreementNumber,
        sellerSignerName: String(body?.signerName || sellerRow.contactName || ""),
        sellerSignerEmail: String(body?.signerEmail || sellerRow.email || ""),
        sellerSignedIp: ip,
        sellerSignedUserAgent: userAgent,
        sellerSignatureAuditTrail: [
          ...trail,
          {
            event: "AGREEMENT_REVIEW_ACCEPTED",
            at: reviewedAt,
            ip,
            userAgent,
            instrumentId: workflowInstrumentId || submittedInstrumentId,
            agreementNumber: workflowAgreementNumber || submittedAgreementNumber,
          },
          {
            event: "SELLER_SIGNED",
            at: reviewedAt,
            ip,
            userAgent,
            signatureImageUrl,
            signatureProcessedUrl,
          },
        ],
      };
    });

    return NextResponse.json({
      ok: true,
      workflow: result?.workflow || {},
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to finalize signature" },
      { status: 400 }
    );
  }
}
