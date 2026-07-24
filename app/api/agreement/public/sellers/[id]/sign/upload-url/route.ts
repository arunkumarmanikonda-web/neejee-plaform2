import { NextRequest, NextResponse } from "next/server";
import { createSignedUploadUrl, makeUploadPath } from "@/lib/storage";
import { assertSigningToken, loadSellerForSigning, readAgreementWorkflow } from "@/lib/agreement-signing";

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
    const fileName = String(body?.fileName || "signature.png");
    const contentType = String(body?.contentType || "image/png");

    const seller = await loadSellerForSigning(id);
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const workflow = readAgreementWorkflow(seller.autoKycSummary);
    assertSigningToken(workflow, token);

    const path = makeUploadPath(`agreements/signatures/${id}`, fileName);
    const upload = await createSignedUploadUrl(path);

    return NextResponse.json({
      ok: true,
      signedUrl: upload.signedUrl,
      uploadToken: upload.token,
      path: upload.path,
      publicUrl: upload.publicUrl,
      contentType,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to prepare upload" },
      { status: 400 }
    );
  }
}