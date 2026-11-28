import { getStyleAccessories } from '@/lib/style-accessories';
import { allAccessoriesPresent, getEditorialPiece, readStyling, selectedAccessories, stockStyling } from '@/lib/stylebook';
import { buildStyledInput, readOwnPhotos } from './styled-fitting';
import { submitStudioTask } from '@/lib/ai';
import { signStudioJob } from './studio-job';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { aiMirrorConfigured, falSubmitTryOn, submitRoomPlacement } from '@/lib/ai';
import { makeStyleImage, openAiStyleAvailable } from './openai-image';
import { createPrivateAiMediaUrl, verifyPrivateAiMediaRequest } from './private-media';
import { privateStudioReadUrl, storageConfigured, makeUploadPath, uploadPrivateAiFile, deleteFile } from '@/lib/storage';
import { findStudioPiece } from '@/lib/studio-catalog';
import type { StudioMode } from '@/lib/studio';

export async function submitStudio(request:Request,mode:StudioMode) {
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Sign in to create a photo preview.'},{status:401});
  const data=await request.json().catch(()=>null);
  if(!data || data.consent!==true || typeof data.productId!=='string')return NextResponse.json({error:'Choose a piece and confirm permission to process your photo.'},{status:400});
  const mirror=mode==='mirror';
  const source=mirror?data.personImageUrl:data.roomImageUrl;
  let url:URL;
  try { url=new URL(source); } catch {return NextResponse.json({error:'Choose your photo again.'},{status:400});}
  const proof=verifyPrivateAiMediaRequest(url);
  const valid=proof.ok && url.pathname==='/api/ai/media' && proof.path.startsWith((mirror?'ai-mirror/':'ai-space/')+session.id+'/');
  if(!valid || !proof.ok)return NextResponse.json({error:'Choose your photo again. Its upload link is no longer valid.'},{status:400});
  const requestedStyle = mirror && data.styling ? readStyling(data.styling) : null;
  const styling = requestedStyle && data.productId !== 'look-'+requestedStyle.look ? stockStyling(requestedStyle) : requestedStyle;
  if (data.styling && !styling) return NextResponse.json({error:'Please choose the look and accessories again.'},{status:400});
  const own=readOwnPhotos(data.ownPhotos);
  if(!own || (Object.keys(own).length && (!styling || Object.keys(own).some(k=>styling[k as keyof typeof own] && styling[k as keyof typeof own]!=='none'))))
    return NextResponse.json({error:'Choose the personal styling photos again.'},{status:400});
  const study = styling && data.productId==='look-'+styling.look ? getEditorialPiece(styling) : null;
  const piece=study || await findStudioPiece(mode,data.productId,mirror);
  if(!piece)return NextResponse.json({error:'This piece is currently unavailable for that preview.'},{status:404});
  const option=data.variantId?piece.variants.find(v=>v.id===data.variantId):piece.variants.length===1?piece.variants[0]:undefined;
  if(!option)return NextResponse.json({error:'Choose an available colour or size.'},{status:400});
  if(!aiMirrorConfigured() || !storageConfigured())return NextResponse.json({error:'Photo rendering is temporarily unavailable.'},{status:503});
  const canonicalSource=new URL(url.pathname+url.search,request.url).href;
  try {
    const accessories=styling ? await getStyleAccessories([styling.shoe,styling.jewel,styling.blouse||'none'],true) : [];
    if(styling && !allAccessoriesPresent(styling,accessories)) return NextResponse.json({error:'A chosen accessory is no longer available. Please choose a new pairing.'},{status:404});
    const mainImage = option.image || (!mirror ? piece.image : '');
    if (!mainImage) return NextResponse.json({error:'A fitting photo for this colour or size is not available yet.'},{status:422});
    const reference = new URL(mainImage,request.url).href;
    const fabricDetails = ('fabricDetails' in option ? option.fabricDetails : undefined) || [];
    const input=await privateStudioReadUrl(proof.path);
    const styled = styling && (study || selectedAccessories(styling,accessories).length || Object.keys(own).length);
    const styledInput = styled || fabricDetails.length
      ? await buildStyledInput(input, study ? study.image : reference, styling, accessories, request.url, own, fabricDetails)
      : null;
    const description = [piece.craft, piece.material, piece.name, option.color].filter(Boolean).join(' ');
    const submit = styledInput ? await submitStudioTask('fal-ai/nano-banana-2/edit', styledInput)
      : mirror ? await falSubmitTryOn(input, reference) : await submitRoomPlacement(input, reference, description);
    const preview = {
      userId: session.id, type: mirror ? 'MIRROR' as const : 'SPACE' as const, sourceImage: canonicalSource,
      productIds: [...new Set([...(study ? [] : [piece.id]), ...accessories.map(item => item.productId).filter((id): id is string => !!id)])],
      consentLogged: true, deleteAt: new Date(Date.now() + 30 * 86400000),
    };
    if (submit.credentialRejected && openAiStyleAvailable()) {
      const prompt = styledInput?.prompt || (mirror
        ? 'Dress the person in image 1 in the exact garment from image 2. Preserve their appearance, pose and surroundings, and the colour, motifs and drape of the garment.'
        : 'Place the exact object from image 2 in the room from image 1. Match the existing perspective and lighting and preserve the room. Object: ' + description);
      const jpg = await makeStyleImage(prompt, styledInput?.image_urls || [input, reference]);
      const path = makeUploadPath((mirror ? 'ai-mirror/' : 'ai-space/') + session.id, 'preview.jpg');
      const outputUrl = createPrivateAiMediaUrl(new URL(request.url).origin, path);
      await uploadPrivateAiFile(path, jpg, 'image/jpeg');
      try {
        const saved = await prisma.aiPreview.create({ data: { ...preview, outputImage: outputUrl } });
        return NextResponse.json({ ok: true, done: true, configured: true, previewId: saved.id, outputUrl });
      } catch (error) {
        await deleteFile('private-ai:' + path).catch(() => {});
        throw error;
      }
    }
    if (!submit.ok || !submit.requestId || !submit.endpoint) return NextResponse.json({error:'The studio could not start the preview. Please try again.'},{status:502});
    const pending = await prisma.aiPreview.create({ data: preview });
    const query=new URLSearchParams({id:submit.requestId,previewId:pending.id,endpoint:submit.endpoint});
    if(submit.statusUrl)query.set('statusUrl',submit.statusUrl);
    if(submit.responseUrl)query.set('responseUrl',submit.responseUrl);
    signStudioJob(session.id,query);
    return NextResponse.json({ok:true,done:false,configured:true,previewId:pending.id,pollUrl:'/api/ai/mirror/status?'+query.toString()});
  } catch {
    return NextResponse.json({error:'The photo service could not finish this request. Please try again.'},{status:502});
  }
}
