// lib/ab/assign.ts
// v26.3b — Deterministic A/B variant assignment.
// Disabled by default — controlled by AbTest.enabled flag.
// Subject identity (cartId, userId) is hashed so the same user always
// gets the same variant across requests.

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface Variant {
  id: string;
  key: string;          // 'A' | 'B' | 'control'
  displayName: string;
  payload: any;          // variant-specific overrides
}

/**
 * Get the variant for a subject in a given test.
 * Returns null if the test is disabled or doesn't exist.
 * Idempotent — multiple calls for the same subject return the same variant.
 */
export async function getVariant(opts: {
  testKey: string;
  subjectKey: string;       // cartId or userId
  subjectType: 'cart' | 'user' | 'session';
}): Promise<Variant | null> {
  const test = await prisma.abTest.findUnique({
    where: { key: opts.testKey },
    include: { /* variants are loaded separately for control */ } as any,
  });
  if (!test || !test.enabled) return null;

  // Reuse existing assignment if any
  const existing = await prisma.abAssignment.findFirst({
    where: { abTestId: test.id, subjectKey: opts.subjectKey },
  });
  if (existing) {
    const v = await prisma.abVariant.findUnique({ where: { id: existing.variantId } });
    return v ? { id: v.id, key: v.key, displayName: v.displayName, payload: v.payloadJson } : null;
  }

  // Pick a variant by weight
  const variants = await prisma.abVariant.findMany({ where: { abTestId: test.id } });
  if (variants.length === 0) return null;

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  // Deterministic hash → 0..totalWeight
  const h = crypto.createHash('sha256')
    .update(`${test.id}:${opts.subjectKey}`)
    .digest();
  const bucket = h.readUInt32BE(0) % totalWeight;

  let acc = 0;
  let chosen = variants[0];
  for (const v of variants) {
    acc += v.weight;
    if (bucket < acc) { chosen = v; break; }
  }

  // Persist assignment
  try {
    await prisma.abAssignment.create({
      data: {
        abTestId: test.id,
        variantId: chosen.id,
        subjectKey: opts.subjectKey,
        subjectType: opts.subjectType,
      },
    });
  } catch { /* unique violation = race, harmless */ }

  return {
    id: chosen.id,
    key: chosen.key,
    displayName: chosen.displayName,
    payload: chosen.payloadJson,
  };
}

/**
 * Mark a subject as converted in this test, with optional value attribution.
 */
export async function trackConversion(opts: {
  testKey: string;
  subjectKey: string;
  valuePaise?: number;
}) {
  const test = await prisma.abTest.findUnique({ where: { key: opts.testKey } });
  if (!test || !test.enabled) return;
  await prisma.abAssignment.updateMany({
    where: { abTestId: test.id, subjectKey: opts.subjectKey, convertedAt: null },
    data: { convertedAt: new Date(), conversionValuePaise: opts.valuePaise },
  });
}
