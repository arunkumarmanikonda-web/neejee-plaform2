"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value: any) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function asObject(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function termsFromInstrument(item: any) {
  const snapshot = asObject(item?.documentSnapshot);
  return {
    ...asObject(snapshot?.commercialTerms),
    commissionPct: item?.commissionPct ?? snapshot?.commercialTerms?.commissionPct,
    qualityScore: item?.qualityScore ?? snapshot?.commercialTerms?.qualityScore,
    payoutCycle: item?.payoutCycle ?? snapshot?.commercialTerms?.payoutCycle,
    isNeejeeSelect: item?.isNeejeeSelect ?? snapshot?.commercialTerms?.isNeejeeSelect,
  };
}

export default function SellerAgreementSignClient({
  id,
  token,
}: {
  id: string;
  token: string;
}) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reviewAccepted, setReviewAccepted] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch(`/api/agreement/public/sellers/${id}/sign/session?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load signing session");
      setSession(j);
      setPhone(j?.seller?.phone || "");
    } catch (e: any) {
      setErr(e?.message || "Failed to load signing session");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, token]);

  const document = asObject(session?.workflow?.currentDocumentJson);
  const documentTerms = asObject(document?.commercialTerms);
  const currentInstrument = session?.currentInstrument || null;
  const currentTerms = useMemo(() => ({
    ...documentTerms,
    ...termsFromInstrument(currentInstrument),
  }), [session]);
  const currentClauses = Array.isArray(document?.clauses) ? document.clauses : [];
  const priorInstruments = Array.isArray(session?.priorInstruments) ? session.priorInstruments : [];
  const otpVerified = !!session?.workflow?.sellerSignatureOtpVerifiedAt;

  async function uploadSignature() {
    if (!file) {
      setErr("Choose a signature image first");
      return;
    }

    try {
      setBusy(true);
      setErr("");
      setMsg("");

      const prepRes = await fetch(`/api/agreement/public/sellers/${id}/sign/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fileName: file.name || "signature.png",
          contentType: file.type || "image/png",
        }),
      });

      const prep = await prepRes.json();
      if (!prepRes.ok) throw new Error(prep?.error || "Failed to prepare upload");

      const putRes = await fetch(prep.signedUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${prep.uploadToken}`,
          "Content-Type": file.type || "image/png",
        },
        body: file,
      });

      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        throw new Error(text || "Upload failed");
      }

      setUpload(prep);
      setMsg("Signature uploaded");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    try {
      setBusy(true);
      setErr("");
      setMsg("");
      const res = await fetch(`/api/agreement/public/sellers/${id}/sign/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to send OTP");
      setMsg("OTP sent");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    try {
      setBusy(true);
      setErr("");
      setMsg("");
      const res = await fetch(`/api/agreement/public/sellers/${id}/sign/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone, code }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "OTP verification failed");
      setMsg("OTP verified");
      await load();
    } catch (e: any) {
      setErr(e?.message || "OTP verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeSigning() {
    if (!reviewAccepted) {
      setErr("Review the agreement and confirm acceptance before signing.");
      return;
    }
    if (!upload?.publicUrl) {
      setErr("Upload the signature image first");
      return;
    }
    if (!otpVerified) {
      setErr("Verify the signing OTP before finalizing the agreement.");
      return;
    }

    try {
      setBusy(true);
      setErr("");
      setMsg("");
      const res = await fetch(`/api/agreement/public/sellers/${id}/sign/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signatureImageUrl: upload.publicUrl,
          signatureProcessedUrl: upload.publicUrl,
          reviewAccepted: true,
          instrumentId: session?.workflow?.instrumentId || "",
          agreementNumber: session?.workflow?.agreementNumber || "",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to finalize signature");
      setMsg("Agreement signed successfully");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to finalize signature");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-stone-600">Loading signing session...</div>;
  }

  if (err && !session) {
    return <div className="p-6 text-sm text-red-700">{err}</div>;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-7">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">NEEJEE · FOUND. PERSONAL.</p>
          <h1 className="text-2xl font-semibold text-stone-900 mt-2">Review & Sign Seller Agreement</h1>
          <p className="text-sm text-stone-600 mt-2">
            Seller: <span className="font-medium">{session?.seller?.businessName || "Seller"}</span>
          </p>
          <p className="text-sm text-stone-600">Contact: {session?.seller?.contactName || "—"}</p>
          <p className="text-sm text-stone-600">Status: {session?.workflow?.sellerSignatureStatus || session?.workflow?.status || "—"}</p>
        </div>

        {msg ? <div className="text-sm text-green-700 border border-green-200 bg-green-50 rounded p-3">{msg}</div> : null}
        {err ? <div className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-3">{err}</div> : null}

        <section className="border border-stone-200 rounded-lg overflow-hidden">
          <div className="bg-stone-950 text-white p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-300">Current legal instrument</p>
            <h2 className="text-xl font-semibold mt-2">
              {currentInstrument?.title || document?.meta?.instrumentTitle || document?.title || "Marketplace Seller Agreement"}
            </h2>
            <p className="text-xs text-stone-300 mt-1">{session?.workflow?.agreementNumber || currentInstrument?.instrumentNumber || "—"}</p>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <Info label="Instrument type" value={session?.workflow?.instrumentType || currentInstrument?.instrumentType || "INITIAL"} />
              <Info label="Valid from" value={formatDate(session?.workflow?.validFrom || currentInstrument?.effectiveFrom)} />
              <Info label="Valid until" value={formatDate(session?.workflow?.validTo || currentInstrument?.effectiveTo)} />
              <Info label="Relationship sequence" value={currentInstrument?.sequence ? `#${currentInstrument.sequence}` : "—"} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-stone-900">Commercial terms</h3>
              <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <Info label="Commission" value={currentTerms?.commissionPct !== undefined ? `${currentTerms.commissionPct}%` : "—"} />
                <Info label="Payout cycle" value={currentTerms?.payoutCycle || "—"} />
                <Info label="NEEJEE Select" value={currentTerms?.isNeejeeSelect ? "Yes" : "No"} />
                <Info label="Quality score" value={currentTerms?.qualityScore ?? "—"} />
              </div>
            </div>

            {session?.workflow?.renegotiationReason ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-800">Change / relationship context</p>
                <p className="text-sm text-amber-950 mt-1 whitespace-pre-wrap">{session.workflow.renegotiationReason}</p>
              </div>
            ) : null}

            <details className="border border-stone-200 rounded p-4" open>
              <summary className="cursor-pointer text-sm font-semibold text-stone-900">Review current agreement clauses ({currentClauses.length})</summary>
              <div className="mt-4 space-y-4 max-h-[520px] overflow-y-auto pr-2">
                {currentClauses.length ? currentClauses.map((clause: any, idx: number) => (
                  <article key={clause?.id || idx} className="border-b border-stone-100 pb-4 last:border-0">
                    <h4 className="text-sm font-semibold text-stone-900">{clause?.heading || clause?.title || `Clause ${idx + 1}`}</h4>
                    {Array.isArray(clause?.paragraphs) ? clause.paragraphs.map((p: string, pIdx: number) => (
                      <p key={pIdx} className="text-sm leading-6 text-stone-700 mt-2">{p}</p>
                    )) : clause?.text ? <p className="text-sm leading-6 text-stone-700 mt-2">{clause.text}</p> : null}
                  </article>
                )) : <p className="text-sm text-stone-500">The legal text is available in the issued agreement record.</p>}
              </div>
            </details>

            <details className="border border-stone-200 rounded p-4" open={priorInstruments.length > 0}>
              <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                Annexed prior agreements & commercial history ({priorInstruments.length})
              </summary>
              <p className="text-xs text-stone-500 mt-2">
                These archived instruments form the permanent contractual lineage referenced by this agreement. They are retained without being overwritten.
              </p>
              <div className="mt-4 space-y-4">
                {priorInstruments.length ? priorInstruments.map((item: any) => {
                  const snap = asObject(item?.documentSnapshot);
                  const archive = asObject(snap?.workflowArchive);
                  const priorClauses = Array.isArray(snap?.clauses) ? snap.clauses : [];
                  const terms = termsFromInstrument(item);
                  return (
                    <details key={item.id} className="border border-stone-200 rounded p-4">
                      <summary className="cursor-pointer">
                        <span className="text-sm font-semibold text-stone-900">{item.title}</span>
                        <span className="block text-xs text-stone-500 mt-1">{item.instrumentNumber} · {String(item.status || "").replace(/_/g, " ")}</span>
                      </summary>
                      <div className="mt-4 space-y-4">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                          <Info label="Valid from" value={formatDate(item.effectiveFrom)} />
                          <Info label="Valid until" value={formatDate(item.effectiveTo)} />
                          <Info label="Commission" value={terms?.commissionPct !== undefined ? `${terms.commissionPct}%` : "—"} />
                          <Info label="Payout cycle" value={terms?.payoutCycle || "—"} />
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 text-sm">
                          <Info label="Seller signed" value={formatDate(item.sellerSignedAt || archive?.sellerSignedAt)} />
                          <Info label="NEEJEE signed" value={formatDate(item.companySignedAt || archive?.companySignedAt)} />
                          <Info label="Closed" value={formatDate(item.closedAt || archive?.closedAt)} />
                        </div>
                        {priorClauses.length ? (
                          <div className="max-h-80 overflow-y-auto border-t border-stone-100 pt-3 space-y-3">
                            {priorClauses.map((clause: any, idx: number) => (
                              <article key={clause?.id || idx}>
                                <h4 className="text-xs font-semibold text-stone-900">{clause?.heading || clause?.title || `Clause ${idx + 1}`}</h4>
                                {Array.isArray(clause?.paragraphs) ? clause.paragraphs.map((p: string, pIdx: number) => (
                                  <p key={pIdx} className="text-xs leading-5 text-stone-600 mt-1">{p}</p>
                                )) : null}
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  );
                }) : <p className="text-sm text-stone-500">This is the first agreement in the relationship.</p>}
              </div>
            </details>

            <label className="flex items-start gap-3 rounded border border-stone-300 bg-stone-50 p-4">
              <input
                type="checkbox"
                checked={reviewAccepted}
                onChange={(e) => setReviewAccepted(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm leading-6 text-stone-700">
                I confirm that I have reviewed the current instrument, its commercial terms, validity and the referenced/annexed prior agreement history, and I intend to proceed to electronic execution.
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-3 border-t border-stone-200 pt-6">
          <h2 className="text-sm font-semibold text-stone-900">1. Upload signature image</h2>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          <button
            onClick={uploadSignature}
            disabled={busy || !file || !reviewAccepted}
            className="px-4 py-2 bg-stone-900 text-white text-sm rounded disabled:opacity-50"
          >
            Upload Signature
          </button>
          {upload?.publicUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">Uploaded preview</p>
              <img src={upload.publicUrl} alt="Signature preview" className="h-24 w-auto border border-stone-200 bg-white p-2" />
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-900">2. Verify by SMS OTP</h2>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={requestOtp}
              disabled={busy || !phone || !reviewAccepted}
              className="px-4 py-2 border border-stone-300 text-sm rounded disabled:opacity-50"
            >
              Send OTP
            </button>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter OTP"
              className="border border-stone-300 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={verifyOtp}
              disabled={busy || !phone || !code || !reviewAccepted}
              className="px-4 py-2 border border-stone-300 text-sm rounded disabled:opacity-50"
            >
              Verify OTP
            </button>
          </div>
          {otpVerified ? <p className="text-sm text-green-700">Signing OTP verified.</p> : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-900">3. Finalize signature</h2>
          <button
            onClick={finalizeSigning}
            disabled={busy || !upload?.publicUrl || !reviewAccepted || !otpVerified}
            className="px-4 py-2 bg-green-700 text-white text-sm rounded disabled:opacity-50"
          >
            Sign Agreement
          </button>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-stone-500">{label}</p>
      <p className="text-sm text-stone-900 mt-1 break-words">{value === null || value === undefined || value === "" ? "—" : String(value)}</p>
    </div>
  );
}
