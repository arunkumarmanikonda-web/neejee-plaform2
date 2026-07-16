const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SOURCE_NAME = 'Fast2SMS DLT API 16-07-2026 04-47-59 pm.xlsx';

const catalog = [
  {
    messageId: '218985',
    senderId: 'NEEJEY',
    body: 'Dear {#var#}, NEEJEE login OTP is {#var#}. It is valid for 10 minutes. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.\\n',
    dltContentTemplateId: '1207178237469870831',
    variableCount: 2,
  },
  {
    messageId: '218994',
    senderId: 'NEEJEY',
    body: 'Dear {#var#}, your NEEJEE order {#var#} has been placed successfully with Cash on Delivery. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237722312205',
    variableCount: 2,
  },
  {
    messageId: '219001',
    senderId: 'NEEJEY',
    body: 'Dear {#var#}, NEEJEE received payment for your order {#var#}. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237014527997',
    variableCount: 2,
  },
  {
    messageId: '218999',
    senderId: 'NEEJEY',
    body: 'Dear {#var#}, your NEEJEE order {#var#} has been shipped. We will update you on delivery. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237876207161',
    variableCount: 2,
  },
  {
    messageId: '219003',
    senderId: 'NEEJEY',
    body: 'Dear {#var#} , your NEEJEE order has been delivered successfully. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237721142000',
    variableCount: 1,
  },
  {
    messageId: '218987',
    senderId: 'NEEJEY',
    body: 'Dear {#var#} , your NEEJEE order {#var#}  has been cancelled. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237580417799',
    variableCount: 2,
  },
  {
    messageId: '219000',
    senderId: 'NEEJEY',
    body: 'Dear {#var#} , refund for your NEEJEE order {#var#} has been processed. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237369537009',
    variableCount: 2,
  },
  {
    messageId: '219008',
    senderId: 'NEEJEY',
    body: 'Dear {#var#} , your selected NEEJEE items are waiting for you. Continue here: {#var#} . \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237292729998',
    variableCount: 2,
  },
  {
    messageId: '218995',
    senderId: 'NEEJEY',
    body: 'Dear {#var#} , your NEEJEE seller payout for reference {#var#} has been processed. \\n\\nRegards, \\nNEEJEE, \\nOye Imagine Private Limited.',
    dltContentTemplateId: '1207178237044108556',
    variableCount: 2,
  }
];

const mappings = [
  {
    event: 'otp_login',
    messageId: '218985',
    note: 'Seeded from Fast2SMS workbook. Exact approved OTP template.',
  },
  {
    event: 'order_placed',
    messageId: '218994',
    note: 'Seeded from Fast2SMS workbook. This approved template is explicitly Cash on Delivery; review if order_placed also covers prepaid orders.',
  },
  {
    event: 'payment_confirmed',
    messageId: '219001',
    note: 'Seeded from Fast2SMS workbook. Exact approved payment-received template.',
  },
  {
    event: 'order_shipped',
    messageId: '218999',
    note: 'Seeded from Fast2SMS workbook. Exact approved shipped template.',
  },
  {
    event: 'order_delivered',
    messageId: '219003',
    note: 'Seeded from Fast2SMS workbook. Exact approved delivered template.',
  },
  {
    event: 'order_cancelled',
    messageId: '218987',
    note: 'Seeded from Fast2SMS workbook. Exact approved cancelled template.',
  },
  {
    event: 'refund_initiated',
    messageId: '219000',
    note: 'Seeded from Fast2SMS workbook. Approved template wording says refund processed; review if your event fires before refund completion.',
  },
  {
    event: 'abandoned_cart',
    messageId: '219008',
    note: 'Seeded from Fast2SMS workbook. Exact approved abandoned-cart template.',
  },
  {
    event: 'seller_payout',
    messageId: '218995',
    note: 'Seeded from Fast2SMS workbook. Exact approved seller payout template.',
  }
];

function mergeNotes(existing, extra) {
  const current = String(existing || '').trim();
  const add = String(extra || '').trim();
  if (!current) return add;
  if (!add) return current;
  if (current.includes(add)) return current;
  return `${current}\n${add}`;
}

async function main() {
  console.log('=== Upserting approved Fast2SMS provider catalog ===');
  for (const row of catalog) {
    await prisma.fast2SmsProviderTemplate.upsert({
      where: { messageId: row.messageId },
      update: {
        senderId: row.senderId,
        status: 'Approved',
        category: 'service',
        language: 'english',
        body: row.body,
        sourcePage: SOURCE_NAME,
        rawMeta: {
          source: SOURCE_NAME,
          dltContentTemplateId: row.dltContentTemplateId,
          variableCount: row.variableCount,
        },
      },
      create: {
        messageId: row.messageId,
        entityId: process.env.FAST2SMS_ENTITY_ID || null,
        entityName: 'Oye Imagine Private Limited',
        senderId: row.senderId,
        status: 'Approved',
        category: 'service',
        language: 'english',
        body: row.body,
        sourcePage: SOURCE_NAME,
        rawMeta: {
          source: SOURCE_NAME,
          dltContentTemplateId: row.dltContentTemplateId,
          variableCount: row.variableCount,
        },
      },
    });
    console.log(`provider upserted: ${row.messageId}`);
  }

  const catalogById = new Map(catalog.map((row) => [row.messageId, row]));

  console.log('');
  console.log('=== Updating SmsTemplate event mappings ===');
  for (const item of mappings) {
    const existing = await prisma.smsTemplate.findUnique({
      where: { event: item.event },
    });

    if (!existing) {
      console.log(`missing smsTemplate row for event: ${item.event}`);
      continue;
    }

    const provider = catalogById.get(item.messageId);
    const expectedVarCount = provider.variableCount;

    let nextVarOrder = Array.isArray(existing.varOrder) ? [...existing.varOrder] : [];
    if (nextVarOrder.length > expectedVarCount) {
      nextVarOrder = nextVarOrder.slice(0, expectedVarCount);
    }
    while (nextVarOrder.length < expectedVarCount) {
      nextVarOrder.push(`var${nextVarOrder.length + 1}`);
    }

    const nextNotes = mergeNotes(existing.notes, item.note);

    await prisma.smsTemplate.update({
      where: { event: item.event },
      data: {
        templateId: item.messageId,
        body: provider.body,
        varOrder: nextVarOrder,
        notes: nextNotes,
      },
    });

    console.log(`mapped ${item.event} -> ${item.messageId} (vars=${nextVarOrder.join('|')})`);
  }

  console.log('');
  console.log('=== Leaving vendor_payout unchanged ===');
  console.log('No exact vendor_payout template was present in the workbook subset used for this hardening patch.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });