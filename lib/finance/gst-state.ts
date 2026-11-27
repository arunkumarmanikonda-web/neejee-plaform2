// Current domestic codes in the NIC e-way bill master:
// https://docs.ewaybillgst.gov.in/apidocs/state-code.html
// Numeric 25 and 28 were assigned historically and require a dated determination.
const stateAliases: ReadonlyArray<readonly [string, ...string[]]> = [
  ['01', 'Jammu and Kashmir', 'JK', 'J & K'],
  ['02', 'Himachal Pradesh', 'HP'],
  ['03', 'Punjab', 'PB'],
  ['04', 'Chandigarh', 'CH'],
  ['05', 'Uttarakhand', 'Uttaranchal', 'UK', 'UT', 'UA', 'UL'],
  ['06', 'Haryana', 'HR'],
  ['07', 'Delhi', 'NCT of Delhi', 'Delhi NCT', 'National Capital Territory of Delhi', 'DL'],
  ['08', 'Rajasthan', 'RJ'],
  ['09', 'Uttar Pradesh', 'UP'],
  ['10', 'Bihar', 'BR'],
  ['11', 'Sikkim', 'SK'],
  ['12', 'Arunachal Pradesh', 'AR'],
  ['13', 'Nagaland', 'NL'],
  ['14', 'Manipur', 'MN'],
  ['15', 'Mizoram', 'MZ'],
  ['16', 'Tripura', 'TR'],
  ['17', 'Meghalaya', 'ML'],
  ['18', 'Assam', 'AS'],
  ['19', 'West Bengal', 'WB'],
  ['20', 'Jharkhand', 'JH'],
  ['21', 'Odisha', 'Orissa', 'OD', 'OR'],
  ['22', 'Chhattisgarh', 'Chattisgarh', 'CG', 'CT'],
  ['23', 'Madhya Pradesh', 'MP'],
  ['24', 'Gujarat', 'GJ'],
  ['26', 'Dadra and Nagar Haveli and Daman and Diu', 'Dadra and Nagar Haveli', 'DH'],
  ['27', 'Maharashtra', 'MH'],
  ['29', 'Karnataka', 'KA'],
  ['30', 'Goa', 'GA'],
  ['31', 'Lakshadweep', 'LD'],
  ['32', 'Kerala', 'KL'],
  ['33', 'Tamil Nadu', 'TN'],
  ['34', 'Puducherry', 'Pondicherry', 'PY'],
  ['35', 'Andaman and Nicobar Islands', 'Andaman and Nicobar', 'AN'],
  ['36', 'Telangana', 'TS', 'TG'],
  ['37', 'Andhra Pradesh', 'AP'],
  ['38', 'Ladakh', 'LA'],
];

function normalizeAlias(value: string): string {
  return value.trim().toUpperCase().replace(/&/g, ' AND ').replace(/\./g, '').replace(/\s+/g, ' ');
}

const codes = new Map<string, string>();
for (const [code, ...aliases] of stateAliases) {
  codes.set(String(Number(code)), code);
  codes.set(code, code);
  for (const alias of aliases) codes.set(normalizeAlias(alias), code);
}

export function gstStateCode(input: string | number | null | undefined): string | null {
  if (input == null) return null;
  const value = normalizeAlias(String(input));
  const isoCode = /^IN-([A-Z]{2})$/.exec(value);
  return codes.get(isoCode?.[1] ?? value) ?? null;
}

export class InvoiceStateReviewError extends Error {}

// These intra-territory supplies need a UTGST ledger and invoice column.
// See CGST Act section 2(114). The current invoice model provides only SGST.
const utgstTerritories = new Set(['04', '26', '31', '35', '38']);
const domesticCountry = (value: string | null | undefined) =>
  ['INDIA', 'IN', 'IND'].includes(String(value ?? '').trim().toUpperCase());

type AddressState = { state?: string | null; country?: string | null };

export function resolveDomesticGstSupply(
  address: AddressState | null,
  issuer: AddressState & { gstin?: string | null },
  configuredState?: string,
) {
  if (!domesticCountry(address?.country) || !domesticCountry(issuer.country)) {
    throw new InvoiceStateReviewError('Domestic GST requires an Indian issuer and delivery country.');
  }

  const buyerState = gstStateCode(address?.state);
  if (!buyerState) throw new InvoiceStateReviewError('Review the delivery state before issuing this invoice.');

  const issuerStates = [configuredState, issuer.state].filter((value): value is string => !!value?.trim());
  const gstin = issuer.gstin?.trim().toUpperCase();
  if (gstin) {
    // CBIC: the first two characters of a 15-character GSTIN are the registration state.
    if (!/^\d{2}[A-Z0-9]{13}$/.test(gstin)) {
      throw new InvoiceStateReviewError('Review the GST registration in issuer settings.');
    }
    issuerStates.push(gstin.slice(0, 2));
  }
  const knownCodes = issuerStates.map(gstStateCode);
  const [issuerState] = knownCodes;
  if (!issuerState || knownCodes.some(code => code !== issuerState)) {
    throw new InvoiceStateReviewError('Set a consistent GST state in issuer settings and NEEJEE_STATE_CODE.');
  }

  const isInterState = buyerState !== issuerState;
  if (!isInterState && utgstTerritories.has(buyerState)) {
    throw new InvoiceStateReviewError('Intra-territory supply requires UTGST invoice and ledger review.');
  }
  return { buyerState, issuerState, isInterState };
}
