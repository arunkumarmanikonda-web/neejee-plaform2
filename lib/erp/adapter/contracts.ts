export const ERP_ADAPTER_VERSION = 'phase3.erp-adapter.v1' as const;

export type ErpAdapterKind = 'mock' | 'real';

export type ErpCurrencyCode = 'INR' | 'USD' | 'EUR' | string;

export type ErpProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export type ErpSellerStatus = 'ACTIVE' | 'INACTIVE';

export type ErpSalesOrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'FULFILLED'
  | 'CANCELLED';

export type ErpPurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface ErpProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  sellerId: string | null;
  status: ErpProductStatus;
  currency: ErpCurrencyCode;
  pricePaise: number;
  updatedAt: string;
}

export interface ErpStockSnapshot {
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  inStock: boolean;
  updatedAt: string;
}

export interface ErpPriceSnapshot {
  sku: string;
  currency: ErpCurrencyCode;
  mrpPaise: number;
  sellingPricePaise: number;
  effectivePricePaise: number;
  onSale: boolean;
  updatedAt: string;
}

export interface ErpSeller {
  id: string;
  code: string;
  name: string;
  status: ErpSellerStatus;
  updatedAt: string;
}

export interface ErpSalesOrderLine {
  sku: string;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
}

export interface ErpSalesOrder {
  id: string;
  orderNumber: string;
  sellerId: string | null;
  status: ErpSalesOrderStatus;
  currency: ErpCurrencyCode;
  totalPaise: number;
  placedAt: string;
  updatedAt: string;
  lines: ErpSalesOrderLine[];
}

export interface ErpPurchaseOrderLine {
  sku: string;
  quantity: number;
  unitCostPaise: number;
  totalCostPaise: number;
}

export interface ErpPurchaseOrder {
  id: string;
  poNumber: string;
  vendorCode: string;
  status: ErpPurchaseOrderStatus;
  currency: ErpCurrencyCode;
  totalPaise: number;
  issuedAt: string;
  updatedAt: string;
  lines: ErpPurchaseOrderLine[];
}

export interface ErpAdapterListProductsParams {
  sellerId?: string | null;
  status?: ErpProductStatus | 'ALL';
  limit?: number;
}

export interface ErpAdapter {
  readonly version: typeof ERP_ADAPTER_VERSION;
  readonly kind: ErpAdapterKind;

  listProducts(params?: ErpAdapterListProductsParams): Promise<ErpProduct[]>;
  getProductBySku(sku: string): Promise<ErpProduct | null>;

  getStockBySku(sku: string): Promise<ErpStockSnapshot | null>;
  getPriceBySku(sku: string): Promise<ErpPriceSnapshot | null>;

  listSellers(): Promise<ErpSeller[]>;
  getSalesOrder(orderNumber: string): Promise<ErpSalesOrder | null>;
  getPurchaseOrder(poNumber: string): Promise<ErpPurchaseOrder | null>;
}
