export interface StudyTextile {
  name: string;
  motif: string;
  description: string;
  border: string;
  pallu: string;
  /** The source of the motif, distinct from a catalogue SKU's verified place of manufacture. */
  region: string;
  reference: string;
  traditionIds: readonly string[];
  searchNames: readonly string[];
}

export const studyTextiles: Readonly<Record<string, StudyTextile>> = {
  surkh: {
    name: 'Surkh', motif: 'Gharchola checks',
    description: 'Fine gold checks run through the vermilion pleats. Open the pallu and the small squares give way to broad rows of flowers.',
    border: 'A gold floral band between two narrow wine stripes.',
    pallu: 'Floral bands on wine, with a deeper plum edge.',
    region: 'Gujarat and Varanasi, Uttar Pradesh',
    reference: 'The checks recall a Gujarati gharchola. The floral pallu draws on the brocades of Banaras.',
    traditionIds: ['gharchola', 'banarasi'], searchNames: ['Surkh Gold Check','Surkh Gharchola-inspired check saree','red','vermilion','gold grid','floral pallu','Banaras'],
  },
  neel: {
    name: 'Neel', motif: 'Bandhani dot motif',
    description: 'Ivory dots form rows of diamonds across deep indigo. Along the edge, the same dots draw a fine stripe.',
    border: 'Narrow rows of ivory dots.', pallu: 'Larger diamonds above a striped hem.',
    region: 'Gujarat and Rajasthan', reference: 'The dotted diamonds recall Bandhani patterns from Gujarat and Rajasthan.',
    traditionIds: ['bandhani'], searchNames: ['Neel Diamond','Neel Bandhani-inspired diamond saree','indigo','navy','blue','ivory diamond','bandhej'],
  },
  haldi: {
    name: 'Haldi', motif: 'Temple border',
    description: 'A maroon temple border runs from shoulder to hem. Against the turmeric yellow, each point is visible even when the cloth falls into pleats.',
    border: 'Maroon temple points with a narrow outer stripe.', pallu: 'Turmeric yellow with fine bands across the end.',
    region: 'Kanchipuram, Tamil Nadu', reference: 'The temple-border motif draws on sarees from Kanchipuram, Tamil Nadu.',
    traditionIds: ['kanchipuram'], searchNames: ['Haldi Kinari','Haldi Kanchipuram-inspired temple-border saree','turmeric','mustard','yellow','maroon triangle','Kanjeevaram','Kanjivaram'],
  },
  sage: {
    name: 'Pista', motif: 'Slim gold border',
    description: 'A single gold line traces the shoulder and reappears at each pistachio pleat. The pallu is pale enough to show the layers beneath.',
    border: 'A slender gold-toned band.', pallu: 'Pale green layers with a narrow edge.',
    region: 'Chanderi, Madhya Pradesh', reference: 'The narrow border and translucent layers draw on Chanderi sarees from Madhya Pradesh.',
    traditionIds: ['chanderi'], searchNames: ['Pista Gold Edge','Pista Chanderi-inspired saree','sage green','pistachio','pale green','A little pistachio'],
  },
  rose: {
    name: 'Gulabi', motif: 'Sheer drape',
    description: 'Sheer rose layers fall over an ivory blouse. A fine gold edge catches the light at the hem.',
    border: 'A pale gold-toned line.', pallu: 'An open pink end with fine parallel bands.',
    region: 'Chanderi, Madhya Pradesh', reference: 'The sheer effect recalls organza. The slim border takes its cue from Chanderi sarees.',
    traditionIds: ['organza','chanderi'], searchNames: ['Gulabi hour','Gulabi organza-look saree','rose pink','sheer pink','organza look'],
  },
  indigo: {
    name: 'Saanjh', motif: 'Maheshwari stripe motif',
    description: 'Copper-coloured stripes outline an ink-blue drape. The pallu shows the widest stripe when it hangs open.',
    border: 'Slim copper-toned stripes.', pallu: 'A broad copper band above a dark hem.',
    region: 'Maheshwar, Madhya Pradesh', reference: 'The linear edging is a reference to Maheshwari sarees from Maheshwar.',
    traditionIds: ['maheshwari'], searchNames: ['Saanjh Blue','Neeli Maheshwari-inspired saree','midnight blue','navy','indigo','copper border','Blue after dark'],
  },
};
