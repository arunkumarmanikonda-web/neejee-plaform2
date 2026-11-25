import Link from 'next/link';
import { studioHref } from '@/lib/studio';
import styles from './StudioDoors.module.css';

export function StudioDoors({roomPiece,wearable,landing=false}: {roomPiece?:string;wearable?:string;landing?:boolean}) {
  if (!landing) return <section className={styles.fitting} aria-label="Aaina fitting room">
    <div className={styles.composition}><img className={styles.cloth} src="/brand/study-views/neel.webp" alt="Indigo saree laid out to see its border" loading="lazy"/>
      <div className={styles.accessories}><img src="/brand/pairing/ivory-blouse.webp" alt="Ivory blouse" loading="lazy"/><img src="/brand/lookbook/jutti-gold.webp" alt="Gold juttis" loading="lazy"/></div></div>
    <div className={styles.fittingCopy}><span><b lang="hi">आईना</b> Your fitting room</span><h2>Aaina</h2><p>See the saree with your own blouse. Add a pair of juttis, choose your jewellery, then try the look on your photo.</p>
      <Link href={studioHref('mirror',wearable)}>Try a saree with my blouse</Link>
      <Link className={styles.roomLink} href={studioHref('imagine',roomPiece)}>See a home piece in my room</Link></div>
  </section>;
  const Heading='h1';
  return <section aria-labelledby="studio-title" className={styles.section}>
    <div className={styles.intro}><div><p>Neejee photo studios</p><Heading id="studio-title">Picture it in your life.</Heading></div>
      <Link href="/ai/gift">Choosing for someone else? Find a gift</Link></div>
    <div className={landing?styles.doors:styles.compactDoors}>
      <Link className={styles.door} href={studioHref('mirror',wearable)}>
        {landing && <img src="/brand/studio-mirror.webp" width="960" height="600" alt="Close detail of a wine-red sari and its woven gold border" loading="lazy"/>}
        <div><p>For your wardrobe</p><h3>Try on with Aaina</h3><span>Try a piece from the fitting rail on your own photo.</span><strong>Try it on</strong></div></Link>
      <Link className={styles.door} href={studioHref('imagine',roomPiece)}>
        {landing && <img src="/brand/house/home-objects.webp" width="960" height="600" alt="Brass, blue pottery and madder cotton in an Indian home" loading="lazy"/>}
        <div><p>For your home</p><h3>See décor in my room</h3><span>See a piece in a photo of your own room.</span><strong>Choose a home piece</strong></div></Link>
    </div>
    {landing && <details className={styles.credits}><summary>Photograph credits</summary>
      <p>Sari border by <a href="https://commons.wikimedia.org/wiki/File:Sari_Border_in_red_and_gold.jpg">Lasta2020</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · cropped.</p>
    </details>}
  </section>;
}
