// Bulk inventory I/O for NEEJEE — Excel-based.
// - Template:  buildTemplateWorkbook()  → mandatory-fields-only blank .xlsx
// - Import:    parseInventoryWorkbook() → array of normalised draft rows + per-row errors
// - Export:    buildExportWorkbook()    → full inventory with EMBEDDED product images
//
// Uses exceljs because it's the only mainstream library that supports
// embedding actual image binaries inside .xlsx cells.

import ExcelJS from 'exceljs';

// ────────────────────────────────────────────────────────────────────
// Column schema — single source of truth
// ────────────────────────────────────────────────────────────────────

// Columns the user FILLS IN to create a draft product.
// Everything else is filled in later via the admin product editor.
export const IMPORT_COLUMNS: Array<{
  key: string;
  header: string;
  width: number;
  required: boolean;
  note: string;
  example?: string;
}> = [
  // Row type — PRODUCT or VARIANT.
  { key: 'rowType', header: 'Row type *', width: 12, required: true, note: 'PRODUCT for a new product row. VARIANT for a size/colour/dimension variant of the product above it. Leave blank to default to PRODUCT.', example: 'PRODUCT' },
  { key: 'parentSku', header: 'Parent SKU', width: 22, required: false, note: 'For VARIANT rows only. The SKU of the parent product (or leave blank to attach to the most recent PRODUCT row above).', example: '' },
  // Product columns (filled for PRODUCT rows)
  { key: 'name', header: 'Name *', width: 40, required: true, note: 'Product name (required for PRODUCT rows).', example: 'Banarasi Katan silk saree' },
  { key: 'sku', header: 'SKU (auto if blank)', width: 22, required: false, note: 'Leave blank to generate a category-based SKU. Use a distinct SKU for each product. Existing items are edited from Products.', example: '' },
  { key: 'category', header: 'Category (slug OR free text) *', width: 28, required: true, note: 'Slug (e.g. women/sarees/banarasi), single leaf slug (banarasi), or free text (“Banarasi saree”). If no exact match is found, AI auto-resolves it from the product name/craft/material and auto-creates the sub-category if needed.', example: 'women/sarees/banarasi' },
  { key: 'craft', header: 'Craft', width: 22, required: false, note: 'e.g. Banarasi Katan, Kalamkari, Phulkari', example: 'Banarasi Katan' },
  { key: 'region', header: 'Region', width: 20, required: false, note: 'e.g. Varanasi, Uttar Pradesh', example: 'Varanasi' },
  { key: 'material', header: 'Material', width: 20, required: false, note: 'e.g. Pure silk, Cotton, Tussar', example: 'Pure silk' },
  { key: 'mrp', header: 'MRP (₹) *', width: 12, required: true, note: 'Maximum retail price in rupees (whole number).', example: '18500' },
  { key: 'sellingPrice', header: 'Selling Price (₹) *', width: 14, required: true, note: 'Selling price in rupees (whole number).', example: '15200' },
  { key: 'shortDescription', header: 'Short description', width: 50, required: false, note: 'A one-line description (30-50 words). Can be drafted with AI later.', example: '' },
  // Variant columns (filled for VARIANT rows)
  { key: 'variantSize', header: 'Variant size / dimensions', width: 24, required: false, note: 'For VARIANT rows. e.g. "M", "Free Size", "24cm × 18cm × 30cm". Leave blank for PRODUCT rows.', example: '' },
  { key: 'variantColor', header: 'Variant colour', width: 18, required: false, note: 'For VARIANT rows. e.g. "Ivory", "Madder Red".', example: '' },
  { key: 'variantMaterial', header: 'Variant material', width: 18, required: false, note: 'For VARIANT rows. Overrides parent material if set.', example: '' },
  { key: 'variantInventory', header: 'Variant inventory', width: 16, required: false, note: 'For VARIANT rows. Stock count (whole number). Default 0.', example: '' },
  { key: 'variantPrice', header: 'Variant price (₹, optional)', width: 18, required: false, note: 'For VARIANT rows. Overrides parent selling price if this variant costs more/less.', example: '' },
];

