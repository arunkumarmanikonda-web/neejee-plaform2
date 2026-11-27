import { notFound } from 'next/navigation';
import CameraTrial from './CameraTrial';
export const dynamic = 'force-dynamic';
export const metadata = {title:'Staff camera preview | Neejee', robots:{index:false,follow:false}};
export default function CameraReview() {
  if (process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV !== 'development') notFound();
  return <CameraTrial />;
}
