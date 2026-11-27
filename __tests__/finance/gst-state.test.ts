import test from 'node:test';
import assert from 'node:assert/strict';
import { gstStateCode, InvoiceStateReviewError, resolveDomesticGstSupply } from '../../lib/finance/gst-state';

const expected = [
  ['01', 'Jammu and Kashmir', 'JK'], ['02', 'Himachal Pradesh', 'HP'], ['03', 'Punjab', 'PB'],
  ['04', 'Chandigarh', 'CH'], ['05', 'Uttarakhand', 'UK'], ['06', 'Haryana', 'HR'],
  ['07', 'Delhi', 'DL'], ['08', 'Rajasthan', 'RJ'], ['09', 'Uttar Pradesh', 'UP'],
  ['10', 'Bihar', 'BR'], ['11', 'Sikkim', 'SK'], ['12', 'Arunachal Pradesh', 'AR'],
  ['13', 'Nagaland', 'NL'], ['14', 'Manipur', 'MN'], ['15', 'Mizoram', 'MZ'],
  ['16', 'Tripura', 'TR'], ['17', 'Meghalaya', 'ML'], ['18', 'Assam', 'AS'],
  ['19', 'West Bengal', 'WB'], ['20', 'Jharkhand', 'JH'], ['21', 'Odisha', 'OD'],
  ['22', 'Chhattisgarh', 'CG'], ['23', 'Madhya Pradesh', 'MP'], ['24', 'Gujarat', 'GJ'],
  ['26', 'Dadra and Nagar Haveli & Daman and Diu', 'DH'], ['27', 'Maharashtra', 'MH'],
  ['29', 'Karnataka', 'KA'], ['30', 'Goa', 'GA'], ['31', 'Lakshadweep', 'LD'],
  ['32', 'Kerala', 'KL'], ['33', 'Tamil Nadu', 'TN'], ['34', 'Puducherry', 'PY'],
  ['35', 'Andaman & Nicobar Islands', 'AN'], ['36', 'Telangana', 'TS'],
  ['37', 'Andhra Pradesh', 'AP'], ['38', 'Ladakh', 'LA'],
];
const india = (state: string) => ({ state, country: 'IN' });

test('all current 36 domestic states/UTs round-trip from names, postal abbreviations and padded or unpadded codes', () => {
  for (const [code, name, abbreviation] of expected) {
    for (const value of [Number(code), code, name, name.toLowerCase(), abbreviation, 'IN-' + abbreviation]) {
      assert.equal(gstStateCode(value), code, String(value));
    }
  }
});

test('recognises established alternative spellings and punctuation, never a name prefix', () => {
  for (const [value, code] of [
    ['  U.P. ', '09'], ['J & K', '01'], ['Uttar  Pradesh', '09'], ['Orissa', '21'],
    ['Pondicherry', '34'], ['Chattisgarh', '22'], ['IN-TG', '36'], ['NCT of Delhi', '07'],
  ]) assert.equal(gstStateCode(value), code);
  for (const value of ['MA', 'Mumbai', 'UP or UK', '09/27', '27 Maharashtra', 'IN-FR', '009', '', null, undefined]) {
    assert.equal(gstStateCode(value), null);
  }
});

test('legacy codes and other territory or country require a specific determination', () => {
  for (const state of ['25', '28', '97', '99', 'Other country', 'Daman and Diu']) {
    assert.throws(() => resolveDomesticGstSupply(india(state), india('09')), InvoiceStateReviewError);
  }
  assert.throws(() => resolveDomesticGstSupply({state:'Delhi',country:'US'}, india('09')), InvoiceStateReviewError);
  assert.throws(() => resolveDomesticGstSupply(null, india('09')), InvoiceStateReviewError);
});

test('compares canonical codes across configuration, issuer registration, and delivery address', () => {
  const issuer = { country: 'India', state: 'Uttar Pradesh', gstin: '09ABCDE1234F1Z0' };
  assert.deepEqual(resolveDomesticGstSupply(india('UP'), issuer, '9'), {buyerState:'09', issuerState:'09', isInterState:false});
  assert.deepEqual(resolveDomesticGstSupply(india('Maharashtra'), issuer), {buyerState:'27', issuerState:'09', isInterState:true});
  assert.equal(resolveDomesticGstSupply(india('MH'), {country:'IN',gstin:'27ABCDE1234F1Z0'}).isInterState, false);
  assert.equal(resolveDomesticGstSupply(india('Maharashtra'), {country:'IN'}, '27').isInterState, false);
  assert.equal(resolveDomesticGstSupply(india('Uttarakhand'), india('Uttar Pradesh')).isInterState, true);
});

test('unknown, absent, malformed and conflicting issuer settings are actionable review cases', () => {
  const buyer = india('09');
  for (const [issuer, config] of [
    [{ country:'IN' }, undefined],
    [india('MA'), '27'],
    [{...india('09'), gstin:'bad'}, undefined],
    [{...india('09'), gstin:'27ABCDE1234F1Z0'}, undefined],
    [india('09'), '27'],
    [india('09'), 'OH'],
    [{state:'09',country:'US'}, undefined],
  ] as const) assert.throws(() => resolveDomesticGstSupply(buyer, issuer, config), InvoiceStateReviewError);
});

test('territories that need a UTGST column are held for review only for an intra-territory sale', () => {
  for (const code of ['04', '26', '31', '35', '38']) {
    assert.throws(() => resolveDomesticGstSupply(india(code), india(code)), /UTGST/);
    assert.equal(resolveDomesticGstSupply(india(code), india('09')).isInterState, true);
  }
});
