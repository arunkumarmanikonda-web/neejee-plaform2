export interface StudyTextile {
  name: string
  designation: 'Design study'
  description: string
  border: string
  pallu: string
  /** Location of design inspiration, independent of merchant or garment provenance. */
  region: string
  /** Glossary entries informing the study, including surface treatments and fabric references. */
  traditionIds: readonly string[]
  /** Shop vocabulary and former editorial names, so saved looks remain findable. */
  searchNames: readonly string[]
}

/** Each illustration is read from the front drape. End-panel notes describe only what is visible. */
export const studyTextiles: Readonly<Record<string, StudyTextile>> = {
  sage: {
    name: 'Pista Chanderi-inspired saree',
    designation: 'Design study',
    description: 'A muted pistachio field, soft-looking front pleats and a slim gold-coloured edge. The transparent layer over the shoulder recalls the lightness of a Chanderi drape.',
    border: 'A slender warm-gold band follows the diagonal across the body.',
    pallu: 'The pale green end falls over the forearm in loose layers. A narrow band runs beside its edge.',
    region: 'Chanderi, Madhya Pradesh',
    traditionIds: ['chanderi'],
    searchNames: ['Pista', 'Pistachio', 'Sage green', 'Pale green gold border', 'Chanderi', 'A little pistachio'],
  },
  rose: {
    name: 'Gulabi organza-look saree',
    designation: 'Design study',
    description: 'A translucent rose-pink drape worn over an ivory blouse. The gauzy layers suggest organza, while the quiet border takes a cue from light Chanderi sarees.',
    border: 'A fine, pale gold-coloured band outlines the pink and catches the light at the front hem.',
    pallu: 'The rose end hangs open from the forearm, showing fine parallel bands and small pale accents.',
    region: 'Chanderi, Madhya Pradesh, for the fine border',
    traditionIds: ['organza', 'chanderi'],
    searchNames: ['Gulabi', 'Rose pink', 'Organza look', 'Sheer pink', 'Chanderi-inspired border', 'Gulabi hour'],
  },
  indigo: {
    name: 'Neeli Maheshwari-inspired saree',
    designation: 'Design study',
    description: 'Deep ink-blue cloth and a quiet copper-coloured stripe draw the eye to the outline of the drape. The narrow, linear edging takes its cue from Maheshwar.',
    border: 'Slim copper-toned stripes trace the neckline, the overlapping pleats and the hem.',
    pallu: 'The dark blue end drops beside the arm. A copper-toned band crosses the lower end above a dark hem.',
    region: 'Maheshwar, Madhya Pradesh',
    traditionIds: ['maheshwari'],
    searchNames: ['Neeli', 'Indigo', 'Midnight blue', 'Navy copper border', 'Maheshwari', 'Blue after dark'],
  },
  surkh: {
    name: 'Surkh Gharchola-inspired check saree',
    designation: 'Design study',
    description: 'A fine gold-coloured grid crosses a vermilion field. The checks refer to a Gujarati gharchola, while the broad floral end takes a separate cue from Banarasi brocade.',
    border: 'A warm gold-coloured floral band runs between slim plum lines, interrupting the fine red checks.',
    pallu: 'At the forearm the checks give way to broad bands of floral ornament and a deep plum edge.',
    region: 'Gujarat for the checks and Varanasi, Uttar Pradesh, for the floral end',
    traditionIds: ['gharchola', 'banarasi'],
    searchNames: ['Surkh', 'Vermilion red checks', 'Gold check', 'Ghar chola', 'Gharchola-inspired', 'Banarasi-inspired floral pallu', 'Surkh Gold Check'],
  },
  neel: {
    name: 'Neel Bandhani-inspired diamond saree',
    designation: 'Design study',
    description: 'Ivory dots gather into diamonds, small sprigs and lines on a deep indigo ground. The spacing of the dots recalls bandhani tie patterns.',
    border: 'Parallel rows of ivory dots frame the field of diamonds.',
    pallu: 'The end hangs open to show stacked diamond bands and rows of pale dots above the hem.',
    region: 'Gujarat and Rajasthan',
    traditionIds: ['bandhani'],
    searchNames: ['Neel', 'Indigo diamonds', 'White dots on blue', 'Bandhej', 'Bandhani-inspired', 'Neel Diamond'],
  },
  haldi: {
    name: 'Haldi Kanchipuram-inspired temple-border saree',
    designation: 'Design study',
    description: 'A turmeric-yellow body sets off a maroon border of pointed temple shapes. Their scale makes the edge easy to follow from the shoulder to the floor.',
    border: 'A row of maroon triangles points into the yellow field. A thin maroon line defines the outer edge.',
    pallu: 'The loose yellow end at the side carries the same lengthwise temple edging and a few fine crosswise bands near the bottom.',
    region: 'Kanchipuram, Tamil Nadu',
    traditionIds: ['kanchipuram'],
    searchNames: ['Haldi', 'Turmeric yellow', 'Mustard maroon', 'Temple border', 'Kanjeevaram-inspired', 'Kanjivaram', 'Haldi Kinari'],
  },
}
