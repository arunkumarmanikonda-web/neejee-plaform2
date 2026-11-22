import '@/components/shop/dressing.css';
export function HouseHeading({title,stage}:{title:string;stage:string}) {
  return <header className="nj-house-heading border-y border-mitti/25 bg-[#f5eddd] px-5 py-5 md:px-8 md:py-7">
    <div className="flex items-center gap-3 text-madder font-ui text-sm"><img src="/brand/house/floral-sprig.svg" width="37" height="32" alt=""/><span>{stage}</span></div>
    <h1 className="font-display text-4xl md:text-5xl text-kohl mt-2">{title}</h1>
  </header>;
}
