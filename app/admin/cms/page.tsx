import Link from 'next/link';

const pages = [
  { id: 'home', slug: '/', title: 'Homepage', sections: 12, status: 'PUBLISHED', updated: '2026-05-19' },
  { id: 'about', slug: '/about', title: 'About · Why we exist', sections: 6, status: 'PUBLISHED', updated: '2026-05-10' },
  { id: 'select', slug: '/about/select', title: 'NEEJEE Select', sections: 4, status: 'DRAFT', updated: '2026-05-18' },
  { id: 'sustain', slug: '/about/sustainability', title: 'Sustainability', sections: 5, status: 'PUBLISHED', updated: '2026-05-12' },
];

const banners = [
  { id: 'b1', position: 'announcement', text: 'FREE SHIPPING ABOVE ₹2,500 · THE FOUNDER\'S EDIT IS LIVE', active: true },
  { id: 'b2', position: 'hero', text: 'The rare, the rooted, the personal.', active: true },
];

export default function AdminCMS() {
  return (
    <>
      <p className="label text-madder">CONTENT</p>
      <h1 className="font-display text-4xl text-kohl mt-2">CMS</h1>
      <p className="font-italic italic text-mitti mt-2">Pages, banners, journal, and craft stories</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-2 gap-8 mt-12">
        <div>
          <div className="flex justify-between items-baseline mb-4">
            <p className="label text-madder">PAGES</p>
            <button className="btn-outline text-xs">+ NEW PAGE</button>
          </div>
          <div className="space-y-3">
            {pages.map(p => (
              <Link key={p.id} href={`/admin/cms/pages/${p.id}`} className="block bg-beige p-5 hover:bg-mitti/10 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-display text-lg">{p.title}</p>
                    <p className="font-ui text-xs text-monsoon mt-1">{p.slug} · {p.sections} sections</p>
                  </div>
                  <span className={`badge-founder ${p.status === 'PUBLISHED' ? 'bg-neem' : 'bg-mitti'}`}>{p.status}</span>
                </div>
                <p className="label text-monsoon mt-3">UPDATED {new Date(p.updated).toLocaleDateString('en-IN')}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-4">
            <p className="label text-madder">BANNERS</p>
            <button className="btn-outline text-xs">+ NEW BANNER</button>
          </div>
          <div className="space-y-3">
            {banners.map(b => (
              <div key={b.id} className="bg-beige p-5">
                <div className="flex justify-between items-center">
                  <span className="label">{b.position.toUpperCase()}</span>
                  <label className="font-ui text-xs flex items-center gap-2"><input type="checkbox" defaultChecked={b.active} /> ACTIVE</label>
                </div>
                <p className="font-italic italic text-kohl mt-3">&ldquo;{b.text}&rdquo;</p>
                <button className="mt-3 font-ui text-xs tracking-widest text-madder hover:underline">EDIT →</button>
              </div>
            ))}
          </div>

          <p className="label text-madder mt-8 mb-4">JOURNAL POSTS</p>
          <div className="bg-beige p-5">
            <p className="font-display">3 stories published</p>
            <Link href="/admin/cms/journal" className="font-ui text-xs tracking-widest text-madder hover:underline mt-2 inline-block">MANAGE JOURNAL →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
