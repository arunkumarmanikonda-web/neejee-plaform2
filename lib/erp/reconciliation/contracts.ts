export const ERP_RECONCILIATION_VERSION = 'phase3.erp-reconciliation.v1' as const;

export type ErpReconciliationKind =
  | 'MATCHED'
  | 'DRIFT'
  | 'MISSING_IN_ERP'
  | 'MISSING_IN_PLATFORM';

export type ErpReconciliationMismatch =
  | 'STATUS'
  | 'SELLING_PRICE'
  | 'MRP'
  | 'INVENTORY';

export type ErpReconciliationFilter =
  | 'ALL'
  | 'MATCHED'
  | 'DRIFT'
  | 'MISSING_IN_ERP'
  | 'MISSING_IN_PLATFORM';

export type ReconciliationComparableStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export interface PlatformReconciliationRow {
  productId: string;
  sku: string;
  slug: string;
  name: string;
  status: ReconciliationComparableStatus;
  mrpPaise: number;
  sellingPricePaise: number;
  inventoryQuantity: number;
  updatedAt: string;
}

export interface ErpReconciliationRow {
  sku: string;
  name: string;
  status: ReconciliationComparableStatus;
  mrpPaise: number;
  sellingPricePaise: number;
  inventoryQuantity: number;
  updatedAt: string;
}

export interface ErpReconciliationItem {
  sku: string;
  kind: ErpReconciliationKind;
  mismatches: ErpReconciliationMismatch[];
  platform: PlatformReconciliationRow | null;
  erp: ErpReconciliationRow | null;
}

export interface ErpReconciliationSummary {
  total: number;
  matched: number;
  drift: number;
  missingInErp: number;
  missingInPlatform: number;
  statusMismatchCount: number;
  sellingPriceMismatchCount: number;
  mrpMismatchCount: number;
  inventoryMismatchCount: number;
}

export interface ErpReconciliationResponse {
  version: typeof ERP_RECONCILIATION_VERSION;
  generatedAt: string;
  adapterKind: string;
  filter: ErpReconciliationFilter;
  summary: ErpReconciliationSummary;
  items: ErpReconciliationItem[];
}
