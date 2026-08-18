import Link from 'next/link';

export default function AdminSellerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Link
          href={`/admin/sellers/${params.id}/communications`}
          className="px-3 py-2 border border-mitti/30 text-mitti text-[10px] tracking-wider hover:bg-mitti/5"
        >
          SELLER COMMUNICATIONS
        </Link>
      </div>
      {children}
    </div>
  );
}
