import Link from 'next/link';

export default async function AdminSellerLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

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