// Columns we EXPORT — full inventory snapshot, includes images.
export const EXPORT_COLUMNS: Array<{ key: string; header: string; width: number }> = [
  { key: 'image', header: 'Image', width: 18 },
  { key: 'rowType', header: 'Row type', width: 12 },
  { key: 'name', header: 'Name', width: 36 },
  { key: 'sku', header: 'SKU', width: 22 },
  { key: 'slug', header: 'Slug', width: 30 },
  { key: 'category', header: 'Category slug', width: 22 },
  { key: 'categoryPath', header: 'Category breadcrumb', width: 36 },
  { key: 'craft', header: 'Craft', width: 22 },
  { key: 'region', header: 'Region', width: 18 },
  { key: 'material', header: 'Material', width: 18 },
  { key: 'mrp', header: 'MRP (₹)', width: 12 },
  { key: 'sellingPrice', header: 'Selling Price (₹)', width: 14 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'variantSize', header: 'Variant size', width: 18 },
  { key: 'variantColor', header: 'Variant colour', width: 16 },
  { key: 'variantMaterial', header: 'Variant material', width: 16 },
  { key: 'variantInventory', header: 'Variant inventory', width: 14 },
  { key: 'variantPrice', header: 'Variant price (₹)', width: 16 },
  { key: 'imageUrls', header: 'All image URLs', width: 60 },
  { key: 'createdAt', header: 'Created', width: 20 },
];

// ────────────────────────────────────────────────────────────────────
// Template builder
// ────────────────────────────────────────────────────────────────────

export async function buildTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEEJEE Admin';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Products', {
    properties: { defaultRowHeight: 20 },
  });

  // Header row
  sheet.columns = IMPORT_COLUMNS.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  // Style the header
  const headerRow = sheet.getRow(1);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFF4EFE6' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF8B2E2A' }, // NEEJEE madder
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  // A notes sheet
  const notes = wb.addWorksheet('How to use');
  notes.columns = [
    { header: 'Column', key: 'col', width: 26 },
    { header: 'Required?', key: 'req', width: 12 },
    { header: 'What to fill', key: 'note', width: 80 },
  ];
  const notesHeader = notes.getRow(1);
  notesHeader.font = { bold: true, color: { argb: 'FFF4EFE6' } };
  notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B2E2A' } };

  IMPORT_COLUMNS.forEach(c => {
    notes.addRow({
      col: c.header,
      req: c.required ? 'Yes' : 'No',
      note: c.note,
    });
  });
  notes.addRow({});
  notes.addRow({ col: 'Example size run', req: '', note: 'Enter a PRODUCT row for the piece, followed by VARIANT rows such as S with stock 3, M with stock 5 and L with stock 2. The Products sheet starts empty.' });
  notes.addRow({ col: 'PRODUCT vs VARIANT', req: '', note: 'A PRODUCT row creates a new piece. VARIANT rows beneath it add size/colour/dimension options. Each variant gets its own stock count.' });
  notes.addRow({ col: 'Variants order', req: '', note: 'List variants immediately below their parent PRODUCT row. They will automatically attach to the closest PRODUCT row above (unless you specify Parent SKU).' });
  notes.addRow({ col: 'Suggested sizes by category', req: '', note: 'Clothing: XS / S / M / L / XL / XXL / Free Size. Jewellery: usually just one variant called "One size". Furniture / homewares: use dimensions e.g. "24cm × 18cm × 30cm".' });
  notes.addRow({ col: 'No variants needed?', req: '', note: 'A PRODUCT row alone creates a draft. To record stock for a single-option piece, add a VARIANT row with a size such as One size and its unit count.' });
  notes.addRow({});
  notes.addRow({ col: 'Important', req: '', note: 'New products start as drafts. Review stock and prices, add photos and publish in Products. Re-uploading the same rows preserves existing items. Edit existing stock and prices in the admin.' });
  notes.addRow({ col: 'SKU', req: '', note: 'Leave the product SKU blank to generate one from its category. Variant SKUs use the parent SKU and an option suffix.' });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ────────────────────────────────────────────────────────────────────
// Import parser
// ────────────────────────────────────────────────────────────────────

export type ParsedRowType = 'PRODUCT' | 'VARIANT';

export interface ParsedRow {
  rowIndex: number; // 1-based, matches Excel row
  rowType: ParsedRowType;
  data: {
    // Product fields (filled when rowType === 'PRODUCT')
    name?: string;
    sku?: string;
    category?: string;
    craft?: string;
    region?: string;
    material?: string;
    mrp?: number;
    sellingPrice?: number;
    shortDescription?: string;
    // Variant fields (filled when rowType === 'VARIANT')
    parentSku?: string;          // explicit parent SKU; otherwise auto-attached to nearest PRODUCT above
    variantSize?: string;
    variantColor?: string;
    variantMaterial?: string;
    variantInventory?: number;
    variantPrice?: number;
  };
  errors: string[];
}

function cellToString(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result).trim();
  return String(v).trim();
}

