import type { ParsedRow } from '../inventory-io';

/** Associate a colour with its product even when the variant sits elsewhere in the workbook. */
export function workbookColours(rows:ParsedRow[]) {
  const bySku=new Map<string,number>();
  for(const row of rows) if(row.rowType==='PRODUCT' && !row.errors.length && row.data.sku && !bySku.has(row.data.sku)) {
    bySku.set(row.data.sku,row.rowIndex);
  }
  const colours=new Map<number,string[]>();
  let parent:number | undefined;
  for (const row of rows) {
    if(row.rowType==='PRODUCT') {parent=row.errors.length ? undefined : row.rowIndex;continue;}
    const key=row.data.parentSku ? bySku.get(row.data.parentSku) : parent;
    const colour=row.data.variantColor?.trim();
    if(row.errors.length || !key || !colour) continue;
    const list=colours.get(key) ?? [];
    if(!list.includes(colour)) list.push(colour);
    colours.set(key,list);
  }
  return colours;
}
