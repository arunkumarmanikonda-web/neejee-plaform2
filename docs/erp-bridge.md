# External ERP bridge

Neejee’s stock ledger, purchases and fulfilment can operate independently of an external ERP. Administrators can compare a full stock CSV in **ERP → Reconciliation**. A configured HTTPS CSV feed takes precedence over the adapter.

For a compatible external system, set server-side `ERP_ADAPTER=real`, `ERP_API_ORIGIN` (HTTPS origin only) and `ERP_API_TOKEN` (read-only bearer token). Deploy environment configuration separately for preview and production. The ERP home reports whether configuration is present. A successful reconciliation makes authenticated reads and verifies the returned data. Leave the adapter unset for the deterministic demo.

## Read protocol

The bridge is operated by the ERP owner and maps its data to Neejee’s existing types in `lib/erp/adapter/contracts.ts`. All requests use GET, bearer authentication and JSON. Monetary amounts use integer minor units, quantities use whole units, and timestamps use ISO 8601 with timezone. The bridge must return the requested SKU or order number. A missing record returns HTTP 404.

| Resource | Endpoint | Successful JSON |
| --- | --- | --- |
| Catalogue | `/v1/products?limit=250` | Page of ErpProduct |
| Product | `/v1/product?sku=…` | ErpProduct |
| Stock | `/v1/stock?sku=…` | ErpStockSnapshot |
| Price | `/v1/price?sku=…` | ErpPriceSnapshot |
| Sellers | `/v1/sellers?limit=250` | Page of ErpSeller |
| Sales order | `/v1/sales-order?orderNumber=…` | ErpSalesOrder |
| Purchase order | `/v1/purchase-order?poNumber=…` | ErpPurchaseOrder |

Page responses use `{"items":[],"nextCursor":null}`. Return an opaque next cursor when more records exist. The client sends it as `cursor`. Maintain stable ordering across pages and support optional catalogue filters `sellerId` and `status`. The final page must set `nextCursor` to null. Limit each page to 250 records and 2 MB. The adapter stops with a visible error on duplicate identities, repeated cursors or an incomplete response. For large catalogues use the complete CSV feed.

A single request times out after eight seconds. HTTP 408, 425, 429, 5xx and transport failures are classified as retryable. The adapter never includes credentials, endpoint parameters or raw provider messages in reported errors. This interface provides reads only. ERP writeback, order posting and stock mutation require a separately defined provider contract and idempotency rules.
