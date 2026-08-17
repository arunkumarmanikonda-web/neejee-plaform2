type DbLike = {
  $queryRaw: <T = unknown>(strings: TemplateStringsArray, ...values: any[]) => Promise<T>;
};

export type CheckoutReservationResult = {
  ok: boolean;
  idempotent?: boolean;
  snapshotId?: string;
  couponId?: string;
  points?: number;
  expiresAt?: string;
  late?: boolean;
};

export async function reserveCoupon(
  db: DbLike,
  args: {
    snapshotId: string;
    couponId: string;
    userId?: string | null;
    subtotalPaise: number;
    holdMinutes?: number;
  },
): Promise<CheckoutReservationResult> {
  const holdMinutes = args.holdMinutes ?? 30;
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.reserve_coupon(
      ${args.snapshotId},
      ${args.couponId},
      ${args.userId || null},
      ${Math.max(0, Math.floor(args.subtotalPaise))},
      ${holdMinutes}
    ) as result
  `;
  return rows?.[0]?.result;
}

export async function consumeCouponReservation(
  db: DbLike,
  snapshotId: string,
  orderId: string,
): Promise<CheckoutReservationResult> {
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.consume_coupon_reservation(${snapshotId}, ${orderId}) as result
  `;
  return rows?.[0]?.result;
}

export async function redeemCouponNow(
  db: DbLike,
  args: {
    couponId: string;
    userId?: string | null;
    subtotalPaise: number;
    orderId: string;
  },
): Promise<CheckoutReservationResult> {
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.redeem_coupon_now(
      ${args.couponId},
      ${args.userId || null},
      ${Math.max(0, Math.floor(args.subtotalPaise))},
      ${args.orderId}
    ) as result
  `;
  return rows?.[0]?.result;
}

export async function releaseCouponReservation(
  db: DbLike,
  snapshotId: string,
  reason: 'RELEASED' | 'EXPIRED' = 'RELEASED',
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ released: number }>>`
    select private.release_coupon_reservation(${snapshotId}, ${reason}) as released
  `;
  return Number(rows?.[0]?.released || 0);
}

export async function reserveLoyaltyPoints(
  db: DbLike,
  args: {
    snapshotId: string;
    userId: string;
    points: number;
    holdMinutes?: number;
  },
): Promise<CheckoutReservationResult> {
  const holdMinutes = args.holdMinutes ?? 30;
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.reserve_loyalty_points(
      ${args.snapshotId},
      ${args.userId},
      ${Math.max(0, Math.floor(args.points))},
      ${holdMinutes}
    ) as result
  `;
  return rows?.[0]?.result;
}

export async function consumeLoyaltyReservation(
  db: DbLike,
  snapshotId: string,
  orderId: string,
): Promise<CheckoutReservationResult> {
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.consume_loyalty_reservation(${snapshotId}, ${orderId}) as result
  `;
  return rows?.[0]?.result;
}

export async function redeemLoyaltyPointsNow(
  db: DbLike,
  args: { userId: string; points: number; orderId: string },
): Promise<CheckoutReservationResult> {
  const rows = await db.$queryRaw<Array<{ result: CheckoutReservationResult }>>`
    select private.redeem_loyalty_points_now(
      ${args.userId},
      ${Math.max(0, Math.floor(args.points))},
      ${args.orderId}
    ) as result
  `;
  return rows?.[0]?.result;
}

export async function releaseLoyaltyReservation(
  db: DbLike,
  snapshotId: string,
  reason: 'RELEASED' | 'EXPIRED' = 'RELEASED',
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ released: number }>>`
    select private.release_loyalty_reservation(${snapshotId}, ${reason}) as released
  `;
  return Number(rows?.[0]?.released || 0);
}
