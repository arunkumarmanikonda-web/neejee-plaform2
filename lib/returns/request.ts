export const RETURN_REASONS = {
  RETURN: 'Request a return',
  DAMAGED: 'Arrived damaged',
  WRONG_ITEM: 'Received a different piece',
} as const;
export type ReturnReason = keyof typeof RETURN_REASONS;

export function availableReasons(status: string, returnEligible: boolean): ReturnReason[] {
  if (status !== 'DELIVERED') return [];
  return returnEligible ? ['RETURN', 'DAMAGED', 'WRONG_ITEM'] : ['DAMAGED', 'WRONG_ITEM'];
}

export function readReturnRequest(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  if (typeof body.itemId !== 'string' || !body.itemId || body.itemId.length > 100 ||
      typeof body.reason !== 'string' || !Object.prototype.hasOwnProperty.call(RETURN_REASONS, body.reason) ||
      typeof body.quantity !== 'number' || !Number.isSafeInteger(body.quantity) || body.quantity < 1 ||
      (body.note !== undefined && typeof body.note !== 'string')) return null;
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > 2000) return null;
  return { itemId: body.itemId, reason: body.reason as ReturnReason, quantity: body.quantity, note };
}

export const returnCaseId = (itemId: string) => `return-${itemId}`;

export const CUSTOMER_UPDATE_PREFIX = '[For customer] ';
