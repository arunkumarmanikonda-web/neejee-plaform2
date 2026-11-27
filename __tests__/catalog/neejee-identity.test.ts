import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { studies } from '../../lib/shop-studies';
import { editorialLooks } from '../../lib/stylebook';
import { studyTextiles } from '../../lib/study-textiles';

test('the initial page embeds the full black wordmark with the central red bindi', () => {
  const config = require('../../next.config.js');
  const artwork = readFileSync('public/brand/identity/lockup.svg', 'utf8');
  assert.equal(config.env.NEEJEE_SIGNATURE_SRC, 'data:image/svg+xml;base64,' + Buffer.from(artwork).toString('base64'));
  assert.match(artwork, /<circle[^>]+fill="#A33337"/);
  assert.match(artwork, /Found\. Personal\./);
});

test('the fittings use the same garment names as the product shelf', () => {
  for (const look of editorialLooks) {
    const piece = studies.find(item => item.id === look.id);
    assert.ok(piece);
    assert.equal(look.name, piece.name);
    assert.equal(piece.name, studyTextiles[piece.id].name);
    assert.notEqual(piece.alias, piece.name);
    assert.notEqual(piece.caption, piece.detail);
  }
});
