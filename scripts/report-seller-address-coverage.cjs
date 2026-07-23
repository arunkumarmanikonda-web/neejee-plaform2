const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function clean(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function compact(values) {
  return values.map(clean).filter(Boolean);
}

function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function onboardingAddress(summary) {
  const root = asObject(summary);
  const onboarding = asObject(root.onboarding);
  const direct = clean(onboarding.address);
  if (direct) return direct;
  return compact([
    onboarding.addressLine1,
    onboarding.addressLine2,
    onboarding.city,
    onboarding.state,
    onboarding.pincode,
  ]).join(', ');
}

function userAddress(addresses) {
  const list = Array.isArray(addresses) ? addresses : [];
  const chosen = list.find((a) => a && a.isDefault) || list[0] || null;
  if (!chosen) return '';
  return compact([
    chosen.line1,
    chosen.line2,
    chosen.city,
    chosen.state,
    chosen.pincode,
  ]).join(', ');
}

async function main() {
  const sellers = await prisma.seller.findMany({
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      region: true,
      cluster: true,
      craft: true,
      autoKycSummary: true,
      user: {
        select: {
          id: true,
          email: true,
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
            select: {
              line1: true,
              line2: true,
              city: true,
              state: true,
              pincode: true,
              isDefault: true,
            }
          }
        }
      }
    },
    orderBy: { id: 'asc' }
  });

  const rows = sellers.map((s) => {
    const onboarding = onboardingAddress(s.autoKycSummary);
    const userAddr = userAddress(s.user?.addresses || []);
    return {
      sellerId: s.id,
      businessName: clean(s.businessName),
      contactName: clean(s.contactName),
      email: clean(s.email),
      phone: clean(s.phone),
      region: clean(s.region),
      cluster: clean(s.cluster),
      craft: clean(s.craft),
      hasOnboardingAddress: onboarding ? 'YES' : 'NO',
      onboardingAddress: onboarding,
      hasUserAddress: userAddr ? 'YES' : 'NO',
      userAddress: userAddr,
    };
  });

  const totals = {
    totalSellers: rows.length,
    onboardingAddressYes: rows.filter((r) => r.hasOnboardingAddress === 'YES').length,
    onboardingAddressNo: rows.filter((r) => r.hasOnboardingAddress === 'NO').length,
    userAddressYes: rows.filter((r) => r.hasUserAddress === 'YES').length,
    userAddressNo: rows.filter((r) => r.hasUserAddress === 'NO').length,
  };

  const outDir = path.resolve(process.cwd(), 'scripts');
  const jsonPath = path.join(outDir, 'seller-address-coverage.json');
  const csvPath = path.join(outDir, 'seller-address-coverage.csv');

  fs.writeFileSync(jsonPath, JSON.stringify({ totals, rows }, null, 2), 'utf8');

  const esc = (v) => {
    const s = String(v ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };

  const headers = [
    'sellerId',
    'businessName',
    'contactName',
    'email',
    'phone',
    'region',
    'cluster',
    'craft',
    'hasOnboardingAddress',
    'onboardingAddress',
    'hasUserAddress',
    'userAddress'
  ];

  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))
  ].join('\n');

  fs.writeFileSync(csvPath, csv, 'utf8');

  console.log(JSON.stringify(totals, null, 2));
  console.log(jsonPath);
  console.log(csvPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });