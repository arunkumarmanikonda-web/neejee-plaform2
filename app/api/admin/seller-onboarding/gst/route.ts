import { NextRequest, NextResponse } from 'next/server';
import { verifyKycDocument } from '../kyc-ai-core';

export const dynamic = 'force-dynamic';

type RequestPayload = {
  provider?: string;
  typed?: Record<string, unknown>;
  extracted?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    actor: 'admin',
    documentType: 'gst',
    capability: 'ai-first-kyc-verification',
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: RequestPayload = {};
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    payload = {};
  }

  const result = verifyKycDocument({
    actor: 'admin',
    documentType: 'gst',
    provider: payload.provider,
    typed: payload.typed ?? {},
    extracted: payload.extracted ?? {},
    metadata: payload.metadata ?? {},
  });

  return NextResponse.json({
    ok: true,
    actor: 'admin',
    documentType: 'gst',
    result,
  });
}