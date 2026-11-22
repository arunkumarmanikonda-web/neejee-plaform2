import type { EditSlug } from '@/lib/shop-edits';
import styles from './CollectionCover.module.css';

const covers = {
  sarees: { title: 'Sarees', hindi: 'साड़ियाँ', note: 'Browse by colour, craft and region.', image: '/brand/campaign/indigo-detail.webp', alt: 'Ivory dots and fine stripes in the folds of an indigo saree' },
  suits: { title: 'Suit sets', hindi: 'सूट', note: 'Kurtas, trousers and dupattas, worn together.', image: '/brand/study-views/wine-suit.webp', alt: 'Wine and ivory floral kurta, trousers and dupatta' },
  clothing: { title: 'Sarees & suits', hindi: 'पहनावा', note: 'Explore the collection.', image: '/brand/campaign/vermilion.webp', alt: 'Vermilion checks with a wine and gold border' },
  home: { title: 'Home & objects', hindi: 'घर', note: 'Brass, pottery and pieces for the table.', image: '/brand/house/home-objects.webp', alt: 'Brass urli, marigolds and a blue pottery jar on wood' },
  furniture: { title: 'Furniture', hindi: 'घर', note: 'Wood, colour and carved detail.', image: '/brand/journey-furniture.webp', alt: 'A decorated wooden bed with turned legs' },
} as const;

export function ShopSign({ department }: { department: EditSlug }) {
  const c = covers[department];
  return <header className={styles.cover} data-department={department}>
    <img src={c.image} alt={c.alt} fetchPriority="high"/>
    <div className={styles.copy}><span lang="hi">{c.hindi}</span><h1>{c.title}</h1><p>{c.note}</p></div>
  </header>;
}
