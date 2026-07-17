"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Clause = {
  id: string;
  title?: string;
  heading?: string;
  paragraphs?: string[];
};

type AgreementData = {
  generatedAt?: string;
  title?: string;
  subtitle?: string;
  company?: Record<string, any>;
  seller?: Record<string, any>;
  commercialTerms?: Record<string, any>;
  clauses?: Clause[];
  existingDocument?: { url?: string; name?: string } | null;
};

function row(label: string, value: any) {
  const safe =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return { label, value: safe };
}

export default function AgreementPrintClient({ id }: { id: string }) {
  const [data, setData] = useState<AgreementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/sellers/${id}/agreement`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load agreement (${res.status})`);
        const json = await res.json();
        if (alive) setData(json);
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

  const companyRows = useMemo(() => {
    const c = data?.company || {};
    return [
      row("Legal Name", c.legalName || c.brandName),
      row("Brand", c.brandName),
      row("Address", c.address),
      row("GSTIN", c.gstin),
      row("PAN", c.pan),
      row("CIN", c.cinNumber || c.cin),
      row("Email", c.email),
      row("Phone", c.phone),
    ];
  }, [data]);

  const sellerRows = useMemo(() => {
    const s = data?.seller || {};
    return [
      row("Seller Name", s.businessName || s.name),
      row("Contact Name", s.contactName),
      row("Email", s.email),
      row("Phone", s.phone),
      row("Craft / Region", [s.craft, s.region].filter(Boolean).join(" • ")),
      row("PAN", s.pan),
      row("GSTIN", s.gstin),
      row("Bank Name", s.bankName),
      row("Bank Account", s.bankAccount),
      row("IFSC", s.ifsc),
    ];
  }, [data]);

  const commercialRows = useMemo(() => {
    const t = data?.commercialTerms || {};
    return [
      row("Commission %", t.commissionPct),
      row("Payout Cycle", t.payoutCycle),
      row("Neejee Select", t.isNeejeeSelect),
      row("Quality Score", t.qualityScore),
      row("Years of Practice", t.yearsOfPractice),
      row("Cluster", t.cluster),
    ];
  }, [data]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading agreement…</div>;
  }

  if (err || !data) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#991b1b", marginBottom: 12 }}>
          {err || "Failed to load agreement"}
        </p>
        <Link href={`/admin/sellers/${id}`}>Back to seller</Link>
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root{
          --page-width: 210mm;
          --text: #111827;
          --muted: #4b5563;
          --line: #d1d5db;
          --soft: #f8fafc;
        }
        *{box-sizing:border-box}
        html,body{
          margin:0;
          padding:0;
          background:#eef2f7;
          color:var(--text);
          font-family: "Times New Roman", Georgia, serif;
        }
        .toolbar{
          max-width: var(--page-width);
          margin: 20px auto 0;
          display:flex;
          gap:12px;
          align-items:center;
          justify-content:space-between;
          padding:0 12px;
          font-family: Arial, Helvetica, sans-serif;
        }
        .toolbar .actions{
          display:flex; gap:10px; flex-wrap:wrap;
        }
        .btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:40px;
          padding:10px 14px;
          border-radius:8px;
          border:1px solid #cbd5e1;
          background:white;
          color:#111827;
          text-decoration:none;
          font: 600 14px/1 Arial, Helvetica, sans-serif;
          cursor:pointer;
        }
        .btn.primary{
          background:#111827;
          color:white;
          border-color:#111827;
        }
        .sheet{
          width: var(--page-width);
          min-height: 297mm;
          margin: 16px auto 24px;
          background: white;
          box-shadow: 0 10px 35px rgba(15,23,42,.12);
          padding: 18mm 16mm 18mm 16mm;
        }
        .doc-title{
          text-align:center;
          margin-bottom:18px;
        }
        .doc-title h1{
          margin:0 0 8px;
          font-size:28px;
          letter-spacing:.4px;
          text-transform:uppercase;
        }
        .doc-title .sub{
          margin:0 0 8px;
          color:var(--muted);
          font-size:14px;
        }
        .doc-title .gen{
          margin:0;
          color:var(--muted);
          font-size:12px;
        }
        .section{
          margin-top:18px;
          page-break-inside:avoid;
        }
        .section-title{
          margin:0 0 10px;
          font-size:17px;
          font-weight:700;
          text-transform:uppercase;
          border-bottom:1px solid var(--line);
          padding-bottom:6px;
        }
        .party-grid,.commercial-grid{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:14px;
        }
        .box{
          border:1px solid var(--line);
          padding:12px;
          background:#fff;
        }
        .box h3{
          margin:0 0 10px;
          font-size:14px;
          text-transform:uppercase;
          letter-spacing:.4px;
        }
        .kv{
          width:100%;
          border-collapse:collapse;
          table-layout:fixed;
        }
        .kv td{
          padding:6px 4px;
          vertical-align:top;
          border-bottom:1px solid #eef2f7;
          font-size:13px;
        }
        .kv td:first-child{
          width:34%;
          color:var(--muted);
          font-weight:700;
        }
        .whereas{
          border:1px solid var(--line);
          padding:14px;
          background:var(--soft);
          font-size:14px;
          line-height:1.7;
          text-align:justify;
        }
        .clause{
          margin-top:16px;
          page-break-inside:avoid;
        }
        .clause h3{
          margin:0 0 8px;
          font-size:15px;
          font-weight:700;
        }
        .clause p{
          margin:0 0 10px;
          font-size:14px;
          line-height:1.75;
          text-align:justify;
        }
        .signature-wrap{
          margin-top:32px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:24px;
        }
        .sig-box{
          min-height:110px;
          border-top:1px solid #111827;
          padding-top:10px;
          font-size:13px;
        }
        .annex-note{
          margin-top:18px;
          font-size:12px;
          color:var(--muted);
          text-align:justify;
        }

        @page{
          size:A4;
          margin:14mm;
        }

        @media print{
          html,body{
            background:white !important;
          }
          .toolbar{
            display:none !important;
          }
          .sheet{
            width:auto;
            min-height:auto;
            margin:0;
            box-shadow:none;
            padding:0;
          }
          a{
            color:inherit;
            text-decoration:none;
          }
        }

        @media (max-width: 900px){
          .sheet{
            width:auto;
            min-height:auto;
            margin:0;
            padding:20px 16px 28px;
          }
          .party-grid,.commercial-grid,.signature-wrap{
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <div className="toolbar">
        <div>
          <Link href={`/admin/sellers/${id}`} className="btn">Back to seller</Link>
        </div>
        <div className="actions">
          {data?.existingDocument?.url ? (
            <a
              href={data.existingDocument.url}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              Existing attachment
            </a>
          ) : null}
          <button className="btn primary" onClick={() => window.print()}>
            Save / Print PDF
          </button>
        </div>
      </div>

      <main className="sheet">
        <header className="doc-title">
          <h1>{data.title || "Marketplace Seller Agreement"}</h1>
          <p className="sub">
            {data.subtitle || "Detailed India-focused marketplace agreement"}
          </p>
          <p className="gen">
            Generated on {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
          </p>
        </header>

        <section className="section">
          <h2 className="section-title">Parties</h2>
          <div className="party-grid">
            <div className="box">
              <h3>Company</h3>
              <table className="kv">
                <tbody>
                  {companyRows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="box">
              <h3>Seller</h3>
              <table className="kv">
                <tbody>
                  {sellerRows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Commercial Schedule</h2>
          <div className="box">
            <table className="kv">
              <tbody>
                {commercialRows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Recitals / Whereas</h2>
          <div className="whereas">
            <p><strong>THIS MARKETPLACE SELLER AGREEMENT</strong> is entered into by and between <strong>{String((data.company?.legalName || data.company?.brandName || "Oye Imagine Private Limited"))}</strong> and <strong>{String((data.seller?.businessName || data.seller?.name || "Seller"))}</strong>.</p>
            <p>WHEREAS the Company operates the Neejee marketplace and associated commerce infrastructure;</p>
            <p>WHEREAS the Seller desires to list and sell products through such marketplace;</p>
            <p>WHEREAS the Parties wish to record the terms on which the Seller may access and use the marketplace;</p>
            <p>NOW THEREFORE, the Parties agree to be bound by the terms and conditions set out below.</p>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">Definitions and Clauses</h2>
          {(data.clauses || []).map((clause) => (
            <article className="clause" key={clause.id}>
              <h3>{clause.heading || clause.title || `Clause ${clause.id}`}</h3>
              {(clause.paragraphs || []).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </article>
          ))}
        </section>

        <section className="section">
          <h2 className="section-title">Execution</h2>
          <div className="signature-wrap">
            <div className="sig-box">
              <strong>For Oye Imagine Private Limited</strong><br />
              Authorised Signatory<br />
              Name: ____________________<br />
              Title: _____________________<br />
              Date: _____________________
            </div>
            <div className="sig-box">
              <strong>For the Seller</strong><br />
              Authorised Signatory<br />
              Name: ____________________<br />
              Title: _____________________<br />
              Date: _____________________
            </div>
          </div>
          <p className="annex-note">
            This print layout is intentionally formatted as a clean legal document for PDF export and execution use.
          </p>
        </section>
      </main>
    </>
  );
}