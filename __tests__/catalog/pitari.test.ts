import assert from 'node:assert/strict';
import { describe,it } from 'node:test';
import { parsePitari } from '../../lib/pitari';

describe('Pitari shopping requests',()=>{
  it('understands rupee caps and Hindi numerals',()=>{
    assert.equal(parsePitari('under ₹4,999').maxPaise,499899);
    assert.equal(parsePitari('up to ₹4,999').maxPaise,499900);
    assert.equal(parsePitari('₹५,००० तक').maxPaise,500000);
    assert.equal(parsePitari('below 2.5k').maxPaise,249999);
  });
  it('preserves material and item constraints when shopping for a gift',()=>{
    const p=parsePitari('A brass vase for my mother');assert.deepEqual(p.terms.sort(),['brass','vase']);assert.deepEqual(p.words,[]);
  });
  it('distinguishes order questions from factual follow-ups',()=>{
    assert.equal(parsePitari('Where is my order?').service,'track');
    assert.equal(parsePitari('Where is it from?').detail,'origin');
    assert.equal(parsePitari('What is it made of?').detail,'material');
  });
});
