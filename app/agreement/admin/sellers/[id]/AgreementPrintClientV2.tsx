"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function text(value: any, fallback = "—") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function asObject(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <tr>
      <td className="labelCell">{label}</td>
      <td className="valueCell">{text(value)}</td>
    </tr>
  );
}

export default function AgreementPrintClientV2({ id, dataUrl }: { id: string; dataUrl?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(dataUrl || `/api/admin/sellers/${id}/agreement-current`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Failed to load agreement (${res.status})`);
        if (active) setData(json?.agreement ?? json);
      } catch (e: any) {
        if (active) setErr(e?.message || "Failed to load agreement");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, dataUrl]);

  const meta = asObject(data?.meta);
  const company = asObject(data?.company);
  const seller = asObject(data?.seller);
  const terms = asObject(data?.commercialTerms);
  const clauses = Array.isArray(data?.clauses) ? data.clauses : [];
  const annexure = Array.isArray(data?.annexure) ? data.annexure : [];
  const recitals = Array.isArray(data?.recitals) ? data.recitals : [];
  const legalInstrument = asObject(data?.legalInstrument);

  const instrumentType = String(data?.instrumentType || meta?.instrumentType || "INITIAL").toUpperCase();
  const instrumentNumber = text(data?.agreementNumber || meta?.agreementNumber, "");
  const validFrom = data?.validFrom || meta?.validFrom || data?.effectiveDate || meta?.effectiveDate;
  const validTo = data?.validTo || meta?.validTo;
  const effectiveDate = data?.effectiveDate || meta?.effectiveDate || validFrom;
  const executionDate = formatDate(data?.sellerSignedAt || data?.companySignedAt || data?.lockedAt || data?.generatedAt || new Date());

  const instrumentLabel = useMemo(() => {
    if (instrumentType === "ADDENDUM") return "ADDENDUM TO MARKETPLACE SELLER AGREEMENT";
    if (instrumentType === "RENEWAL") return "RENEWAL AGREEMENT";
    if (instrumentType === "TERMINATION") return "TERMINATION AGREEMENT";
    return "MARKETPLACE SELLER AGREEMENT";
  }, [instrumentType]);

  const fallbackRecitals = [
    "A. The Company operates the NEEJEE marketplace and associated digital, operational, payment, catalogue, marketing and fulfilment-support infrastructure for enabling commerce between approved sellers and customers.",
    "B. The Seller has represented that it is lawfully engaged in the business of manufacturing, sourcing, branding, distributing and/or selling products and has requested participation on the NEEJEE marketplace.",
    "C. The Seller has represented that it possesses or shall possess all registrations, licences, permissions, tax registrations, declarations, product approvals, labelling compliance and internal controls required for lawful performance of its obligations.",
    "D. Relying upon the Seller’s representations, warranties and undertakings, the Company has agreed to permit the Seller to access and use the marketplace on a non-exclusive, revocable and compliance-based basis subject to this Agreement, platform policies and applicable Indian law."
  ];

  function handlePrint() {
    const oldTitle = document.title;
    const safeSeller = text(seller?.businessName || seller?.contactName, "seller").replace(/[^a-zA-Z0-9_-]+/g, "_");
    const safeNumber = instrumentNumber.replace(/[^a-zA-Z0-9_-]+/g, "_");
    document.title = `${safeSeller}_${safeNumber || instrumentType}`;
    window.addEventListener("afterprint", () => { document.title = oldTitle; }, { once: true });
    window.print();
  }

  if (loading) return <div className="status">Loading agreement...</div>;
  if (err) return <div className="status error">{err}</div>;
  if (!data) return <div className="status error">Agreement not found.</div>;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        :root { --ink:#1d1915; --muted:#6e655b; --rule:#cbb995; --line:#ded4c6; --paper:#fffdf8; --panel:#faf6ee; }
        html,body { margin:0; padding:0; background:#eee9e1; color:var(--ink); font-family:"Times New Roman",Georgia,serif; }
        .status { padding:28px; font-family:Arial,sans-serif; } .error{color:#991b1b;}
        .toolbar { max-width:210mm; margin:16px auto 0; padding:0 10px; display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:Arial,sans-serif; }
        .toolbarActions { display:flex; gap:8px; }
        .btn { border:1px solid #d6d3d1; background:white; color:#111827; text-decoration:none; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
        .btn.primary { background:#171717; border-color:#171717; color:white; }
        .sheet { width:210mm; min-height:297mm; margin:14px auto 30px; background:var(--paper); padding:17mm 15mm 22mm; position:relative; box-shadow:0 12px 38px rgba(0,0,0,.11); }
        .sheet:before { content:""; position:absolute; inset:8mm; border:1px solid var(--rule); pointer-events:none; }
        .sheet:after { content:""; position:absolute; inset:10.7mm; border:1px solid #e3d9ca; pointer-events:none; }
        .content { position:relative; z-index:1; }
        .brand { text-align:center; margin-bottom:10px; }
        .brand img { max-height:48px; max-width:195px; width:auto; height:auto; object-fit:contain; }
        .brandFallback { font:800 25px/1 Arial,sans-serif; letter-spacing:.18em; }
        .docTitle { text-align:center; padding:0 8mm 14px; border-bottom:1px solid var(--rule); }
        .docTitle h1 { margin:8px 0 5px; font-size:25px; letter-spacing:.04em; text-transform:uppercase; }
        .docTitle .subtitle { font-size:13px; color:var(--muted); margin:4px 0; }
        .identityGrid { margin:15px auto 0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px 20px; max-width:150mm; font-size:12px; text-align:left; }
        .identityGrid div { border-bottom:1px dotted #d9cebd; padding:3px 0; }
        .identityGrid strong { display:inline-block; min-width:92px; color:#4f463b; }
        .section { margin-top:19px; break-inside:avoid; page-break-inside:avoid; }
        .section h2 { margin:0 0 9px; padding-bottom:5px; border-bottom:1px solid var(--rule); font-size:15px; letter-spacing:.055em; text-transform:uppercase; }
        .opening,.box,.recitalBox { border:1px solid var(--line); background:white; padding:13px 14px; }
        .recitalBox,.box.panel { background:var(--panel); }
        p { margin:0 0 9px; font-size:13.4px; line-height:1.72; text-align:justify; }
        .between { text-align:center; font-weight:700; margin:13px 0; letter-spacing:.08em; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:13px; }
        .box h3 { margin:0 0 9px; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
        table { width:100%; border-collapse:collapse; table-layout:fixed; }
        td { border-bottom:1px solid #ece5db; padding:6px 7px; vertical-align:top; font-size:12.2px; line-height:1.45; word-break:break-word; }
        tr:last-child td { border-bottom:0; }
        .labelCell { width:38%; font-weight:700; color:#5e554c; }
        .clause { margin-top:15px; break-inside:avoid; page-break-inside:avoid; }
        .clause h3 { margin:0 0 7px; font-size:14px; line-height:1.35; }
        .clause p { margin-bottom:8px; }
        .note { border-left:3px solid var(--rule); padding:9px 11px; background:#fbf8f1; font-size:12px; line-height:1.55; }
        .sigGrid { display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:18px; }
        .sigBox { border:1px solid var(--line); padding:13px; min-height:175px; background:white; font-size:12.5px; line-height:1.6; }
        .sigHeading { text-transform:uppercase; color:var(--muted); font-size:11px; letter-spacing:.07em; margin-bottom:10px; }
        .sigImage { height:58px; display:flex; align-items:flex-end; margin-bottom:8px; }
        .sigImage img { max-height:54px; max-width:170px; object-fit:contain; }
        .sigLine { border-top:1px solid #887e72; padding-top:8px; margin-top:8px; }
        .footer { margin-top:24px; border-top:1px solid var(--rule); padding-top:8px; display:flex; justify-content:space-between; gap:16px; color:var(--muted); font-size:10.5px; }
        @page { size:A4; margin:13mm; }
        @media print {
          html,body { background:white; }
          .toolbar { display:none !important; }
          .sheet { width:auto; min-height:auto; margin:0; padding:0; box-shadow:none; background:white; }
          .sheet:before,.sheet:after { display:none; }
          .section,.clause,.box,.opening,.recitalBox,.sigGrid,table,tr { break-inside:avoid; page-break-inside:avoid; }
          h1,h2,h3 { break-after:avoid; page-break-after:avoid; }
          p { orphans:3; widows:3; }
        }
        @media(max-width:900px){ .sheet{width:auto;margin:0;padding:20px 15px;} .grid2,.sigGrid,.identityGrid{grid-template-columns:1fr;} }
      `}</style>

      <div className="toolbar">
        <Link href={`/admin/sellers/${id}`} className="btn">Back to seller</Link>
        <div className="toolbarActions"><button className="btn primary" onClick={handlePrint}>Save / Print PDF</button></div>
      </div>

      <main className="sheet">
        <div className="content">
          <div className="brand">
            {company?.logoUrl ? <img src={company.logoUrl} alt={text(company?.brandName, "NEEJEE")} /> : <div className="brandFallback">NEEJEE</div>}
          </div>

          <header className="docTitle">
            <h1>{data?.title || instrumentLabel}</h1>
            <div className="subtitle">{data?.subtitle || "Commercial legal instrument for the NEEJEE marketplace seller relationship"}</div>
            <div className="identityGrid">
              <div><strong>Instrument:</strong> {instrumentType}</div>
              <div><strong>Reference:</strong> {instrumentNumber || "—"}</div>
              <div><strong>Effective:</strong> {formatDate(effectiveDate)}</div>
              <div><strong>Validity:</strong> {formatDate(validFrom)}{validTo ? ` to ${formatDate(validTo)}` : instrumentType === "TERMINATION" ? " onward, subject to surviving obligations" : ""}</div>
            </div>
          </header>

          <section className="section">
            <div className="opening">
              <p><strong>THIS {instrumentLabel}</strong> (the “Instrument”) is made and executed on <strong>{executionDate}</strong> at <strong>{text(company?.address || data?.execution?.placeOfExecution, "Noida, Uttar Pradesh, India")}</strong>.</p>
              <div className="between">BY AND BETWEEN</div>
              <p><strong>{text(company?.legalName, "Oye Imagine Private Limited")}</strong>, a company incorporated under the laws of India, bearing CIN <strong>{text(company?.cinNumber)}</strong>, PAN <strong>{text(company?.pan)}</strong> and GSTIN <strong>{text(company?.gstin)}</strong>, having its registered/principal office at <strong>{text(company?.address)}</strong>, operating the NEEJEE marketplace, hereinafter referred to as the “Company” or “Marketplace”, which expression shall, unless repugnant to the context, include its successors and permitted assigns.</p>
              <div className="between">AND</div>
              <p><strong>{text(seller?.legalName || seller?.businessName)}</strong>, bearing CIN/registration number <strong>{text(seller?.cinNumber)}</strong>, PAN <strong>{text(seller?.pan)}</strong>, GSTIN <strong>{text(seller?.gstin)}</strong> and MSME/Udyam number <strong>{text(seller?.msmeNumber)}</strong>, having its registered/principal place of business at <strong>{text(seller?.address)}</strong>, hereinafter referred to as the “Seller”, which expression shall, unless repugnant to the context, include its successors, legal representatives and permitted assigns.</p>
              <p>The Company and the Seller are collectively referred to as the “Parties” and individually as a “Party”.</p>
            </div>
          </section>

          <section className="section">
            <h2>Recitals / Whereas</h2>
            <div className="recitalBox">
              {(recitals.length ? recitals : fallbackRecitals).map((r: any, idx: number) => <p key={idx}>{typeof r === "string" ? r : text(r?.text || r?.value)}</p>)}
              <p><strong>NOW, THEREFORE, in consideration of the mutual covenants, representations and obligations set out herein, the Parties agree as follows.</strong></p>
            </div>
          </section>

          <section className="section">
            <h2>Parties and Recorded Legal Particulars</h2>
            <div className="grid2">
              <div className="box">
                <h3>Company / Marketplace</h3>
                <table><tbody>
                  <Row label="Legal Name" value={company?.legalName} />
                  <Row label="Brand" value={company?.brandName} />
                  <Row label="Registered Address" value={company?.address} />
                  <Row label="CIN" value={company?.cinNumber} />
                  <Row label="PAN" value={company?.pan} />
                  <Row label="GSTIN" value={company?.gstin} />
                  <Row label="MSME / Udyam" value={company?.msmeNumber} />
                  <Row label="Official Email" value={company?.contactEmail} />
                  <Row label="Telephone" value={company?.contactPhone} />
                  <Row label="Authorised Signatory" value={company?.authorisedSignatory} />
                  <Row label="Designation" value={company?.signatoryTitle} />
                </tbody></table>
              </div>
              <div className="box">
                <h3>Seller</h3>
                <table><tbody>
                  <Row label="Legal / Business Name" value={seller?.legalName || seller?.businessName} />
                  <Row label="Registered Address" value={seller?.address} />
                  <Row label="CIN / Registration" value={seller?.cinNumber} />
                  <Row label="PAN" value={seller?.pan} />
                  <Row label="GSTIN" value={seller?.gstin} />
                  <Row label="MSME / Udyam" value={seller?.msmeNumber} />
                  <Row label="Authorised Contact" value={seller?.contactName} />
                  <Row label="Email" value={seller?.email} />
                  <Row label="Phone" value={seller?.phone} />
                  <Row label="Bank" value={seller?.bankName} />
                  <Row label="Account" value={seller?.bankAccountMasked || seller?.bankAccount} />
                  <Row label="IFSC" value={seller?.ifsc} />
                </tbody></table>
              </div>
            </div>
          </section>

          {instrumentType !== "INITIAL" ? (
            <section className="section">
              <h2>Instrument and Contractual Lineage</h2>
              <div className="box panel">
                <table><tbody>
                  <Row label="Instrument Type" value={instrumentType} />
                  <Row label="Instrument Number" value={instrumentNumber} />
                  <Row label="Parent Instrument" value={legalInstrument?.parentInstrumentNumber || meta?.parentAgreementId} />
                  <Row label="Root Relationship Instrument" value={legalInstrument?.rootInstrumentNumber || meta?.relationshipRootId} />
                  <Row label="Effective Date" value={formatDate(effectiveDate)} />
                  <Row label="Valid From" value={formatDate(validFrom)} />
                  <Row label="Valid Until" value={validTo ? formatDate(validTo) : "Until completion of termination/wind-down consequences"} />
                  <Row label="Change / Termination Context" value={data?.renegotiationReason || annexure.find((x:any)=>String(x?.label||"").toLowerCase().includes("reason"))?.value} />
                  <Row label="Drafting Standard" value={legalInstrument?.draftingStandardVersion || meta?.legalDraftingStandardVersion} />
                </tbody></table>
              </div>
            </section>
          ) : null}

          <section className="section">
            <h2>Commercial Schedule</h2>
            <div className="box panel"><table><tbody>
              <Row label="Commission" value={terms?.commissionPct !== undefined ? `${terms.commissionPct}%` : "—"} />
              <Row label="Payout Cycle" value={terms?.payoutCycle} />
              <Row label="NEEJEE Select" value={terms?.isNeejeeSelect ? "Yes" : "No"} />
              <Row label="Quality Score" value={terms?.qualityScore} />
              <Row label="Payment Terms" value={terms?.paymentTerms} />
              <Row label="Settlement Basis" value={terms?.settlementBasis} />
              <Row label="Returns Commercial Treatment" value={terms?.returnsCommercialTreatment} />
              <Row label="Marketing Contribution" value={terms?.marketingContribution} />
              <Row label="Logistics Commercial Terms" value={terms?.logisticsCommercialTerms} />
              <Row label="Tax Treatment" value={terms?.taxTreatment} />
            </tbody></table></div>
          </section>

          <section className="section">
            <h2>Operative Terms and Conditions</h2>
            {clauses.length ? clauses.map((c: any, idx: number) => (
              <article className="clause" key={c?.id || idx}>
                <h3>{text(c?.heading || c?.title || `Clause ${idx + 1}`)}</h3>
                {Array.isArray(c?.paragraphs) ? c.paragraphs.map((p: string, pIdx: number) => <p key={pIdx}>{p}</p>) : c?.text ? <p>{c.text}</p> : null}
              </article>
            )) : <div className="note">No operative clauses were returned. This instrument must not be executed until the legal text is restored.</div>}
          </section>

          {annexure.length ? (
            <section className="section">
              <h2>Annexure / Recorded Schedule</h2>
              <div className="box"><table><tbody>{annexure.map((item:any, idx:number)=><Row key={idx} label={text(item?.label, `Item ${idx+1}`)} value={item?.value} />)}</tbody></table></div>
            </section>
          ) : null}

          <section className="section">
            <h2>Execution</h2>
            <div className="sigGrid">
              <div className="sigBox">
                <div className="sigHeading">For and on behalf of {text(company?.legalName, "Oye Imagine Private Limited")}</div>
                <div className="sigImage">{company?.signatureUrl ? <img src={company.signatureUrl} alt="Company authorised signature" /> : null}</div>
                <div className="sigLine"><strong>{text(company?.authorisedSignatory)}</strong><br />{text(company?.signatoryTitle, "Authorised Signatory")}</div>
                <div>Date: {formatDate(data?.companySignedAt || data?.generatedAt)}</div>
              </div>
              <div className="sigBox">
                <div className="sigHeading">For and on behalf of {text(seller?.legalName || seller?.businessName)}</div>
                <div className="sigImage"></div>
                <div className="sigLine"><strong>{text(seller?.contactName || seller?.businessName)}</strong><br />Authorised Signatory / Proprietor / Partner</div>
                <div>Date: {formatDate(data?.sellerSignedAt)}</div>
              </div>
            </div>
            <div className="note" style={{ marginTop: 14 }}>
              Electronic execution and audit records are retained as evidence of contractual assent. Where applicable law requires prescribed electronic/digital signature, stamping, registration, notarisation or any other mandatory formality, such formality must additionally be completed.
            </div>
          </section>

          <div className="footer"><span>NEEJEE · FOUND. PERSONAL.</span><span>{instrumentNumber || instrumentLabel}</span><span>Confidential contractual record</span></div>
        </div>
      </main>
    </>
  );
}