function cellToNumber(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = cellToString(v).replace(/[₹,\s]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function parseInventoryWorkbook(buffer: Buffer | ArrayBuffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets.find(w => w.name.toLowerCase() === 'products') || wb.worksheets[0];
  if (!sheet) return [];

  // Map header text -> column number
  const headerRow = sheet.getRow(1);
  const headerToCol: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const txt = cellToString(cell.value).toLowerCase();
    headerToCol[txt] = colNumber;
  });

  const findCol = (key: string): number | null => {
    const spec = IMPORT_COLUMNS.find(c => c.key === key);
    if (!spec) return null;
    const txt = spec.header.toLowerCase();
    return headerToCol[txt] ?? null;
  };

  const colMap: Record<string, number | null> = {};
  IMPORT_COLUMNS.forEach(c => { colMap[c.key] = findCol(c.key); });

  const rows: ParsedRow[] = [];
  const lastRow = sheet.rowCount;
  let legacyExampleStart = -10;

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const get = (key: string): any => {
      const c = colMap[key];
      if (!c) return undefined;
      return row.getCell(c).value;
    };

    const rawRowType = cellToString(get('rowType')).toUpperCase();
    const name = cellToString(get('name'));
    const variantSize = cellToString(get('variantSize'));
    const variantColor = cellToString(get('variantColor'));
    const variantInv = cellToNumber(get('variantInventory'));

    // Determine effective row type:
    //  - explicit "VARIANT" → variant
    //  - explicit "PRODUCT" → product
    //  - blank rowType but variant fields filled → variant
    //  - blank rowType but name filled → product
    //  - everything blank → skip
    let rowType: ParsedRowType;
    if (rawRowType === 'VARIANT') {
      rowType = 'VARIANT';
    } else if (rawRowType === 'PRODUCT') {
      rowType = 'PRODUCT';
    } else if (!name && (variantSize || variantColor || cellToString(get('variantMaterial')) || cellToString(get('parentSku')) || cellToString(get('variantInventory')))) {
      rowType = 'VARIANT';
    } else if (name) {
      rowType = 'PRODUCT';
    } else {
      continue; // blank row
    }

    // Older downloads contained a styled example block on the import sheet.
    // Recognise that exact block. An ordinary clothing size is always valid data.
    const italic = row.getCell(colMap.rowType || 1).font?.italic === true;
    if (rowType === 'PRODUCT' && italic && IMPORT_COLUMNS.every(col => {
      const value = cellToString(get(col.key));
      return value === (col.example || '') || (col.key === 'category' && value === 'sarees');
    })) {
      legacyExampleStart = r;
      continue;
    }
    const offset = r - legacyExampleStart - 1;
    if (offset >= 0 && offset < 3 && italic && IMPORT_COLUMNS.every(col => {
      const sample: Record<string,string> = {rowType:'VARIANT',variantSize:['S','M','L'][offset],variantInventory:['3','5','2'][offset]};
      return cellToString(get(col.key)) === (sample[col.key] || '');
    })) continue;

    const errors: string[] = [];
    if (rawRowType && rawRowType !== 'PRODUCT' && rawRowType !== 'VARIANT') errors.push('Row type must be PRODUCT or VARIANT.');
    if (rowType === 'PRODUCT') {
      const data: ParsedRow['data'] = {
        name,
        sku: cellToString(get('sku')) || undefined,
        category: cellToString(get('category')) || undefined,
        craft: cellToString(get('craft')) || undefined,
        region: cellToString(get('region')) || undefined,
        material: cellToString(get('material')) || undefined,
        mrp: cellToNumber(get('mrp')) ?? undefined,
        sellingPrice: cellToNumber(get('sellingPrice')) ?? undefined,
        shortDescription: cellToString(get('shortDescription')) || undefined,
      };
      if (!data.name) errors.push('Name is required');
      if (!data.category) errors.push('Enter a category name or slug');
      if (data.mrp == null || data.mrp <= 0) errors.push('MRP is required and must be > 0');
      if (data.sellingPrice == null || data.sellingPrice <= 0) errors.push('Selling Price is required and must be > 0');
      if (data.mrp != null && data.sellingPrice != null && data.sellingPrice > data.mrp) {
        errors.push('Selling price cannot exceed MRP');
      }
      rows.push({ rowIndex: r, rowType: 'PRODUCT', data, errors });
    } else {
      // VARIANT
      const data: ParsedRow['data'] = {
        parentSku: cellToString(get('parentSku')) || undefined,
        variantSize: variantSize || undefined,
        variantColor: variantColor || undefined,
        variantMaterial: cellToString(get('variantMaterial')) || undefined,
        variantInventory: variantInv ?? undefined,
        variantPrice: cellToNumber(get('variantPrice')) ?? undefined,
      };
      if (cellToString(get('variantInventory')) && (variantInv == null || !Number.isSafeInteger(variantInv) || variantInv < 0 || variantInv > 2147483647)) errors.push('Stock must be a nonnegative whole number.');
      if (cellToString(get('variantPrice')) && !(Number(data.variantPrice) > 0)) errors.push('Variant price must be greater than zero.');
      if (!data.variantSize && !data.variantColor && !data.variantMaterial) {
        errors.push('Variant row needs at least a size, colour, or material');
      }
      rows.push({ rowIndex: r, rowType: 'VARIANT', data, errors });
    }
  }

  return rows;
}

