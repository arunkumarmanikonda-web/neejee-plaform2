"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AgreementPayload = any;

function safe(value: any) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <tr>
      <td style={{ width: "34%", padding: "6px 8px", verticalAlign: "top", color: "#4b5563", fontWeight: 700 }}>{label}</td>
      <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{safe(value)}</td>
    </tr>
  );
}

export default function AgreementPrintClient({ id }: { id: string }) {
  const [data, setData] = useState<AgreementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const res = await fetch(`/api/admin/sellers/${id}/agreement`, { cache: "no-store" });
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
  }, [id]);

  const company = data?.company || {};
  const seller = data?.seller || {};
  const terms = data?.commercialTerms || {};
  const clauses = Array.isArray(data?.clauses) ? data.clauses : [];
  const generatedOn = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : "____________";

  const placeOfExecution = company?.address || "Noida, Uttar Pradesh, India";

  const partyLine = useMemo(() => {
    const companyName = company?.legalName || company?.brandName || "Oye Imagine Private Limited";
    const sellerName = seller?.businessName || seller?.name || "Seller";
    return { companyName, sellerName };
  }, [company, seller]);

  if (loading) return <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Loading agreement...</div>;
  if (err) return <div style={{ padding: 24, color: "#991b1b", fontFamily: "Arial, sans-serif" }}>{err}</div>;
  if (!data) return <div style={{ padding: 24, color: "#991b1b", fontFamily: "Arial, sans-serif" }}>Agreement not found.</div>;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #eef2f7;
          color: #111827;
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
          border: 1px solid #cbd5e1;
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
          width: 210mm;
          min-height: 297mm;
          margin: 16px auto 24px;
          background: #fff;
          box-shadow: 0 10px 35px rgba(15,23,42,.12);
          padding: 18mm 16mm;
        }
        .title {
          text-align: center;
          margin-bottom: 20px;
        }
        .title h1 {
          margin: 0 0 6px;
          font-size: 28px;
          text-transform: uppercase;
        }
        .title p {
          margin: 4px 0;
          font-size: 14px;
          color: #4b5563;
        }
        .section {
          margin-top: 20px;
          page-break-inside: avoid;
        }
        .section h2 {
          margin: 0 0 10px;
          font-size: 17px;
          text-transform: uppercase;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 6px;
        }
        .opening, .whereas, .box {
          border: 1px solid #d1d5db;
          padding: 14px;
          background: #fff;
        }
        .whereas {
          background: #f8fafc;
        }
        .opening p, .whereas p, .clause p, .annex p {
          margin: 0 0 10px;
          font-size: 14px;
          line-height: 1.75;
          text-align: justify;
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .box h3 {
          margin: 0 0 10px;
          font-size: 14px;
          text-transform: uppercase;
        }
        .kv {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .kv tr:not(:last-child) td {
          border-bottom: 1px solid #eef2f7;
        }
        .clause {
          margin-top: 16px;
          page-break-inside: avoid;
        }
        .clause h3 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        .sigWrap {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .sigBox {
          min-height: 110px;
          border-top: 1px solid #111827;
          padding-top: 10px;
          font-size: 13px;
          line-height: 1.8;
        }
        .small {
          font-size: 12px;
          color: #4b5563;
        }
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
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
            padding: 0;
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
          .grid2, .sigWrap {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="toolbar">
        <Link href={`/admin/sellers/${id}`} className="btn">Back to seller</Link>
        <div className="actions">
          <button className="btn primary" onClick={() => window.print()}>Save / Print PDF</button>
        </div>
      </div>

      <main className="sheet">
        <div className="title">
          <h1>{data?.title || "Marketplace Seller Agreement"}</h1>
          <p>{data?.subtitle || "Detailed India-focused marketplace agreement"}</p>
          <p>Generated on {generatedOn}</p>
        </div>

        <section className="section">
          <div className="opening">
            <p>
              <strong>THIS MARKETPLACE SELLER AGREEMENT</strong> ("Agreement") is made at <strong>{safe(placeOfExecution)}</strong>
              {" "}on this <strong>{generatedOn}</strong>.
            </p>
            <p style={{ textAlign: "center", fontWeight: 700, margin: "16px 0" }}>BY & BETWEEN</p>
            <p>
              <strong>{safe(partyLine.companyName)}</strong>, a company incorporated under the laws of India, having its registered /
              principal office at <strong>{safe(company?.address)}</strong>, bearing GSTIN <strong>{safe(company?.gstin)}</strong>,
              PAN <strong>{safe(company?.pan)}</strong>{company?.cinNumber ? <> and CIN <strong>{safe(company?.cinNumber)}</strong></> : null},
              hereinafter referred to as the "<strong>Company</strong>" / "<strong>Marketplace</strong>", which expression shall,
              unless repugnant to the context or meaning thereof, include its successors and permitted assigns, acting through its
              authorised signatory.
            </p>
            <p style={{ textAlign: "center", fontWeight: 700, margin: "16px 0" }}>AND</p>
            <p>
              <strong>{safe(partyLine.sellerName)}</strong>, having its principal place of business at the seller particulars recorded
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
                  <Row label="Authorised Signatory" value={company?.authorisedSignatory} />
                  <Row label="Title" value={company?.signatoryTitle} />
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
                  <Row label="Craft / Region" value={[seller?.craft, seller?.region].filter(Boolean).join(" • ")} />
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
                  <p>—</p>
                )}
              </article>
            ))
          )}
        </section>

        <section className="section">
          <h2>Execution</h2>
          <div className="sigWrap">
            <div className="sigBox">
              <strong>For {safe(company?.legalName || partyLine.companyName)}</strong><br />
              Authorised Signatory<br />
              Name: {safe(company?.authorisedSignatory)}<br />
              Title: {safe(company?.signatoryTitle)}<br />
              Date: _____________________
            </div>
            <div className="sigBox">
              <strong>For {safe(seller?.businessName || partyLine.sellerName)}</strong><br />
              Authorised Signatory<br />
              Name: {safe(seller?.contactName || seller?.businessName)}<br />
              Title: _____________________<br />
              Date: _____________________
            </div>
          </div>
          <p className="small" style={{ marginTop: 14 }}>
            This layout is intentionally structured as a print-first legal document for PDF export and execution.
          </p>
        </section>
      </main>
    </>
  );
}