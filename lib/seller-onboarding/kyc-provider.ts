export type UpstreamResult = {
  ok: boolean;
  status: number;
  data: any;
};

export type BankVerificationResult =
  | {
      configured: false;
      status: number;
      error: string;
      missing?: string[];
    }
  | {
      configured: true;
      status: number;
      ok: boolean;
      data?: {
        provider: string;
        ifsc: string;
        accountLast4: string;
        registeredName: string | null;
        bankName: string | null;
        nameMatchScore: number | null;
        raw: any;
      };
      error?: string;
      details?: any;
    };

function parseBoolean(value: unknown): boolean {
  const v = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(v);
}

export function isKycMockMode(): boolean {
  return parseBoolean(process.env.KYC_MOCK_MODE);
}

export function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function accountLast4(value: unknown): string {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.slice(-4);
}

export function toBasicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<UpstreamResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

function getMissingPairs(pairs: Array<[string, string]>): string[] {
  return pairs.filter(([, value]) => !String(value || '').trim()).map(([name]) => name);
}

export async function verifyBankWithRazorpayX(input: {
  bankAccount: string;
  ifsc: string;
  businessName?: string | null;
}): Promise<BankVerificationResult> {
  const keyId = (process.env.RAZORPAYX_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAYX_KEY_SECRET || '').trim();
  const sourceAccountNumber = (process.env.RAZORPAYX_SOURCE_ACCOUNT_NUMBER || '').trim();
  const baseUrl = (process.env.RAZORPAYX_BASE_URL || 'https://api.razorpay.com').replace(/\/+$/, '');

  const missing = getMissingPairs([
    ['RAZORPAYX_KEY_ID', keyId],
    ['RAZORPAYX_KEY_SECRET', keySecret],
    ['RAZORPAYX_SOURCE_ACCOUNT_NUMBER', sourceAccountNumber],
  ]);

  if (missing.length > 0) {
    return {
      configured: false,
      status: 503,
      error: 'RazorpayX bank verification is not configured',
      missing,
    };
  }

  const authHeader = toBasicAuthHeader(keyId, keySecret);
  const businessName = normalizeText(input.businessName) || 'Seller Applicant';
  const cleanedIfsc = normalizeUpper(input.ifsc);
  const cleanedAccount = String(input.bankAccount || '').replace(/\s+/g, '');

  const referenceId = `seller_kyc_${Date.now()}`;

  const contactResponse = await postJson(
    `${baseUrl}/v1/contacts`,
    {
      name: businessName,
      type: 'vendor',
      reference_id: referenceId,
      notes: {
        module: 'seller_onboarding',
        purpose: 'bank_verification',
      },
    },
    {
      Authorization: authHeader,
    },
  );

  if (!contactResponse.ok || !contactResponse.data?.id) {
    return {
      configured: true,
      status: contactResponse.status,
      ok: false,
      error: 'RazorpayX contact creation failed',
      details: contactResponse.data,
    };
  }

  const contactId = contactResponse.data.id;

  const fundAccountResponse = await postJson(
    `${baseUrl}/v1/fund_accounts`,
    {
      contact_id: contactId,
      account_type: 'bank_account',
      bank_account: {
        name: businessName,
        ifsc: cleanedIfsc,
        account_number: cleanedAccount,
      },
    },
    {
      Authorization: authHeader,
    },
  );

  if (!fundAccountResponse.ok || !fundAccountResponse.data?.id) {
    return {
      configured: true,
      status: fundAccountResponse.status,
      ok: false,
      error: 'RazorpayX fund account creation failed',
      details: fundAccountResponse.data,
    };
  }

  const fundAccountId = fundAccountResponse.data.id;

  const validationResponse = await postJson(
    `${baseUrl}/v1/fund_accounts/validations`,
    {
      account_number: sourceAccountNumber,
      fund_account: {
        id: fundAccountId,
      },
      amount: 100,
      currency: 'INR',
      notes: {
        module: 'seller_onboarding',
        purpose: 'bank_verification',
      },
    },
    {
      Authorization: authHeader,
    },
  );

  if (!validationResponse.ok) {
    return {
      configured: true,
      status: validationResponse.status,
      ok: false,
      error: 'RazorpayX bank validation failed',
      details: validationResponse.data,
    };
  }

  const raw = validationResponse.data || {};
  const bank = raw?.fund_account?.bank_account || {};
  const results = raw?.results || {};

  return {
    configured: true,
    status: 200,
    ok: true,
    data: {
      provider: 'razorpayx',
      ifsc: normalizeUpper(results.ifsc || bank.ifsc || cleanedIfsc),
      accountLast4: accountLast4(results.account_number || bank.account_number || cleanedAccount),
      registeredName: results.registered_name || bank.name || null,
      bankName: results.bank_name || bank.bank_name || null,
      nameMatchScore:
        typeof results.name_match_score === 'number'
          ? results.name_match_score
          : typeof raw.name_match_score === 'number'
          ? raw.name_match_score
          : null,
      raw,
    },
  };
}