"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AgreementPayload = any;

function safe(value: any) {
  return value === null || value === undefined || value === "" ? "â€”" : String(value);
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <tr>
      <td style={{ width: "34%", padding: "6px 8px", verticalAlign: "top", color: "#5b5348", fontWeight: 700 }}>{label}</td>
      <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{safe(value)}</td>
    </tr>
  );
}

export default function AgreementPrintClient({
  id,
  dataUrl,
}: {
  id: string;
  dataUrl?: string;
}) {
  const [data, setData] = useState<AgreementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const res = await fetch(dataUrl || `/api/admin/sellers/${id}/agreement`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Failed to load agreement (${res.status})`);

        const agreement = json?.agreement ?? json;
        if (alive) setData(agreement);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load agreement");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, dataUrl]);

  if (loading) return <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Loading agreement...</div>;
  if (err) return <div style={{ padding: 24, color: "#991b1b", fontFamily: "Arial, sans-serif" }}>{err}</div>;
  if (!data) return <div style={{ padding: 24, color: "#991b1b", fontFamily: "Arial, sans-serif" }}>Agreement not found.</div>;

  const company = data?.company || {};
  const seller = data?.seller || {};
  const terms = data?.commercialTerms || {};
  const clauses = Array.isArray(data?.clauses) ? data.clauses : [];

  const executionDateRaw = data?.executionDate || data?.agreementDate || data?.lockedAt || data?.generatedAt || null;
  const exportDate = executionDateRaw ? new Date(executionDateRaw) : new Date();
  const executionDate = exportDate.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  const companyName = company?.legalName || company?.brandName || "Oye Imagine Private Limited";
  const sellerName = seller?.businessName || seller?.name || "Seller";
  const sellerId = seller?.id || seller?.sellerId || id;
  const placeOfExecution = company?.address || "Noida, Uttar Pradesh, India";

  const logoUrl = String(company?.logoUrl || "");
  const legalNameText = String(company?.legalName || "");
  const brandNameText = String(company?.brandName || "");
  const isOyeImagineEntity = /oye imagine/i.test(`${legalNameText} ${brandNameText}`);
  const signatoryName = String(
    company?.authorisedSignatory || company?.signatoryName || (isOyeImagineEntity ? "Nidhi" : "Authorised Signatory")
  );
  const signatoryTitle = String(company?.signatoryTitle || "Authorised Signatory");
  const signatureUrl = String(company?.signatureUrl || "");

  function safeFilePart(value: any) {
    return (
      String(value || "seller")
        .replace(/[\\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "") || "seller"
    );
  }

  const exportBaseName = "NEEJEE Â· Found. Personal_";

  const handlePrint = () => {
  const previousTitle = document.title;
  const titleEl = document.querySelector("title");
  const previousTitleTag = titleEl?.textContent ?? previousTitle;
  const nextTitle = exportBaseName;

  const restoreTitle = () => {
    document.title = previousTitle;
    if (titleEl) titleEl.textContent = previousTitleTag;
    window.removeEventListener("afterprint", restoreTitle);
  };

  document.title = nextTitle;
  if (titleEl) titleEl.textContent = nextTitle;
  window.addEventListener("afterprint", restoreTitle, { once: true });

  window.setTimeout(() => {
    window.print();
  }, 150);
};

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        :root{
          --ink:#1c1917;
          --muted:#6b6257;
          --line:#d8cfc2;
          --gold:#b79b6c;
          --gold-soft:#e8ddca;
          --paper:#fffdfa;
          --panel:#faf6ef;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #f3efe8;
          color: var(--ink);
          font-family: "Times New Roman", Georgia, serif;
        }

        .toolbar {
          max-width: 210mm;
          margin: 18px auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          font-family: Arial, Helvetica, sans-serif;
        }

        .toolbar .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          min-height: 40px;
          border: 1px solid #d6d3d1;
          border-radius: 8px;
          text-decoration: none;
          background: #fff;
          color: #111827;
          font: 600 14px/1 Arial, Helvetica, sans-serif;
          cursor: pointer;
        }

        .btn.primary {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }

        .sheet {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          margin: 16px auto 24px;
          background: var(--paper);
          box-shadow: 0 12px 40px rgba(15,23,42,.12);
          padding: 18mm 16mm 24mm;
          overflow: hidden;
        }

        .sheet::before {
          content: "";
          position: absolute;
          inset: 8mm;
          border: 1px solid var(--gold);
          pointer-events: none;
        }

        .sheet::after {
          content: "";
          position: absolute;
          inset: 11mm;
          border: 1px solid var(--line);
          pointer-events: none;
        }

        .pageFrame {
          display: none;
        }

        .title {
          text-align: center;
          margin-bottom: 20px;
          padding: 0 10mm;
        }

        .brandTop {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }

        .brandTop img {
          display: block;
          max-height: 44px;
          max-width: 180px;
          width: auto;
          height: auto;
          object-fit: contain;
        }

        .brandWord {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink);
        }

        .title h1 {
          margin: 4px 0 6px;
          font-size: 28px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .title p {
          margin: 4px 0;
          font-size: 14px;
          color: var(--muted);
        }

        .goldRule {
          width: 120px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          margin: 12px auto 0;
        }

        .section {
          position: relative;
          z-index: 1;
          margin-top: 20px;
          page-break-inside: avoid;
        }

        .section h2 {
          margin: 0 0 10px;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--gold-soft);
          padding-bottom: 6px;
          color: #2a241c;
        }

        .opening, .whereas, .box {
          border: 1px solid var(--line);
          padding: 14px;
          background: #fff;
        }

        .whereas, .box.annex {
          background: var(--panel);
        }

        .opening p, .whereas p, .clause p, .annex p {
          margin: 0 0 10px;
          font-size: 14px;
          line-height: 1.8;
          text-align: justify;
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .box h3 {
          margin: 0 0 10px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }

        .kv {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .kv tr:not(:last-child) td {
          border-bottom: 1px solid #ede7dc;
        }

        .clause {
          margin-top: 16px;
          page-break-inside: avoid;
        }

        .clause h3 {
          margin: 0 0 8px;
          font-size: 15px;
          color: #221f1b;
        }

        .sigWrap {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .sigBox {
          min-height: 170px;
          border: 1px solid var(--line);
          background: #fff;
          padding: 14px 14px 12px;
          font-size: 13px;
          line-height: 1.8;
          position: relative;
        }

        .sigLabel {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .signatureImageWrap {
          height: 64px;
          display: flex;
          align-items: flex-end;
          margin: 4px 0 6px;
        }

        .signatureImage {
          max-height: 56px;
          max-width: 180px;
          object-fit: contain;
          display: block;
        }

        .signatureFallback {
          font-family: "Brush Script MT", "Segoe Script", cursive;
          font-size: 28px;
          color: #40372b;
          line-height: 1;
        }

        .signatureLine {
          margin-top: 8px;
          border-top: 1px solid #8c8172;
          padding-top: 8px;
        }

        .small {
          font-size: 12px;
          color: var(--muted);
        }

        .docFooter {
          margin-top: 28px;
          border-top: 1px solid var(--gold-soft);
          padding-top: 10px;
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 12px;
          align-items: start;
          font-size: 11px;
          color: var(--muted);
        }

        .docFooterTitle {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #4d4438;
          margin-bottom: 4px;
          font-weight: 700;
        }




        .pageNo {
          text-align: right;
          font-style: italic;
        }

        @page {
          size: A4;
          margin: 14mm;
        }

                @media screen {
          .sheet {
            position: relative;
            overflow: hidden;
            background-color: #fff;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
            background-image: repeating-linear-gradient(
              to bottom,
              transparent 0,
              transparent calc(297mm - 1px),
              rgba(120, 104, 78, 0.35) calc(297mm - 1px),
              rgba(120, 104, 78, 0.35) 297mm
            );
            background-size: 100% 297mm;
          }

          .docFooter {
            display: none;
          }

          .toolbar {
            position: sticky;
            top: 0;
            z-index: 10;
            background: rgba(245, 241, 235, 0.92);
            backdrop-filter: blur(4px);
          }
        }
        @media print {
          h1, h2, h3 {
            break-after: avoid-page;
            page-break-after: avoid;
          }

          .section,
          .clause,
          .sigWrap,
          .box,
          table,
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          p,
          li {
            orphans: 3;
            widows: 3;
          }

          .grid2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }

          .grid2 > * + * {
            margin-top: 0 !important;
          }

          .box {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d8cfc2;
            border-radius: 10px;
            padding: 12px;
            background: #fff;
          }

          .kv {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .kv td {
            border-bottom: 1px solid #ede7dc;
          }

          html, body {
            background: white !important;
          }

          .toolbar {
            display: none !important;
          }

          .sheet {
            width: auto;
            min-height: auto;
            margin: 0;
            box-shadow: none;
            padding: 0 0 18mm 0;
            background: white;
          }

          .sheet::before,
        .sheet::after {
          display: none;
        }

          .pageFrame {
          display: none;
        }

          .pageFrame::after {
          display: none;
        }

          .docFooter {
          margin-top: 28px;
          border-top: 1px solid var(--gold-soft);
          padding-top: 10px;
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 12px;
          align-items: start;
          font-size: 11px;
          color: var(--muted);
        }

          .docFooter {
            display: none !important;
          }

          a {
            color: inherit;
            text-decoration: none;
          }
        }

        @media (max-width: 900px) {
          .sheet {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 20px 16px 28px;
          }

          .grid2,
          .sigWrap,
          .docFooter {
            grid-template-columns: 1fr;
          }

          .title {
            padding: 0;
          }
        }
          .sheet {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 20px 16px 28px;
          }

          .grid2,
          .sigWrap,
          .docFooter {
            grid-template-columns: 1fr;
          }

          .title {
            padding: 0;
          }
        }

          .grid2,
          .sigWrap,
          .docFooter {
            grid-template-columns: 1fr;
          }

          .title {
            padding: 0;
          }
        }
      `}</style>

      <div className="toolbar">
        <Link href={`/admin/sellers/${id}`} className="btn">Back to seller</Link>
        <div className="actions">
          <button className="btn primary" onClick={handlePrint}>Save / Print PDF</button>
        </div>
      </div>

      <main className="sheet">
        <div className="pageFrame" aria-hidden="true"></div>

        <div className="title">
          {(logoUrl || company?.brandName) ? (
            <div className="brandTop">
              {logoUrl ? (
                <img src={logoUrl} alt={safe(company?.brandName || companyName)} />
              ) : (
                <div className="brandWord">{safe(company?.brandName || companyName)}</div>
              )}
            </div>
          ) : null}
          <h1>{data?.title || "Marketplace Seller Agreement"}</h1>
          <p>{data?.subtitle || "Standard company agreement with seller-specific commercial terms"}</p>
          <p>Execution Date: {executionDate}</p>
          <div className="goldRule"></div>
        </div>

        <section className="section">
          <div className="opening">
            <p>
              <strong>THIS MARKETPLACE SELLER AGREEMENT</strong> ("Agreement") is made at <strong>{safe(placeOfExecution)}</strong> on this <strong>{executionDate}</strong>.
            </p>
            <p style={{ textAlign: "center", fontWeight: 700, margin: "16px 0" }}>BY & BETWEEN</p>
            <p>
              <strong>{safe(companyName)}</strong>, a company incorporated under the laws of India, having its registered /
              principal office at <strong>{safe(company?.address)}</strong>, bearing GSTIN <strong>{safe(company?.gstin)}</strong>,
              PAN <strong>{safe(company?.pan)}</strong>{company?.cinNumber ? <> and CIN <strong>{safe(company?.cinNumber)}</strong></> : null},
              hereinafter referred to as the "<strong>Company</strong>" / "<strong>Marketplace</strong>", which expression shall,
              unless repugnant to the context or meaning thereof, include its successors and permitted assigns, acting through its
              authorised signatory.
            </p>
            <p style={{ textAlign: "center", fontWeight: 700, margin: "16px 0" }}>AND</p>
            <p>
              <strong>{safe(sellerName)}</strong>, having its principal place of business at the seller particulars recorded
              in this Agreement, through its proprietor / partner / authorised signatory, hereinafter referred to as the
              "<strong>Seller</strong>", which expression shall, unless repugnant to the context or meaning thereof, include its
              successors, representatives and permitted assigns.
            </p>
            <p>
              The Company and the Seller are hereinafter collectively referred to as the "<strong>Parties</strong>" and individually
              as a "<strong>Party</strong>".
            </p>
          </div>
        </section>

        <section className="section">
          <h2>Whereas</h2>
          <div className="whereas">
            <p>
              A. The Company operates the Neejee marketplace and associated digital, operational, payment, catalogue, marketing and
              fulfilment-support infrastructure for enabling commerce between approved sellers and customers across India.
            </p>
            <p>
              B. The Seller has represented that it is lawfully engaged in the business of manufacturing, sourcing, branding,
              distributing and/or selling products and has requested onboarding on the Neejee marketplace for the purpose of listing
              and selling such products.
            </p>
            <p>
              C. The Seller has represented that it possesses or shall possess all registrations, licences, permissions, tax
              registrations, declarations, product approvals, labelling compliance and internal controls necessary for lawful sale
              of its products and performance of its obligations under this Agreement.
            </p>
            <p>
              D. Relying upon the Seller's representations, warranties and undertakings, the Company has agreed to permit the Seller
              to access and use the marketplace on a non-exclusive, revocable and compliance-based basis subject to this Agreement,
              platform policies and applicable Indian law.
            </p>
            <p>
              <strong>NOW, THEREFORE, THIS AGREEMENT WITNESSETH AND IT IS HEREBY AGREED BY AND BETWEEN THE PARTIES AS FOLLOWS:</strong>
            </p>
          </div>
        </section>

        <section className="section">
          <h2>Parties and Recorded Particulars</h2>
          <div className="grid2">
            <div className="box">
              <h3>Company</h3>
              <table className="kv">
                <tbody>
                  <Row label="Legal Name" value={company?.legalName || company?.brandName} />
                  <Row label="Brand" value={company?.brandName} />
                  <Row label="Address" value={company?.address} />
                  <Row label="GSTIN" value={company?.gstin} />
                  <Row label="PAN" value={company?.pan} />
                  <Row label="CIN" value={company?.cinNumber} />
                  <Row label="Email" value={company?.contactEmail} />
                  <Row label="Phone" value={company?.contactPhone} />
                  <Row label="Authorised Signatory" value={signatoryName} />
                  <Row label="Title" value={signatoryTitle} />
                </tbody>
              </table>
            </div>

            <div className="box">
              <h3>Seller</h3>
              <table className="kv">
                <tbody>
                  <Row label="Seller Name" value={seller?.businessName} />
                  <Row label="Contact Name" value={seller?.contactName} />
                  <Row label="Email" value={seller?.email} />
                  <Row label="Phone" value={seller?.phone} />
                  <Row label="Craft / Region" value={[seller?.craft, seller?.region].filter(Boolean).join(" â€¢ ")} />
                  <Row label="PAN" value={seller?.pan} />
                  <Row label="GSTIN" value={seller?.gstin} />
                  <Row label="Bank Name" value={seller?.bankName} />
                  <Row label="Bank Account" value={seller?.bankAccountMasked || seller?.bankAccount} />
                  <Row label="IFSC" value={seller?.ifsc} />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Commercial Schedule</h2>
          <div className="box annex">
            <table className="kv">
              <tbody>
                <Row label="Commission %" value={terms?.commissionPct} />
                <Row label="Payout Cycle" value={terms?.payoutCycle} />
                <Row label="Neejee Select" value={terms?.isNeejeeSelect ? "Yes" : "No"} />
                <Row label="Quality Score" value={terms?.qualityScore} />
                <Row label="Years of Practice" value={terms?.yearsOfPractice} />
                <Row label="Cluster" value={terms?.cluster} />
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <h2>Terms and Conditions</h2>
          {clauses.length === 0 ? (
            <div className="box">
              <p>No clauses returned by API.</p>
            </div>
          ) : (
            clauses.map((clause: any, idx: number) => (
              <article className="clause" key={clause?.id || idx}>
                <h3>{safe(clause?.heading || clause?.title || `Clause ${idx + 1}`)}</h3>
                {Array.isArray(clause?.paragraphs) && clause.paragraphs.length > 0 ? (
                  clause.paragraphs.map((p: string, pIdx: number) => <p key={pIdx}>{p}</p>)
                ) : clause?.text ? (
                  <p>{clause.text}</p>
                ) : (
                  <p>â€”</p>
                )}
              </article>
            ))
          )}
        </section>

        <section className="section">
          <h2>Execution</h2>
          <div className="sigWrap">
            <div className="sigBox">
              <div className="sigLabel">For {safe(companyName)}</div>
              <div className="signatureImageWrap">
                {signatureUrl ? (
                  <img className="signatureImage" src={signatureUrl} alt={`${safe(signatoryName)} signature`} />
                ) : (
                  <div className="signatureFallback">{safe(signatoryName)}</div>
                )}
              </div>
              <div className="signatureLine">
                <strong>{safe(signatoryName)}</strong><br />
                {safe(signatoryTitle)}
              </div>
              <div style={{ marginTop: 8 }}>
                For and on behalf of <strong>{safe(companyName)}</strong><br />
                Date: {executionDate}
              </div>
            </div>

            <div className="sigBox">
              <div className="sigLabel">For {safe(sellerName)}</div>
              <div className="signatureImageWrap"></div>
              <div className="signatureLine">
                <strong>{safe(seller?.contactName || sellerName)}</strong><br />
                Authorised Signatory / Proprietor / Partner
              </div>
              <div style={{ marginTop: 8 }}>
                For and on behalf of <strong>{safe(sellerName)}</strong><br />
                Date: {executionDate}
              </div>
            </div>
          </div>

          <p className="small" style={{ marginTop: 14 }}>
            This document is formatted as a formal print-first agreement for execution and archival.
          </p>
        </section>

        <footer className="docFooter">
          <div>
            <div className="docFooterTitle">Company</div>
            <div>{safe(company?.legalName || "Oye Imagine Private Limited")}</div>
            <div>{safe(company?.address)}</div>
          </div>

          <div>
            <div className="docFooterTitle">Contact</div>
            <div>Email: {safe(company?.contactEmail)}</div>
            <div>Phone: {safe(company?.contactPhone)}</div>
            <div>GSTIN: {safe(company?.gstin)}</div>
          </div>

          <div className="pageNo">
            <div className="docFooterTitle">Marketplace Agreement</div>
            <div>Seller ID: {safe(sellerId)}</div>
            <div>Execution Date: {executionDate}</div>
          </div>
        </footer>
      </main>
    </>
  );
}