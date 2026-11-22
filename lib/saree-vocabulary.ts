export type SareeTermKind = 'tradition' | 'technique' | 'material' | 'fabric'

export interface SareeVocabularyEntry {
  id: string
  name: string
  kind: SareeTermKind
  aliases: readonly string[]
  /** A geographical reference for the glossary, never the provenance of a listed item. */
  origin: string
  description: string
  source?: string
  /** Ambiguous shopper spellings are excluded when matching supplied item evidence. */
  searchOnlyAliases?: readonly string[]
  spellingNote?: string
}

const weavingClusters = 'https://whc.unesco.org/en/tentativelists/5890/'
const nationalHandlooms = 'https://www.handlooms.gov.in/assets/img/EBOOK/Sustainability%20in%20the%20Handloom%20Traditions%20of%20India.pdf'
const textileSurvey = 'https://ignca.gov.in/PDF_data/Report_Mapping_Indian_Textiles.pdf'
const rajasthanCrafts = 'https://handmadeinrajasthan.rajasthan.gov.in/content/industries/handmadeinrajasthandepartment/artandcraft'

export const sareeVocabulary: readonly SareeVocabularyEntry[] = [
  {
    id: 'kalamkari', name: 'Kalamkari', kind: 'technique', aliases: ['kalam kari', 'कलमकारी'],
    origin: 'Srikalahasti and Machilipatnam, Andhra Pradesh',
    description: 'At Srikalahasti artists draw with a pen. In the Machilipatnam tradition carved blocks lay down the pattern.',
    source: 'https://hte.rajasthan.gov.in/Website/GOVERNMENTWOMENPOLYTECHNICCOLLEGEUDAIPUR/CONTENTFILES/naynima_2019.pdf',
  },
  {
    id: 'bandhani', name: 'Bandhani', kind: 'technique', aliases: ['bandhni', 'bandhni work', 'bandhini', 'bandhej', 'bandhniya', 'बंधनी', 'बांधनी', 'बंधेज'],
    origin: 'Gujarat and Rajasthan',
    description: 'Tiny points of cloth are tied before dyeing. The pale dots left by the ties can form flowers, diamonds or flowing lines.',
    source: textileSurvey,
  },
  {
    id: 'leheriya', name: 'Leheriya', kind: 'technique', aliases: ['lehariya', 'leheria', 'lahariya', 'laheria', 'लहरिया'],
    origin: 'Rajasthan, including Jaipur and Jodhpur',
    description: 'Cloth is rolled diagonally, tied at intervals and dyed. The resulting bands sweep across the drape like ripples.',
    source: rajasthanCrafts + '/textilework/lahariya.html',
  },
  {
    id: 'ajrakh', name: 'Ajrakh', kind: 'technique', aliases: ['ajrak', 'azrakh', 'ajrakh print', 'अजरख', 'अजरक'],
    origin: 'Kutch in Gujarat, Barmer in Rajasthan and Sindh in Pakistan',
    description: 'Printers use carved blocks, resists and successive dye baths to build repeated patterns, often in indigo and madder.',
    source: rajasthanCrafts + '/textilework/ajrakhprinting.html',
  },
  {
    id: 'patola', name: 'Patola', kind: 'tradition', aliases: ['patolu', 'patan patola', 'patola silk', 'पटोला'],
    origin: 'Gujarat, especially Patan',
    description: 'In Patan double ikat, both sets of yarn are resist-dyed before weaving. Their alignment brings each motif into focus.',
    source: weavingClusters,
  },
  {
    id: 'organza', name: 'Organza', kind: 'fabric', aliases: ['organsa', 'ऑर्गेंज़ा', 'ऑर्गेंजा'],
    origin: 'Used across textile traditions',
    description: 'A sheer, crisp plain weave that holds an airy fold. Organza can be made from silk or manufactured fibres.',
    source: 'https://vintagefashionguild.org/resources/item/fabric/organza/',
  },
  {
    id: 'gota-patti', name: 'Gota patti', kind: 'technique', aliases: ['gotapatti', 'gotta patti', 'gota pati', 'gotta pati', 'gota work', 'गोटा पट्टी', 'गोटा पत्ती'],
    origin: 'Rajasthan, including Jaipur',
    description: 'Small pieces of metallic ribbon are folded or cut into shapes and stitched to the cloth. Look for raised, light-catching edges.',
    source: rajasthanCrafts + '/embroidarywork/gotapatti.html',
  },
  {
    id: 'kanchipuram', name: 'Kanchipuram', kind: 'tradition', aliases: ['kanjeevaram', 'kanjivaram', 'kanchivaram', 'kanjevaram', 'kancheepuram', 'kanjivaram silk', 'kanchi pattu', 'कांजीवरम', 'कांचीपुरम'],
    origin: 'Kanchipuram, Tamil Nadu',
    description: 'A silk saree tradition known for contrasting borders and pallus. Stepped temple motifs are one familiar border design.',
    source: weavingClusters,
  },
  {
    id: 'dharmavaram', name: 'Dharmavaram', kind: 'tradition', aliases: ['dharmavaram pattu', 'dharmavaram silk', 'dharmavram', 'धर्मावरम'],
    origin: 'Dharmavaram, Andhra Pradesh',
    description: 'Broad borders and elaborate pallus give this silk saree its visual weight. Some versions shimmer in two tones as the cloth turns.',
    source: 'https://www.indiahandloombrand.gov.in/pages/downloadFile/dharmavaram-saree.pdf',
  },
  {
    id: 'maheshwari', name: 'Maheshwari', kind: 'tradition', aliases: ['maheswari', 'maheshvari', 'maheshwar saree', 'maheshwar sari', 'माहेश्वरी', 'महेश्वरी'],
    origin: 'Maheshwar, Madhya Pradesh',
    description: 'Fine stripes, checks and patterned borders frame a light drape. Contrasting bands often give the pallu its rhythm.',
    source: 'https://www.incredibleindia.gov.in/en/madhya-pradesh/maheshwar-sarees-and-fabrics',
  },
  {
    id: 'banarasi', name: 'Banarasi', kind: 'tradition', aliases: ['banarsi', 'benarasi', 'banarashi', 'banaras brocade', 'banaras silk', 'benares brocade', 'बनारसी'],
    origin: 'Varanasi and its weaving region, Uttar Pradesh',
    description: 'Brocade weavers build motifs into the cloth with additional threads. Flowering vines, small butis and detailed end panels are familiar designs.',
    source: 'https://www.handicrafts.nic.in/CmsUpload/12222017102212GI%20BOOK%20FINAL%202-5-17_resized.pdf',
  },
  {
    id: 'gharchola', name: 'Gharchola', kind: 'tradition', aliases: ['ghar chola', 'gharcholu', 'gharcholu saree', 'ghar cholu', 'घरचोला'],
    origin: 'Gujarat',
    description: 'On this wedding textile, lines of zari divide the cloth into squares. Tied bandhani motifs traditionally sit within that grid.',
    source: 'https://tisser.in/tisser-crafts/gujarat/publication.html',
  },
  {
    id: 'chikankari', name: 'Chikankari', kind: 'technique', aliases: ['chikan kari', 'chikankary', 'chikan embroidery', 'lucknowi chikan', 'चिकनकारी'],
    origin: 'Lucknow and the Awadh region, Uttar Pradesh',
    description: 'A family of embroidery stitches can give petals a soft shadow, a raised surface or a fine openwork texture.',
    source: 'https://www.incredibleindia.gov.in/en/uttar-pradesh/lucknow/witness-the-rich-culture-while-shopping-in-lucknow',
  },
  {
    id: 'chanderi', name: 'Chanderi', kind: 'tradition', aliases: ['chaderi', 'chandheri', 'chandery', 'चंदेरी'],
    origin: 'Chanderi, Madhya Pradesh',
    description: 'A light, often translucent ground makes small woven motifs and fine borders stand out. Weavers work in cotton, silk and blends.',
    source: weavingClusters,
  },
  {
    id: 'kota-doria', name: 'Kota Doria', kind: 'tradition', aliases: ['kota dorea', 'kota doriya', 'kotadoria', 'kotadoriya', 'kota doriyah', 'कोटा डोरिया'],
    origin: 'Kaithoon and the Kota region, Rajasthan',
    description: 'Tiny square checks called khats form part of the weave. Look through a single layer to see the open grid.',
    source: nationalHandlooms,
  },
  {
    id: 'paithani', name: 'Paithani', kind: 'tradition', aliases: ['paithni', 'paithanee', 'paithani silk', 'पैठणी', 'पैठनी'],
    origin: 'Paithan and Yeola, Maharashtra',
    description: 'Tapestry-woven borders and pallus can carry brilliantly coloured peacocks, parrots and flowers against a metallic ground.',
    source: weavingClusters,
  },
  {
    id: 'pochampally', name: 'Pochampally', kind: 'tradition', aliases: ['pochampalli', 'pochampally ikat', 'pochampally ikkat', 'pochampalle', 'pochampaly', 'पोचमपल्ली', 'पोचमपल्ली इकत'],
    origin: 'Bhoodan Pochampally and the surrounding weaving area, Telangana',
    description: 'Ikat weavers tie and dye yarn in measured sections before it reaches the loom. The coloured sections meet to form the pattern.',
    source: 'https://www.indiahandloombrand.gov.in/pages/downloadFile/pochampally-ikat-dress-material.pdf',
  },
  {
    id: 'kasavu', name: 'Kasavu', kind: 'tradition', aliases: ['kasabu', 'kasav', 'kasavu saree', 'kasavu sari', 'कसावु', 'कसावू', 'കസവ്'],
    origin: 'Kerala, including Balaramapuram',
    description: 'Kasavu refers to the metallic thread of the border. In the classic Kerala saree it frames a cream or off-white ground.',
    source: 'https://www.indiahandloombrand.gov.in/pages/downloadFile/balaramapuram-cotton-saree.pdf',
  },
  {
    id: 'bhagalpuri', name: 'Bhagalpuri', kind: 'tradition', aliases: ['bhagalpuri silk', 'bhagalpur silk', 'bhagalpur tussar', 'bhagalpuri tussar', 'bhagalpuri tasar', 'भागलपुरी'],
    origin: 'Bhagalpur, Bihar',
    description: 'Bhagalpur is a silk-weaving centre closely associated with tussar. Bhagalpuri identifies the regional tradition. The fibre varies by piece.',
    source: nationalHandlooms,
  },
  {
    id: 'tussar', name: 'Tussar silk', kind: 'material', aliases: ['tussar', 'tasar', 'tassar', 'tussah', 'tusser', 'tussore', 'tussur', 'tasar silk', 'टसर', 'तसर'],
    origin: 'Several silk-producing regions, including eastern and central India',
    description: 'A family of non-mulberry silks. Undyed tropical tussar often shows a warm tan colour and a textured surface.',
    source: nationalHandlooms,
  },
  {
    id: 'jamdani', name: 'Jamdani', kind: 'technique', aliases: ['jamdhani', 'jaamdani', 'dhakai jamdani', 'jam danni', 'जामदानी', 'জামদানি'],
    origin: 'The Bengal region, especially around Dhaka in Bangladesh, with related traditions elsewhere',
    description: 'Weavers introduce extra weft only where a motif appears. Against a fine ground, the motifs seem to float.',
    source: 'https://ich.unesco.org/en/RL/traditional-skills-of-weaving-jamdani-00879',
  },
  {
    id: 'gadwal', name: 'Gadwal', kind: 'tradition', aliases: ['gadwaal', 'gadwala', 'gadval', 'गडवाल', 'गदवाल'],
    searchOnlyAliases: ['gharwal'],
    spellingNote: 'Searching for “Gharwal”? Gadwal sarees are associated with Telangana. Garhwal is a separate region in Uttarakhand.',
    origin: 'Gadwal, Telangana',
    description: 'A classic Gadwal combines a cotton body with contrasting silk at the borders and pallu. The change in texture is part of its appeal.',
    source: 'https://www.indiahandloombrand.gov.in/pages/downloadFile/gadwal-saree.pdf',
  },
  {
    id: 'muga', name: 'Muga silk', kind: 'material', aliases: ['muga', 'mooga', 'moonga silk', 'moonga silkj', 'munga silk', 'mugha silk', 'मूगा सिल्क', 'मूगा रेशम'],
    origin: 'Assam and neighbouring parts of northeast India',
    description: 'Muga is a silk fibre associated with Assam. Its natural golden colour gives even an unpatterned length of cloth a warm glow.',
    source: 'https://hts.assam.gov.in/sites/default/files/swf_utility_folder/departments/hts_medhassu_in_oid_3/menu/document/Handloom%20Policy.pdf',
  },
  {
    id: 'ikat', name: 'Ikat', kind: 'technique', aliases: ['ikkat', 'ikat weave', 'ikath', 'इकत'],
    origin: 'Practised in many regions, including Telangana, Odisha and Gujarat',
    description: 'Yarn is resist-dyed before weaving. Single ikat patterns one direction of yarn. Double ikat patterns both.',
    source: textileSurvey,
  },
  {
    id: 'baluchari', name: 'Baluchari', kind: 'tradition', aliases: ['baluchori', 'baluchuri', 'बालूचरी'],
    origin: 'West Bengal, historically Baluchar and now also Bishnupur',
    description: 'Look to the end panel for small woven figures or scenes arranged within decorative borders.',
    source: 'https://www.prod.incredibleindia.gov.in/content/incredible-india-v2/en/destinations/bishnupur/baluchari-sarees.html',
  },
  {
    id: 'mysore-silk', name: 'Mysore silk', kind: 'tradition', aliases: ['mysuru silk', 'मैसूर सिल्क'],
    origin: 'Mysuru, Karnataka',
    description: 'A regional silk tradition. A plain lustrous body and a contrasting zari border are a familiar combination.',
    source: textileSurvey,
  },
  {
    id: 'cotton', name: 'Cotton', kind: 'material', aliases: ['cotton yarn', 'कॉटन', 'सूती'],
    origin: 'Used across textile traditions',
    description: 'A plant fibre from the cotton boll. Yarn weight and weave determine whether a cotton saree feels crisp or soft.',
  },
  {
    id: 'linen', name: 'Linen', kind: 'material', aliases: ['flax linen', 'लिनन'],
    origin: 'Used across textile traditions',
    description: 'Linen comes from flax. Its characteristic creases are especially visible in a plain weave.',
  },
  {
    id: 'silk', name: 'Silk', kind: 'material', aliases: ['रेशम', 'silks'],
    origin: 'Used across textile traditions',
    description: 'A fibre spun by silkworms. Mulberry, tussar and muga are different kinds of silk.',
  },
]

/** Keep Indic vowel signs intact while making Latin spellings accent-insensitive. */
export function normalizeSareeText(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
    .toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim()
}

function paddedPhrase(text: string): string {
  return ' ' + normalizeSareeText(text) + ' '
}

const searchIndex = sareeVocabulary.map(term => ({
  term,
  names: [term.id, term.name, ...term.aliases].map(paddedPhrase),
  suggestions: (term.searchOnlyAliases ?? []).map(paddedPhrase),
}))

/** Whole words and phrases only. Set includeSuggestions to false for supplied item metadata. */
export function findSareeTerms(text: string, includeSuggestions = true): SareeVocabularyEntry[] {
  const input = paddedPhrase(text)
  return searchIndex
    .filter(({ names, suggestions }) => names.some(name => input.includes(name))
      || (includeSuggestions && suggestions.some(name => input.includes(name))))
    .map(({ term }) => term)
}

export function findSareeTraditions(text: string, includeSuggestions = true): SareeVocabularyEntry[] {
  return findSareeTerms(text, includeSuggestions).filter(term => term.kind === 'tradition')
}