// ────────────────────────────────────────────────────────────────────
// Export builder — embeds images inline in cells
// ────────────────────────────────────────────────────────────────────

export interface ExportVariant {
  sku: string;
  size: string | null;
  color: string | null;
  material: string | null;
  inventory: number;
  sellingPrice: number | null; // paise, optional override
}

export interface ExportProduct {
  id: string;
  name: string;
  sku: string;
  slug: string;
  category: { slug: string; name: string };
  craft: string | null;
  region: string | null;
  material: string | null;
  mrp: number;          // paise
  sellingPrice: number; // paise
  status: string;
  images: string[];
  createdAt: Date;
  variants?: ExportVariant[];
}

async function fetchImageBuffer(url: string): Promise<{ buf: Buffer; ext: 'png' | 'jpeg' } | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    const ext: 'png' | 'jpeg' = ct.includes('png') ? 'png' : 'jpeg';
    const ab = await res.arrayBuffer();
    return { buf: Buffer.from(ab), ext };
  } catch {
    return null;
  }
}

export async function buildExportWorkbook(products: ExportProduct[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEEJEE Admin';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Inventory', {
    properties: { defaultRowHeight: 90 }, // tall rows so embedded images breathe
  });

  sheet.columns = EXPORT_COLUMNS.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  // Header style — madder background, ivory text
  const headerRow = sheet.getRow(1);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFF4EFE6' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B2E2A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  // Image cache so we don't refetch the same URL twice
  const imageCache: Map<string, number> = new Map(); // url -> exceljs imageId

  let excelRow = 1; // header is row 1; first product on row 2

  for (const p of products) {
    excelRow++;

    sheet.addRow({
      rowType: 'PRODUCT',
      name: p.name,
      sku: p.sku,
      slug: p.slug,
      category: p.category?.slug || '',
      categoryPath: (p.category as any)?.path || p.category?.slug || '',
      craft: p.craft || '',
      region: p.region || '',
      material: p.material || '',
      mrp: p.mrp ? Math.round(p.mrp / 100) : '',
      sellingPrice: p.sellingPrice ? Math.round(p.sellingPrice / 100) : '',
      status: p.status,
      imageUrls: (p.images || []).join('\n'),
      createdAt: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : '',
    });

    sheet.getRow(excelRow).height = 80;

    // Embed first image
    const firstImageUrl = (p.images || [])[0];
    if (firstImageUrl) {
      let imageId = imageCache.get(firstImageUrl);
      if (imageId === undefined) {
        const fetched = await fetchImageBuffer(firstImageUrl);
        if (fetched) {
          imageId = wb.addImage({ buffer: fetched.buf as any, extension: fetched.ext });
          imageCache.set(firstImageUrl, imageId);
        }
      }
      if (imageId !== undefined) {
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: excelRow - 1 + 0.1 } as any,
          ext: { width: 100, height: 100 },
        });
      }
    }

    sheet.getCell(excelRow, EXPORT_COLUMNS.findIndex(c => c.key === 'imageUrls') + 1).alignment = {
      vertical: 'top',
      wrapText: true,
    };

    // ─────── Variant rows beneath this product ───────
    if (p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        excelRow++;
        sheet.addRow({
          rowType: 'VARIANT',
          sku: v.sku,
          variantSize: v.size || '',
          variantColor: v.color || '',
          variantMaterial: v.material || '',
          variantInventory: v.inventory,
          variantPrice: v.sellingPrice ? Math.round(v.sellingPrice / 100) : '',
        });
        // Smaller height for variant rows since no embedded image
        sheet.getRow(excelRow).height = 24;
        // Subtle visual cue — light beige fill for variant rows
        for (let col = 1; col <= EXPORT_COLUMNS.length; col++) {
          sheet.getCell(excelRow, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAF6EE' },
          };
          sheet.getCell(excelRow, col).font = { color: { argb: 'FF6B5D4F' }, italic: true };
        }
      }
    }
  }

  // Freeze the header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
