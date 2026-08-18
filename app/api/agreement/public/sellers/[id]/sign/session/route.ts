import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const instrumentId = String(workflow.instrumentId || "").trim();
    let priorInstruments: any[] = [];
    let currentInstrument: any = null;

    if (instrumentId) {
      const currentRows = await prisma.$queryRaw<any[]>`
        SELECT "id", "sequence", "instrumentType", "instrumentNumber", "title", "status",
               "effectiveFrom", "effectiveTo", "commissionPct", "qualityScore", "payoutCycle",
               "isNeejeeSelect", "changeReason", "documentSnapshot"
        FROM "SellerCommercialInstrument"
        WHERE "id" = ${instrumentId} AND "sellerRef" = ${id}
        LIMIT 1
      `;
      currentInstrument = currentRows[0] || null;

      if (currentInstrument) {
        priorInstruments = await prisma.$queryRaw<any[]>`
          SELECT "id", "sequence", "instrumentType", "instrumentNumber", "title", "status",
                 "effectiveFrom", "effectiveTo", "commissionPct", "qualityScore", "payoutCycle",
                 "isNeejeeSelect", "changeReason", "documentSnapshot", "sellerSignedAt",
                 "companySignedAt", "closedAt"
          FROM "SellerCommercialInstrument"
          WHERE "sellerRef" = ${id} AND "sequence" < ${Number(currentInstrument.sequence)}
          ORDER BY "sequence" ASC
        `;
      }
    }

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
        instrumentId,
        instrumentType: workflow.instrumentType || currentInstrument?.instrumentType || "INITIAL",
        agreementNumber: workflow.agreementNumber || currentInstrument?.instrumentNumber || "",
        effectiveDate: workflow.effectiveDate || "",
        validFrom: workflow.validFrom || currentInstrument?.effectiveFrom || "",
        validTo: workflow.validTo || currentInstrument?.effectiveTo || "",
        renegotiationReason: workflow.renegotiationReason || currentInstrument?.changeReason || "",
        currentDocumentJson: workflow.currentDocumentJson || {},
        lifecycleReferences: workflow.lifecycleReferences || [],
        sellerSignatureStatus: workflow.sellerSignatureStatus || "",
        sellerSigningUrl: workflow.sellerSigningUrl || buildSellerSigningUrl(getRequestOrigin(request), id, token),
        sellerSignaturePhoneMasked: workflow.sellerSignaturePhoneMasked || "",
        sellerSignatureImageUrl: workflow.sellerSignatureImageUrl || "",
        sellerSignatureProcessedUrl: workflow.sellerSignatureProcessedUrl || "",
        sellerSignatureOtpRequestedAt: workflow.sellerSignatureOtpRequestedAt || "",
        sellerSignatureOtpVerifiedAt: workflow.sellerSignatureOtpVerifiedAt || "",
        sellerSignedAt: workflow.sellerSignedAt || "",
      },
      currentInstrument,
      priorInstruments,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to load signing session" },
      { status: 401 }
    );
  }
}
