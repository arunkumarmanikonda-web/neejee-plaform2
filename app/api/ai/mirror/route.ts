import { submitStudio } from '@/lib/ai/studio-submit';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:Request){return submitStudio(request,'mirror');}
