import * as cheerio from "cheerio";

export type ImportedProviderTemplate = {
  messageId: string;
  entityId?: string;
  entityName?: string;
  senderId?: string;
  status?: string;
  category?: string;
  language?: string;
  body: string;
  sourcePage?: string;
  rawMeta?: Record<string, unknown>;
};

function clean(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function pickFirst(cells: string[], patterns: RegExp[]) {
  for (const cell of cells) {
    for (const pattern of patterns) {
      if (pattern.test(cell)) return cell;
    }
  }
  return "";
}

function uniqueByMessageId(rows: ImportedProviderTemplate[]) {
  const map = new Map<string, ImportedProviderTemplate>();
  for (const row of rows) {
    if (!map.has(row.messageId)) {
      map.set(row.messageId, row);
    }
  }
  return [...map.values()];
}

export function parseFast2SmsReportHtml(html: string): ImportedProviderTemplate[] {
  const $ = cheerio.load(html);
  const results: ImportedProviderTemplate[] = [];

  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;

    const cells = tds
      .map((__, td) => clean($(td).text()))
      .get()
      .filter(Boolean);

    if (!cells.length) return;

    const numericCells = cells.filter((v) => /^\d{5,25}$/.test(v));
    const messageId = numericCells[0];
    if (!messageId) return;

    const entityId = numericCells.find((v) => v !== messageId) || "";

    const senderId = pickFirst(cells, [/^[A-Z]{3,10}$/]);
    const status = pickFirst(cells, [/approved/i, /pending/i, /rejected/i]);
    const category = pickFirst(cells, [/service/i, /transactional/i, /promotional/i, /implicit/i, /explicit/i]);
    const language = pickFirst(cells, [/english/i, /hindi/i, /marathi/i, /tamil/i, /telugu/i, /kannada/i]);

    const longCells = cells.filter(
      (v) =>
        v.length > 25 &&
        !/approved|pending|rejected/i.test(v) &&
        !/service|transactional|promotional|implicit|explicit/i.test(v)
    );

    const body =
      longCells.find((v) => /\{#var#\}/i.test(v)) ||
      longCells[0] ||
      "";

    const entityName =
      longCells.find(
        (v) =>
          !/\{#var#\}/i.test(v) &&
          !/^dear\b/i.test(v) &&
          !/^neejey\b/i.test(v) &&
          !/^neejee\b/i.test(v)
      ) || "";

    if (!body) return;

    results.push({
      messageId,
      entityId: entityId || undefined,
      entityName: entityName || undefined,
      senderId: senderId || undefined,
      status: status || undefined,
      category: category || undefined,
      language: language || undefined,
      body,
      sourcePage: "https://www.fast2sms.com/dashboard/dlt_manager/report3",
      rawMeta: {
        cells,
        rowText: clean($(tr).text()),
      },
    });
  });

  return uniqueByMessageId(results).filter(
    (row) => /^\d{5,25}$/.test(row.messageId) && row.body.length > 0
  );
}
