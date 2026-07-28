"use client";

import { useEffect, useState } from "react";

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
    if (!upload?.publicUrl) {
      setErr("Upload the signature image first");
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
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Neejee</p>
          <h1 className="text-2xl font-semibold text-stone-900 mt-2">Seller Agreement Signing</h1>
          <p className="text-sm text-stone-600 mt-2">
            Seller: <span className="font-medium">{session?.seller?.businessName || "Seller"}</span>
          </p>
          <p className="text-sm text-stone-600">
            Contact: {session?.seller?.contactName || "â€”"}
          </p>
          <p className="text-sm text-stone-600">
            Status: {session?.workflow?.sellerSignatureStatus || session?.workflow?.status || "â€”"}
          </p>
        </div>

        {msg ? <div className="text-sm text-green-700">{msg}</div> : null}
        {err ? <div className="text-sm text-red-700">{err}</div> : null}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-900">1. Upload signature image</h2>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
          <button
            onClick={uploadSignature}
            disabled={busy || !file}
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
              disabled={busy || !phone}
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
              disabled={busy || !phone || !code}
              className="px-4 py-2 border border-stone-300 text-sm rounded disabled:opacity-50"
            >
              Verify OTP
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-900">3. Finalize signature</h2>
          <button
            onClick={finalizeSigning}
            disabled={busy || !upload?.publicUrl}
            className="px-4 py-2 bg-green-700 text-white text-sm rounded disabled:opacity-50"
          >
            Sign Agreement
          </button>
        </section>
      </div>
    </main>
  );
}