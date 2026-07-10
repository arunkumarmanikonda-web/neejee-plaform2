import {
  ERP_ADAPTER_VERSION,
  type ErpAdapter,
  type ErpAdapterListProductsParams,
  type ErpPriceSnapshot,
  type ErpProduct,
  type ErpPurchaseOrder,
  type ErpSalesOrder,
  type ErpSeller,
  type ErpStockSnapshot,
} from './contracts';

const MOCK_TIMESTAMP = '2026-07-10T00:00:00.000Z';

const MOCK_PRODUCTS: ErpProduct[] = [
  {
    id: 'erp-prod-001',
    sku: 'NJ-CER-LAMP-001',
    slug: 'istanbul-ceramic-mushroom-lamp',
    name: 'Istanbul Ceramic Mushroom Lamp',
    sellerId: 'seller-001',
    status: 'ACTIVE',
    currency: 'INR',
    pricePaise: 129990,
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    id: 'erp-prod-002',
    sku: 'NJ-TXT-THROW-002',
    slug: 'handwoven-indigo-throw',
    name: 'Handwoven Indigo Throw',
    sellerId: 'seller-002',
    status: 'ACTIVE',
    currency: 'INR',
    pricePaise: 89990,
    updatedAt: MOCK_TIMESTAMP,
  },
];

const MOCK_STOCK: ErpStockSnapshot[] = [
  {
    sku: 'NJ-CER-LAMP-001',
    availableQuantity: 5,
    reservedQuantity: 1,
    inStock: true,
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    sku: 'NJ-TXT-THROW-002',
    availableQuantity: 12,
    reservedQuantity: 2,
    inStock: true,
    updatedAt: MOCK_TIMESTAMP,
  },
];

const MOCK_PRICES: ErpPriceSnapshot[] = [
  {
    sku: 'NJ-CER-LAMP-001',
    currency: 'INR',
    mrpPaise: 149990,
    sellingPricePaise: 129990,
    effectivePricePaise: 129990,
    onSale: true,
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    sku: 'NJ-TXT-THROW-002',
    currency: 'INR',
    mrpPaise: 99990,
    sellingPricePaise: 89990,
    effectivePricePaise: 89990,
    onSale: true,
    updatedAt: MOCK_TIMESTAMP,
  },
];

const MOCK_SELLERS: ErpSeller[] = [
  {
    id: 'seller-001',
    code: 'NJJ-SELLER-001',
    name: 'Neejee Heritage Studio',
    status: 'ACTIVE',
    updatedAt: MOCK_TIMESTAMP,
  },
  {
    id: 'seller-002',
    code: 'NJJ-SELLER-002',
    name: 'Neejee Textiles Collective',
    status: 'ACTIVE',
    updatedAt: MOCK_TIMESTAMP,
  },
];

const MOCK_SALES_ORDERS: ErpSalesOrder[] = [
  {
    id: 'erp-so-001',
    orderNumber: 'SO-2026-0001',
    sellerId: 'seller-001',
    status: 'PLACED',
    currency: 'INR',
    totalPaise: 129990,
    placedAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
    lines: [
      {
        sku: 'NJ-CER-LAMP-001',
        quantity: 1,
        unitPricePaise: 129990,
        totalPricePaise: 129990,
      },
    ],
  },
];

const MOCK_PURCHASE_ORDERS: ErpPurchaseOrder[] = [
  {
    id: 'erp-po-001',
    poNumber: 'PO-2026-0001',
    vendorCode: 'VENDOR-NEEJEE-001',
    status: 'CONFIRMED',
    currency: 'INR',
    totalPaise: 269970,
    issuedAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
    lines: [
      {
        sku: 'NJ-CER-LAMP-001',
        quantity: 1,
        unitCostPaise: 120000,
        totalCostPaise: 120000,
      },
      {
        sku: 'NJ-TXT-THROW-002',
        quantity: 3,
        unitCostPaise: 49990,
        totalCostPaise: 149970,
      },
    ],
  },
];

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

class MockErpAdapter implements ErpAdapter {
  readonly version = ERP_ADAPTER_VERSION;
  readonly kind = 'mock' as const;

  async listProducts(
    params: ErpAdapterListProductsParams = {}
  ): Promise<ErpProduct[]> {
    const status = params.status ?? 'ALL';
    const sellerId =
      typeof params.sellerId === 'string' && params.sellerId.trim().length > 0
        ? params.sellerId.trim()
        : null;
    const limit =
      typeof params.limit === 'number' && params.limit > 0
        ? Math.floor(params.limit)
        : null;

    let results = [...MOCK_PRODUCTS];

    if (status !== 'ALL') {
      results = results.filter((product) => product.status === status);
    }

    if (sellerId) {
      results = results.filter((product) => product.sellerId === sellerId);
    }

    results.sort((left, right) => left.sku.localeCompare(right.sku));

    if (limit !== null) {
      results = results.slice(0, limit);
    }

    return cloneValue(results);
  }

  async getProductBySku(sku: string): Promise<ErpProduct | null> {
    const normalizedSku = normalizeSku(sku);
    const product =
      MOCK_PRODUCTS.find((item) => item.sku === normalizedSku) ?? null;

    return cloneValue(product);
  }

  async getStockBySku(sku: string): Promise<ErpStockSnapshot | null> {
    const normalizedSku = normalizeSku(sku);
    const stock = MOCK_STOCK.find((item) => item.sku === normalizedSku) ?? null;

    return cloneValue(stock);
  }

  async getPriceBySku(sku: string): Promise<ErpPriceSnapshot | null> {
    const normalizedSku = normalizeSku(sku);
    const price =
      MOCK_PRICES.find((item) => item.sku === normalizedSku) ?? null;

    return cloneValue(price);
  }

  async listSellers(): Promise<ErpSeller[]> {
    const sellers = [...MOCK_SELLERS].sort((left, right) =>
      left.id.localeCompare(right.id)
    );

    return cloneValue(sellers);
  }

  async getSalesOrder(orderNumber: string): Promise<ErpSalesOrder | null> {
    const normalizedOrderNumber = orderNumber.trim().toUpperCase();
    const order =
      MOCK_SALES_ORDERS.find(
        (item) => item.orderNumber.toUpperCase() === normalizedOrderNumber
      ) ?? null;

    return cloneValue(order);
  }

  async getPurchaseOrder(poNumber: string): Promise<ErpPurchaseOrder | null> {
    const normalizedPoNumber = poNumber.trim().toUpperCase();
    const purchaseOrder =
      MOCK_PURCHASE_ORDERS.find(
        (item) => item.poNumber.toUpperCase() === normalizedPoNumber
      ) ?? null;

    return cloneValue(purchaseOrder);
  }
}

export const mockErpAdapter = new MockErpAdapter();
