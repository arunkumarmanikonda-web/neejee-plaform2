import { products, formatPrice } from '@/lib/data';

export default function AdminProducts() {
  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <p className="label text-madder">CATALOG</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Products</h1>
        </div>
        <button className="btn-primary">+ ADD PRODUCT</button>
      </div>

      <div className="flex gap-2 mt-8 font-ui text-xs tracking-widest">
        {[`ALL (${products.length})`, 'ACTIVE', 'DRAFT', 'OUT OF STOCK'].map(t => (
          <button key={t} className="px-4 py-2 bg-beige hover:bg-mitti/20 text-kohl">{t}</button>
        ))}
      </div>

      <table className="w-full mt-8 font-ui text-sm bg-beige">
        <thead>
          <tr className="border-b border-mitti/20 text-left">
            <th className="p-4 text-xs tracking-widest text-mitti">IMAGE</th>
            <th className="p-4 text-xs tracking-widest text-mitti">PRODUCT</th>
            <th className="p-4 text-xs tracking-widest text-mitti">SKU</th>
            <th className="p-4 text-xs tracking-widest text-mitti">PRICE</th>
            <th className="p-4 text-xs tracking-widest text-mitti">STOCK</th>
            <th className="p-4 text-xs tracking-widest text-mitti">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4"><div className="w-12 h-14 bg-ivory rounded"></div></td>
              <td className="p-4">
                <p className="font-display text-base">{p.name}</p>
                <p className="font-ui text-xs text-mitti mt-1">{p.craft} · {p.region}</p>
              </td>
              <td className="p-4 text-monsoon text-xs">{p.sku}</td>
              <td className="p-4 font-medium">{formatPrice(p.sellingPrice)}</td>
              <td className="p-4">
                <span className={p.inventory <= 3 ? 'text-madder' : 'text-neem'}>{p.inventory}</span>
              </td>
              <td className="p-4"><span className="badge-founder">ACTIVE</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
