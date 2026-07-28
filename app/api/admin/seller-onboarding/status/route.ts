import { NextRequest, NextResponse } from 'next/server';
import { aggregateKycStatus, verifyKycDocument } from '../kyc-ai-core';

export const dynamic = 'force-dynamic';

type DocumentPayload = {
  provider?: string;
  typed?: Record<string, unknown>;
  extracted?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type StatusRequestPayload = {
  documents?: {
    pan?: DocumentPayload;
    gst?: DocumentPayload;
    bank?: DocumentPayload;
  };
};

export async function GET(): Promise<NextResponse> {
  const aggregate = aggregateKycStatus('admin', {});
  return NextResponse.json({
    ok: true,
    actor: 'admin',
    status: aggregate,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: StatusRequestPayload = {};
  try {
    payload = (await request.json()) as StatusRequestPayload;
  } catch {
    payload = {};
  }

  const docs = payload.documents ?? {};
  const results: Partial<Record<'pan' | 'gst' | 'bank', ReturnType<typeof verifyKycDocument>>> = {};

  if (docs.pan) {
    results.pan = verifyKycDocument({
      actor: 'admin',
      documentType: 'pan',
      provider: docs.pan.provider,
      typed: docs.pan.typed ?? {},
      extracted: docs.pan.extracted ?? {},
      metadata: docs.pan.metadata ?? {},
    });
  }

  if (docs.gst) {
    results.gst = verifyKycDocument({
      actor: 'admin',
      documentType: 'gst',
      provider: docs.gst.provider,
      typed: docs.gst.typed ?? {},
      extracted: docs.gst.extracted ?? {},
      metadata: docs.gst.metadata ?? {},
    });
  }

  if (docs.bank) {
    results.bank = verifyKycDocument({
      actor: 'admin',
      documentType: 'bank',
      provider: docs.bank.provider,
      typed: docs.bank.typed ?? {},
      extracted: docs.bank.extracted ?? {},
      metadata: docs.bank.metadata ?? {},
    });
  }

  const aggregate = aggregateKycStatus('admin', results);

  return NextResponse.json({
    ok: true,
    actor: 'admin',
    status: aggregate,
  });
}