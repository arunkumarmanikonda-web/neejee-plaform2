export type CaptureView = { id: string; label: string; hint: string; ratio: number; optional?: boolean };
const wide = 4 / 3, tall = 3 / 4, detail = 1;
function view(id: string, label: string, ratio: number, hint: string, optional = false): CaptureView {
  return { id, label, ratio, hint, optional };
}
const guides = {
  saree: [
    view('body', 'Open body', wide, 'Spread one full width. Keep both borders and two motif repeats inside the corners.'),
    view('pallu', 'Open pallu', wide, 'Open the entire pallu. Include the change of pattern and finished edge.'),
    view('border', 'Border detail', detail, 'Frame the join between body and border. Place a ruler along its width.'),
    view('blouse', 'Blouse piece', wide, 'Open the included blouse piece and its sleeve border. Skip if sold without one.'),
    view('drape', 'Worn drape for Aaina', 2 / 3, 'Step back until the shoulder, pleats, open pallu and hem are all inside the frame.', true),
  ],
  suit: [
    view('set','Complete set',wide,'Lay out every included piece within the corners.'),
    view('front','Kurta front',tall,'Centre the neckline and leave space below the hem.'),
    view('back','Kurta back',tall,'Include the full back, sleeves and fastening.'),
    view('dupatta','Dupatta and bottom',wide,'Spread the dupatta beside the bottom. Show both edges.'),
  ],
  unstitched: [
    view('set','All fabric cuts',wide,'Place all included cuts side by side.'),
    view('panel','Kameez panel',tall,'Show the whole panel and its neckline placement.'),
    view('dupatta','Open dupatta',wide,'Include every edge of the spread dupatta.'),
    view('bottom','Salwar and detail',detail,'Set the salwar fabric beside the kameez detail.'),
  ],
  blouse: [
    view('front','Blouse front',tall,'Centre the neckline with both sleeves inside the guide.'),
    view('back','Back and fastening',tall,'Show the full back including the fastening.'),
    view('sleeve','Sleeve and side',detail,'Turn the blouse to show sleeve length and the armhole.'),
    view('work','Neckline or embroidery',detail,'Fill the frame with the defining stitch or neckline.'),
  ],
  fabric: [
    view('full','Full blouse piece',wide,'Spread the entire piece flat, including all cut edges.'),
    view('pattern','Body pattern',detail,'Frame one complete motif repeat.'),
    view('border','Sleeve or border',wide,'Include the full depth of the panel.'),
    view('reverse','Reverse and selvage',detail,'Turn back an edge to show the underside.'),
  ],
  jewellery: [
    view('whole','Complete piece',detail,'Centre the entire necklace, bangle or pair of earrings.'),
    view('profile','Side profile',detail,'Turn the piece to show its depth and setting.'),
    view('clasp','Clasp or reverse',detail,'Show the fastening, post or reverse in focus.'),
    view('scale','Actual scale',detail,'Place the piece beside a metric ruler in the same plane.'),
  ],
  footwear: [
    view('pair','Pair from above',detail,'Fit both shoes inside the guide, heel to toe.'),
    view('side','Outer side',wide,'Show the full outer side and toe shape.'),
    view('sole','Heel and sole',wide,'Turn one shoe to show the sole and heel.'),
    view('finish','Toe and lining',detail,'Show the embroidery and the inner finish.'),
  ],
  textiles: [
    view('whole','Whole textile',wide,'Lay it flat with all edges visible.'),
    view('back','Reverse',wide,'Turn it over to show the back and fastening.'),
    view('weave','Weave and edge',detail,'Frame the seam, weave or embroidery.'),
    view('use','In use',wide,'Show the textile in use with an object for scale.'),
  ],
  furniture: [
    view('front','Front three-quarter',wide,'Include the entire piece, from its top to its feet.'),
    view('side','Side profile',wide,'Keep the full depth and height inside the corners.'),
    view('back','Back or underside',wide,'Show the back or underside and its construction.'),
    view('join','Joinery and finish',detail,'Frame a joint, grain detail or hardware.'),
  ],
  object: [
    view('whole','Whole object',detail,'Centre the whole object with space around its edges.'),
    view('reverse','Reverse or base',detail,'Show the back, underside or maker’s mark.'),
    view('finish','Material and finish',detail,'Frame the surface detail in even light.'),
    view('scale','Side and scale',wide,'Place the object beside a ruler and show its side.'),
  ],
};
export type Guide = keyof typeof guides;
export const guideNames: Record<Guide, string> = {
  saree:'Saree', suit:'Stitched suit set', unstitched:'Unstitched suit', blouse:'Stitched blouse',
  fabric:'Blouse fabric', jewellery:'Jewellery', footwear:'Juttis and footwear',
  textiles:'Home textiles', furniture:'Furniture', object:'Décor and other objects',
};
export function guideFor(category: string): Guide {
  const text = category.toLowerCase().replace(/[-_/]/g, ' ');
  if (/blouse.{0,15}(piece|fabric|unstitched)|unstitched blouse/.test(text)) return 'fabric';
  if (/blouse/.test(text)) return 'blouse';
  if (/saree|sari\b|saris\b/.test(text)) return 'saree';
  if (/unstitched|dress material|semi stitched/.test(text)) return 'unstitched';
  if (/suit|kurta|kurti|salwar|kameez|anarkali/.test(text)) return 'suit';
  if (/jewel|necklace|jhumk|earring|bangle|kada|bracelet|pendant|anklet|maang tikka|ring\b/.test(text)) return 'jewellery';
  if (/footwear|jutti|jooti|mojari|shoe/.test(text)) return 'footwear';
  if (/furniture|chair|stool|cabinet|console|sofa/.test(text)) return 'furniture';
  if (/textile|cushion|quilt|throw|linen|curtain|rug|bedspread|tablecloth/.test(text)) return 'textiles';
  return 'object';
}
export function shotsFor(guide: Guide): CaptureView[] { return guides[guide]; }
export function shotFileName(guide: Guide, shot: CaptureView) { return 'neejee-shot-' + guide + '-' + shot.id + '.jpg'; }
export function matchesShot(url: string, fileName: string) {
  const path = url.startsWith('blob:') ? url.split('#/')[1] || '' : url.split(/[?#]/, 1)[0];
  const name = path.split('/').pop() || '';
  return name === fileName || name.endsWith('-' + fileName);
}
// The live view uses object-fit: cover and a centred object-position.
export function frameCrop(width: number, height: number, ratio: number) {
  if (!(width > 0 && height > 0 && ratio > 0)) throw new Error('Wait for a camera image.');
  const sw = Math.min(width, height * ratio);
  const sh = sw / ratio;
  return {sx:(width - sw) / 2, sy:(height - sh) / 2, sw, sh};
}
