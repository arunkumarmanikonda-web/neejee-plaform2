import { falRun } from '@/lib/ai';
import { makeUploadPath, storageConfigured, uploadFile } from '@/lib/storage';
import { makeStyleImage, openAiStyleAvailable } from './openai-image';

export function creativeImagesConfigured() {
  return Boolean(process.env.FAL_KEY?.trim()) || (openAiStyleAvailable() && storageConfigured());
}

type CreativeRequest = {
  endpoint: string;
  input: Record<string, any>;
  timeoutMs: number;
  aspect: string;
  folder: string;
  filename?: string;
  objectPath?: string;
};

// Only retry on a missing credential or an explicit rejection at submission.
// Timeouts and failures after acceptance may already have created a billed job.
export async function runCreativeImages(request: CreativeRequest) {
  const result = await falRun(request);
  if (!result.credentialRejected || !openAiStyleAvailable() || !storageConfigured()) {
    return { ...result, stored: false };
  }
  const { input } = request;
  const count = Math.min(4, Math.max(1, Number(input.num_images) || 1));
  const images = await Promise.allSettled(Array.from({ length: count }, async () => {
    const jpeg = await makeStyleImage(input.prompt, input.image_urls || [], request.aspect);
    const path = request.objectPath || makeUploadPath(request.folder, (request.filename || 'creative') + '.jpg');
    const saved = await uploadFile(path, jpeg, 'image/jpeg');
    return { url: saved.url };
  }));
  const successful = images.flatMap(image => image.status === 'fulfilled' ? [image.value] : []);
  const error = images.some(image => image.status === 'rejected') ? 'The alternate image service could not save all requested images.' : undefined;
  return { ok: successful.length > 0, data: { images: successful }, stored: true, error };
}
