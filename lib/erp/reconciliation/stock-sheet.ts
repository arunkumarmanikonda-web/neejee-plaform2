import type { ErpReconciliationRow } from './contracts';

export const stockSheetHeader = 'sku,status,mrp_inr,selling_price_inr,available_quantity';
export function parseStockSheet(csv: string, timestamp: string): ErpReconciliationRow[] {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2 || lines.length > 10001) throw Error('Include a header and 1 to 10,000 catalogue rows.');
  function cells(line: string) {
    return line.split(',').map(c => c.trim().replace(/^"([^"]*)"$/, '$1').trim());
  }
  if (cells(lines[0]).join(',').toLowerCase() !== stockSheetHeader) throw Error('Use the column headings in the downloadable template.');
  const known = new Set<string>();
  return lines.slice(1).map((line, i) => {
    const columns = cells(line);
    const [rawSku, rawStatus, mrp, price, stock] = columns;
    const sku = rawSku.toUpperCase();
    const status = rawStatus?.toUpperCase();
    const priceFormat = /^\d{1,8}(\.\d{1,2})?$/;
    if (columns.length !== 5 || !/^[A-Z0-9][A-Z0-9._/-]{0,95}$/.test(sku) ||
        !['ACTIVE','INACTIVE','DRAFT'].includes(status) || !priceFormat.test(mrp) || !priceFormat.test(price) || !/^\d{1,8}$/.test(stock)) {
      throw Error('Check row '+(i+2)+'. Use a SKU, a valid status, rupee amounts without commas and a whole stock quantity.');
    }
    if (known.has(sku)) throw Error('Repeated SKU on row '+(i+2)+': '+sku);
    known.add(sku);
    return {sku,name:sku,status:status as ErpReconciliationRow['status'],mrpPaise:Math.round(Number(mrp)*100),
      sellingPricePaise:Math.round(Number(price)*100),inventoryQuantity:Number(stock),updatedAt:timestamp};
  });
}
