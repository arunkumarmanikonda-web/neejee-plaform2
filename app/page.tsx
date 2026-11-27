import { FashionStorefront } from '@/components/home/FashionStorefront';
export const revalidate = 60;
export const runtime = 'nodejs';
export default function HomePage() { return <FashionStorefront/>; }
