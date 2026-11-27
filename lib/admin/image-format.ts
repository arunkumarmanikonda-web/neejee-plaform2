export function catalogImageType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  const ascii = (start:number,end:number) => bytes.toString('ascii',start,end);
  if (['GIF87a','GIF89a'].includes(ascii(0,6))) return 'image/gif';
  if (ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP') return 'image/webp';
  if (ascii(4,8) === 'ftyp') {
    const end = Math.min(bytes.readUInt32BE(0),bytes.length);
    for (let i=8;i+4<=end;i+=4) if (i !== 12 && ['avif','avis'].includes(ascii(i,i+4))) return 'image/avif';
  }
  return null;
}
