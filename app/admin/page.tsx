export default function AdminDashboard() {
  const kpis = [
    { label: 'REVENUE TODAY', value: '₹3,42,500', trend: '+12%', color: 'madder' },
    { label: 'ORDERS', value: '47', trend: '+8%', color: 'kohl' },
    { label: 'AVG ORDER VALUE', value: '₹7,287', trend: '+3%', color: 'kohl' },
    { label: 'CONVERSION', value: '3.2%', trend: '+0.4pt', color: 'neem' },
  ];

  return (
    <>
      <p className="label text-madder">DASHBOARD</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Good morning, Nidhi.</h1>
      <p className="font-italic italic text-mitti text-lg mt-2">A trunk was opened in Bandra 4 minutes ago.</p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-4 gap-4 mt-12">
        {kpis.map(k => (
          <div key={k.label} className="bg-beige p-6">
            <p className="label text-monsoon">{k.label}</p>
            <p className={`font-display text-3xl mt-2 text-${k.color}`}>{k.value}</p>
            <p className="font-ui text-xs text-neem mt-1">{k.trend}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 mt-12">
        <div className="col-span-2 bg-beige p-8">
          <p className="label text-madder">REVENUE · LAST 30 DAYS</p>
          <div className="h-64 mt-4 flex items-end gap-2">
            {[40,35,55,48,62,58,71,68,75,72,80,78,82,79,84,81,88,85,92,89,94,90,95,93,98,94,99,96,100,97].map((h,i) => (
              <div key={i} className="flex-1 bg-madder/80 hover:bg-madder transition-colors" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>
        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">TOP SELLING</p>
          <ul className="space-y-3 font-ui text-sm">
            <li className="flex justify-between"><span>Banarasi Silk Saree</span><span className="text-monsoon">12</span></li>
            <li className="flex justify-between"><span>Oxidised Jhumkas</span><span className="text-monsoon">9</span></li>
            <li className="flex justify-between"><span>Mitti Attar</span><span className="text-monsoon">7</span></li>
            <li className="flex justify-between"><span>Chanderi Saree</span><span className="text-monsoon">5</span></li>
            <li className="flex justify-between"><span>Phulkari Dupatta</span><span className="text-monsoon">4</span></li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">RECENT ORDERS</p>
          <table className="w-full font-ui text-sm">
            <tbody>
              {[
                ['NEE-AB4521', 'Priya R.', '₹24,500', 'PACKED'],
                ['NEE-AB4520', 'Aanya M.', '₹3,200', 'SHIPPED'],
                ['NEE-AB4519', 'Mira S.', '₹18,750', 'DELIVERED'],
                ['NEE-AB4518', 'Tara K.', '₹7,200', 'PACKED'],
              ].map(([id, name, amt, status]) => (
                <tr key={id} className="border-b border-mitti/10">
                  <td className="py-3 text-mitti text-xs">{id}</td>
                  <td className="py-3">{name}</td>
                  <td className="py-3 font-medium">{amt}</td>
                  <td className="py-3"><span className="badge-founder">{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-beige p-8">
          <p className="label text-madder mb-4">LOW STOCK ALERTS</p>
          <ul className="space-y-3 font-ui text-sm">
            <li className="flex items-center gap-3"><span className="w-2 h-2 bg-madder rounded-full"></span><span>Banarasi Silk Saree</span><span className="ml-auto text-madder">3 left</span></li>
            <li className="flex items-center gap-3"><span className="w-2 h-2 bg-madder rounded-full"></span><span>Phulkari Dupatta</span><span className="ml-auto text-madder">2 left</span></li>
            <li className="flex items-center gap-3"><span className="w-2 h-2 bg-haldi rounded-full"></span><span>Khurja Vase</span><span className="ml-auto text-haldi">8 left</span></li>
          </ul>
        </div>
      </div>
    </>
  );
}
