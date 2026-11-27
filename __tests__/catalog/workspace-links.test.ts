import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRUD_ENTITIES } from '../../app/admin/ops/_lib/entities';

test('every operations workspace and shortcut leads to an implemented admin page',()=>{
  for (const item of CRUD_ENTITIES) {
    for (const href of [item.href,...item.actions.map(action=>action.href)]) {
      assert.ok(existsSync(join('app',href.split('?')[0],'page.tsx')),href);
    }
  }
});

test('catalogue project actions, payroll links and the bulk template ship together',()=>{
  for (const file of [
    'app/api/admin/catalogues/[id]/route.ts','app/api/admin/catalogues/[id]/draft/route.ts',
    'app/admin/payroll/config/page.tsx','app/admin/payroll/attendance/page.tsx',
    'app/admin/editorial-blocks/[id]/preview/page.tsx','app/(shop)/legal/terms/page.tsx',
  ]) assert.ok(existsSync(file),file);
  assert.equal(readFileSync('public/seller-bulk-template.csv','utf8').trim(),'name,sku,mrp,sellingPrice,description,material,images');
});
