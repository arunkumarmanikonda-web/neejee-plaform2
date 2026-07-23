#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const dryRun = argv.includes('--dry-run');

const fileArg = argv.find((x) => x.startsWith('--file='));
const dataFile = fileArg
  ? path.resolve(process.cwd(), fileArg.slice('--file='.length))
  : path.resolve(process.cwd(), 'scripts', 'legacy-seller-addresses.json');

function clean(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function compact(values) {
  return values.map(clean).filter(Boolean);
}

function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function buildAddress(row) {
  const direct = clean(row.address);
  if (direct) return direct;

  return compact([
    row.addressLine1,
    row.addressLine2,
    row.city,
    row.state,
    row.pincode,
  ]).join(', ');
}

function existingAddress(summary) {
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

function parseRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('Input JSON must be an array.');
  }

  return data;
}

function normalizeRow(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`Row ${index + 1}: each item must be an object.`);
  }

  const normalized = {
    sellerId: clean(row.sellerId),
    email: clean(row.email),
    address: clean(row.address),
    addressLine1: clean(row.addressLine1),
    addressLine2: clean(row.addressLine2),
    city: clean(row.city),
    state: clean(row.state),
    pincode: clean(row.pincode),
  };

  if (!normalized.sellerId && !normalized.email) {
    throw new Error(`Row ${index + 1}: provide sellerId or email.`);
  }

  const computedAddress = buildAddress(normalized);
  if (!computedAddress) {
    throw new Error(
      `Row ${index + 1}: provide address or at least one address component.`,
    );
  }

  normalized.address = computedAddress;
  return normalized;
}

async function findSeller(row) {
  if (row.sellerId) {
    return prisma.seller.findUnique({
      where: { id: row.sellerId },
      select: {
        id: true,
        email: true,
        businessName: true,
        contactName: true,
        autoKycSummary: true,
      },
    });
  }

  return prisma.seller.findFirst({
    where: { email: row.email },
    select: {
      id: true,
      email: true,
      businessName: true,
      contactName: true,
      autoKycSummary: true,
    },
  });
}

async function main() {
  console.log(`Using input file: ${dataFile}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);
  console.log(`Force overwrite existing address: ${force ? 'YES' : 'NO'}`);
  console.log('');

  const rows = parseRows(dataFile).map(normalizeRow);

  let updated = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const seller = await findSeller(row);

      if (!seller) {
        missing += 1;
        console.log(
          `[MISSING] ${row.sellerId || row.email} -> seller not found`,
        );
        continue;
      }

      const prevSummary = asObject(seller.autoKycSummary);
      const prevOnboarding = asObject(prevSummary.onboarding);
      const prevAddress = existingAddress(prevSummary);

      if (prevAddress && !force) {
        skipped += 1;
        console.log(
          `[SKIP] ${seller.id} ${seller.email || ''} -> already has address: ${prevAddress}`,
        );
        continue;
      }

      const nextOnboarding = {
        ...prevOnboarding,
        ...(row.addressLine1 ? { addressLine1: row.addressLine1 } : {}),
        ...(row.addressLine2 ? { addressLine2: row.addressLine2 } : {}),
        ...(row.city ? { city: row.city } : {}),
        ...(row.state ? { state: row.state } : {}),
        ...(row.pincode ? { pincode: row.pincode } : {}),
        address: row.address,
      };

      const nextSummary = {
        ...prevSummary,
        onboarding: nextOnboarding,
      };

      if (dryRun) {
        updated += 1;
        console.log(
          `[DRY] ${seller.id} ${seller.email || ''} -> ${row.address}`,
        );
        continue;
      }

      await prisma.seller.update({
        where: { id: seller.id },
        data: {
          autoKycSummary: nextSummary,
        },
      });

      updated += 1;
      console.log(
        `[OK] ${seller.id} ${seller.email || ''} -> ${row.address}`,
      );
    } catch (err) {
      failed += 1;
      console.error(
        `[FAIL] ${row.sellerId || row.email} -> ${err && err.message ? err.message : err}`,
      );
    }
  }

  console.log('');
  console.log('Summary');
  console.log(`  updated: ${updated}`);
  console.log(`  skipped: ${skipped}`);
  console.log(`  missing: ${missing}`);
  console.log(`  failed:  ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
