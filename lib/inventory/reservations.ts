type DbLike = {
  $queryRaw: <T = unknown>(strings: TemplateStringsArray, ...values: any[]) => Promise<T>;
};

export type ReservationItem = {
  variantId: string;
  quantity: number;
};

export type ReservationResult = {
  ok: boolean;
  snapshotId?: string;
  variantCount: number;
  expiresAt?: string;
};

function normalizeItems(items: ReservationItem[]): ReservationItem[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const variantId = String(item.variantId || '').trim();
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (!variantId || quantity < 1) continue;
    quantities.set(variantId, (quantities.get(variantId) || 0) + quantity);
  }
  return Array.from(quantities, ([variantId, quantity]) => ({ variantId, quantity }));
}

function payloadFor(items: ReservationItem[]): string {
  const normalized = normalizeItems(items);
  if (normalized.length === 0) throw new Error('No purchasable variants supplied');
  return JSON.stringify(normalized);
}

export async function reserveInventory(
  db: DbLike,
  snapshotId: string,
  items: ReservationItem[],
  holdMinutes = 30,
): Promise<ReservationResult> {
  const payload = payloadFor(items);
  const rows = await db.$queryRaw<Array<{ result: ReservationResult }>>`
    select private.reserve_inventory(${snapshotId}, ${payload}::jsonb, ${holdMinutes}) as result
  `;
  return rows?.[0]?.result;
}

export async function consumeInventoryReservation(
  db: DbLike,
  snapshotId: string,
): Promise<ReservationResult> {
  const rows = await db.$queryRaw<Array<{ result: ReservationResult }>>`
    select private.consume_inventory_reservation(${snapshotId}) as result
  `;
  return rows?.[0]?.result;
}

export async function consumeUnreservedInventory(
  db: DbLike,
  items: ReservationItem[],
): Promise<ReservationResult> {
  const payload = payloadFor(items);
  const rows = await db.$queryRaw<Array<{ result: ReservationResult }>>`
    select private.consume_unreserved_inventory(${payload}::jsonb) as result
  `;
  return rows?.[0]?.result;
}

export async function releaseInventoryReservation(
  db: DbLike,
  snapshotId: string,
  reason: 'RELEASED' | 'EXPIRED' = 'RELEASED',
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ released: number }>>`
    select private.release_inventory_reservation(${snapshotId}, ${reason}) as released
  `;
  return Number(rows?.[0]?.released || 0);
}
