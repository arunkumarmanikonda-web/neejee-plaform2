import { Sparkles } from 'lucide-react';

export default function AdminAI() {
  return (
    <>
      <p className="label text-madder">AI COMMERCE</p>
      <h1 className="font-display text-4xl text-kohl mt-2 flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-madder" /> AI Manager
      </h1>
      <p className="font-italic italic text-mitti mt-2">Mirror · Space · Gift Concierge · Content Assistant</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-4 gap-4 mt-8">
        <div className="bg-beige p-5"><p className="label">MODEL ACTIVE</p><p className="font-display text-lg mt-2">Replicate v3.2</p></div>
        <div className="bg-beige p-5"><p className="label">GENERATIONS TODAY</p><p className="font-display text-3xl mt-2">1,247</p></div>
        <div className="bg-beige p-5"><p className="label">AVG COST / GEN</p><p className="font-display text-3xl mt-2">₹2.40</p></div>
        <div className="bg-beige p-5"><p className="label">CONSENT RATE</p><p className="font-display text-3xl mt-2 text-neem">94%</p></div>
      </div>

      <div className="flex gap-2 mt-8 font-ui text-xs tracking-widest border-b border-mitti/20">
        {['MIRROR', 'SPACE', 'GIFT CONCIERGE', 'CONTENT', 'VISUALS'].map((t, i) => (
          <button key={t} className={`px-5 py-3 ${i===0 ? 'border-b-2 border-madder text-madder' : 'text-monsoon hover:text-kohl'}`}>{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        <div className="col-span-2 bg-beige p-8">
          <p className="label text-madder mb-4">GENERATION ACTIVITY · LAST 7 DAYS</p>
          <div className="h-48 flex items-end gap-2">
            {[120,145,160,178,182,165,194].map((v,i) => (
              <div key={i} className="flex-1 bg-madder/80 hover:bg-madder" style={{ height: `${(v/200)*100}%` }}></div>
            ))}
          </div>
          <p className="font-italic italic text-mitti text-sm mt-4">1,144 generations · 92% completion · 8% consent declined</p>
        </div>

        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">SETTINGS</p>
          <div className="space-y-4 font-ui text-sm">
            <label className="flex justify-between items-center"><span>Daily limit / customer</span><input defaultValue="5" type="number" className="w-16 p-1 bg-ivory text-right" /></label>
            <label className="flex justify-between items-center"><span>Auto-delete after</span><span>30 days</span></label>
            <label className="flex justify-between items-center"><span>Consent required</span><input type="checkbox" defaultChecked /></label>
            <label className="flex justify-between items-center"><span>Watermark output</span><input type="checkbox" defaultChecked /></label>
            <label className="flex justify-between items-center"><span>Adult content filter</span><input type="checkbox" defaultChecked /></label>
            <button className="btn-primary w-full mt-4">SAVE SETTINGS</button>
          </div>
        </div>
      </div>

      <div className="bg-beige p-8 mt-6">
        <div className="flex justify-between items-baseline">
          <p className="label text-madder">RECENT GENERATIONS</p>
          <button className="font-ui text-xs tracking-widest text-madder">VIEW PRIVACY AUDIT LOG →</button>
        </div>
        <table className="w-full mt-4 font-ui text-sm">
          <thead>
            <tr className="border-b border-mitti/20 text-left text-xs text-mitti">
              <th className="py-2">USER</th><th>PRODUCT</th><th>STATUS</th><th>CONSENT</th><th>EXPIRES</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Aanya M.', 'Banarasi Silk', 'COMPLETED', '✓', '15 days'],
              ['Priya R.', 'Phulkari Dupatta', 'COMPLETED', '✓', '22 days'],
              ['Riya P.', 'Oxidised Jhumkas', 'COMPLETED', '✓', '28 days'],
              ['Mira S.', 'Kanjeevaram', 'FAILED', '✓', 'N/A'],
            ].map((r,i) => (
              <tr key={i} className="border-b border-mitti/10">
                {r.map((c,j) => <td key={j} className="py-3">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
