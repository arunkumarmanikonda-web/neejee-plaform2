import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { parseFast2SmsReportHtml } from "@/lib/fast2sms-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function gate() {
  const session = await getSession();
  if (!requireRole(session, ["ADMIN", "SUPER_ADMIN"])) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await gate();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.fast2SmsProviderTemplate.findMany({
    orderBy: [{ status: "asc" }, { messageId: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    count: templates.length,
    templates,
  });
}

export async function POST(req: NextRequest) {
  const session = await gate();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const html = typeof payload?.html === "string" ? payload.html : "";

  if (!html.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing html payload" },
      { status: 400 }
    );
  }

  const parsed = parseFast2SmsReportHtml(html);

  if (!parsed.length) {
    return NextResponse.json(
      { ok: false, error: "No provider templates parsed from HTML" },
      { status: 400 }
    );
  }

  for (const row of parsed) {
    await prisma.fast2SmsProviderTemplate.upsert({
      where: { messageId: row.messageId },
      update: {
        entityId: row.entityId ?? null,
        entityName: row.entityName ?? null,
        senderId: row.senderId ?? null,
        status: row.status ?? null,
        category: row.category ?? null,
        language: row.language ?? null,
        body: row.body,
        sourcePage: row.sourcePage ?? null,
        rawMeta: (row.rawMeta as any) ?? undefined,
      },
      create: {
        messageId: row.messageId,
        entityId: row.entityId ?? null,
        entityName: row.entityName ?? null,
        senderId: row.senderId ?? null,
        status: row.status ?? null,
        category: row.category ?? null,
        language: row.language ?? null,
        body: row.body,
        sourcePage: row.sourcePage ?? null,
        rawMeta: (row.rawMeta as any) ?? undefined,
      },
    });
  }

  const templates = await prisma.fast2SmsProviderTemplate.findMany({
    orderBy: [{ status: "asc" }, { messageId: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    importedCount: parsed.length,
    totalCount: templates.length,
    templates,
  });
}
