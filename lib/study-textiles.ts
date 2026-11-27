export interface StudyTextile {
  alias: string;
  name: string;
  caption: string;
  description: string;
  border: string;
  pallu: string;
  /** Where the design reference comes from. The sample has no documented maker or workshop. */
  region: string;
  reference: string;
  traditionIds: readonly string[];
  searchNames: readonly string[];
}

export const studyTextiles: Readonly<Record<string, StudyTextile>> = {
  surkh: {
    alias: 'Surkh',
    name: 'Vermilion saree with gold checks',
    caption: 'Gujarati gharchola-style checks meet a wine floral pallu.',
    description: 'The small checks stay crisp across the front pleats. Open the pallu over your shoulder and a much larger pattern appears, with rows of gold flowers against wine.',
    border: 'A floral band edged in wine.', pallu: 'Wide bands of gold flowers with a deep plum hem.',
    region: 'Gujarat and Varanasi, Uttar Pradesh',
    reference: 'The red-and-gold grid takes its cue from Gujarati gharchola. The floral pallu is a separate reference to Banarasi brocade.',
    traditionIds: ['gharchola', 'banarasi'], searchNames: ['Surkh Gold Check','Surkh Gharchola-inspired check saree','red','vermilion','gold grid','floral pallu','Banaras'],
  },
  neel: {
    alias: 'Neel',
    name: 'Indigo saree with Bandhani diamonds',
    caption: 'Ivory dotted diamonds and a finely striped pallu.',
    description: 'Ivory dots gather into diamonds across the pleats. Open the pallu over one shoulder and the diamonds give way to fine ivory stripes.',
    border: 'Parallel rows of ivory dots.', pallu: 'Dotted diamonds ending in fine ivory stripes.',
    region: 'Gujarat and Rajasthan', reference: 'The dotted pattern is drawn from the Bandhani tradition of Gujarat and Rajasthan.',
    traditionIds: ['bandhani'], searchNames: ['Neel Diamond','Neel Bandhani-inspired diamond saree','indigo','navy','blue','ivory diamond','bandhej'],
  },
  haldi: {
    alias: 'Haldi',
    name: 'Turmeric saree with a maroon temple border',
    caption: 'Kanchipuram-style temple points fan out with the pleats.',
    description: 'Deep maroon temple points run along the turmeric-yellow edge. Over the shoulder they form a single row. Gathered at the hem, they fan out with the pleats.',
    border: 'Maroon temple points framed by narrow red and gold-toned stripes.', pallu: 'A turmeric-yellow end with fine crosswise bands.',
    region: 'Kanchipuram, Tamil Nadu', reference: 'The sawtooth temple border is a design reference to Kanchipuram sarees from Tamil Nadu.',
    traditionIds: ['kanchipuram'], searchNames: ['Haldi Kinari','Haldi Kanchipuram-inspired temple-border saree','turmeric','mustard','yellow','maroon triangle','Kanjeevaram','Kanjivaram'],
  },
  sage: {
    alias: 'Pista',
    name: 'Pistachio saree with a slim gold border',
    caption: 'A translucent pallu with a Chanderi-style edge.',
    description: 'The pale green deepens where the pleats overlap. A slim gold-toned band catches the light along the shoulder and follows the pallu all the way to its edge.',
    border: 'A slim, warm gold-toned band.', pallu: 'Translucent pale green with a fine gold-toned edge.',
    region: 'Chanderi, Madhya Pradesh', reference: 'The translucent body and narrow border take their cue from Chanderi sarees of Madhya Pradesh.',
    traditionIds: ['chanderi'], searchNames: ['Pista Gold Edge','Pista Chanderi-inspired saree','sage green','pistachio','pale green','A little pistachio'],
  },
  rose: {
    alias: 'Gulabi',
    name: 'Sheer rose-pink saree',
    caption: 'A pale gold-toned edge runs through the pink folds.',
    description: 'Worn over ivory, the shoulder takes on a pale pink tint. Lower down, the overlapping folds turn a deeper rose. A fine gold-toned edge traces the fall of the pallu.',
    border: 'A narrow gold-toned band.', pallu: 'A sheer rose end with a pale edging.',
    region: 'Chanderi, Madhya Pradesh', reference: 'The sheer effect recalls organza. The slender border is a reference to Chanderi sarees from Madhya Pradesh.',
    traditionIds: ['organza','chanderi'], searchNames: ['Gulabi hour','Gulabi organza-look saree','rose pink','sheer pink','organza look'],
  },
  indigo: {
    alias: 'Saanjh',
    name: 'Ink-blue saree with a copper border',
    caption: 'A Maheshwari-style stripe frames the plain blue pallu.',
    description: 'A single copper-toned border cuts across the dark blue pleats. On the open pallu a second, finer line of blue finishes the edge.',
    border: 'A warm copper-toned stripe.', pallu: 'A plain ink-blue end with copper and dark blue edging.',
    region: 'Maheshwar, Madhya Pradesh', reference: 'The striped border takes its cue from Maheshwari sarees of Maheshwar, Madhya Pradesh.',
    traditionIds: ['maheshwari'], searchNames: ['Saanjh Blue','Neeli Maheshwari-inspired saree','midnight blue','navy','indigo','copper border','Blue after dark'],
  },
};
