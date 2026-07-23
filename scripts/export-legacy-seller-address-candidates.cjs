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

function existingSellerAddress(summary) {
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

function mapUserAddress(address) {
  if (!address) return null;

  const line1 = clean(address.line1);
  const line2 = clean(address.line2);
  const city = clean(address.city);
  const state = clean(address.state);
  const pincode = clean(address.pincode);
  const joined = compact([line1, line2, city, state, pincode]).join(', ');

  if (!joined) return null;

  return {
    addressLine1: line1,
    addressLine2: line2,
    city,
    state,
    pincode,
    address: joined,
  };
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'scripts');
  const allFile = path.join(outDir, 'legacy-seller-address-candidates.json');
  const readyFile = path.join(outDir, 'legacy-seller-addresses.ready.json');

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
      userId: true,
      autoKycSummary: true,
      user: {
        select: {
          id: true,
          email: true,
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
            select: {
              id: true,
              name: true,
              phone: true,
              line1: true,
              line2: true,
              city: true,
              state: true,
              pincode: true,
              isDefault: true,
            },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const missing = sellers
    .map((s) => {
      const currentAddress = existingSellerAddress(s.autoKycSummary);
      if (currentAddress) return null;

      const chosenAddress =
        (s.user?.addresses || []).find((a) => a.isDefault) ||
        (s.user?.addresses || [])[0] ||
        null;

      const mapped = mapUserAddress(chosenAddress);

      return {
        sellerId: s.id,
        email: clean(s.email),
        businessName: clean(s.businessName),
        contactName: clean(s.contactName),
        phone: clean(s.phone),
        region: clean(s.region),
        cluster: clean(s.cluster),
        craft: clean(s.craft),
        userId: clean(s.userId),
        candidateSource: mapped ? 'user.addresses' : '',
        candidateAddressId: chosenAddress ? clean(chosenAddress.id) : '',
        addressLine1: mapped ? mapped.addressLine1 : '',
        addressLine2: mapped ? mapped.addressLine2 : '',
        city: mapped ? mapped.city : '',
        state: mapped ? mapped.state : '',
        pincode: mapped ? mapped.pincode : '',
        address: mapped ? mapped.address : '',
      };
    })
    .filter(Boolean);

  const ready = missing.filter((x) => clean(x.address));

  fs.writeFileSync(allFile, JSON.stringify(missing, null, 2), 'utf8');
  fs.writeFileSync(readyFile, JSON.stringify(ready, null, 2), 'utf8');

  console.log(`Missing-address sellers exported: ${missing.length}`);
  console.log(`Auto-ready backfill rows exported: ${ready.length}`);
  console.log(`All candidates: ${allFile}`);
  console.log(`Ready rows: ${readyFile}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });