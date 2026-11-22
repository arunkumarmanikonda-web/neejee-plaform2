import Link from 'next/link';
import { studioHref } from '@/lib/studio';
import styles from './StudioDoors.module.css';

export function StudioDoors({roomPiece,wearable,landing=false}: {roomPiece?:string;wearable?:string;landing?:boolean}) {
  const Heading=landing?'h1':'h2';
  return <section aria-labelledby="studio-title" className={styles.section}>
    <div className={styles.intro}><div><p>Neejee photo studios</p><Heading id="studio-title">Picture it in your life.</Heading></div>
      <Link href="/ai/gift">Choosing for someone else? Find a gift</Link></div>
    <div className={landing?styles.doors:styles.compactDoors}>
      <Link className={styles.door} href={studioHref('mirror',wearable)}>
        {landing && <img src="/brand/studio-mirror.webp" width="960" height="600" alt="Close detail of a wine-red sari and its woven gold border" loading="lazy"/>}
        <div><p>For your wardrobe</p><h3>Try on with Aaina</h3><span>Try a piece from the fitting rail on your own photo.</span><strong>Try it on</strong></div></Link>
      <Link className={styles.door} href={studioHref('imagine',roomPiece)}>
        {landing && <img src="/brand/studio-imagine.webp" width="960" height="600" alt="A wooden writing chest and striped mat in a traditional Chettinad study" loading="lazy"/>}
        <div><p>For your home</p><h3>See décor in my room</h3><span>See a piece in a photo of your own room.</span><strong>Choose a home piece</strong></div></Link>
    </div>
    {landing && <details className={styles.credits}><summary>Photograph credits</summary>
      <p>Chettinad study by <a href="https://commons.wikimedia.org/wiki/File:Chettinadu_study_Room.jpeg">Ravindraboopathi</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a> · cropped.</p>
      <p>Sari border by <a href="https://commons.wikimedia.org/wiki/File:Sari_Border_in_red_and_gold.jpg">Lasta2020</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · cropped.</p>
    </details>}
  </section>;
}
