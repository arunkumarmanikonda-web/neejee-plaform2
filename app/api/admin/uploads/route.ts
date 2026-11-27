import { NextResponse } from 'next/server';
import { POST as uploadProductImages } from '../upload/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The existing variant picker consumes a top-level URL. Delegate verification,
// image limits and durable storage to the same handler as the camera.
export async function POST(request: Request) {
  const response = await uploadProductImages(request);
  if (!response.ok) return response;
  const {files} = await response.json();
  return NextResponse.json({ok:true, url:files[0].url});
}
