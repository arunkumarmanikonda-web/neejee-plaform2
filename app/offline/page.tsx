import Link from 'next/link';

export const dynamic = 'force-static';
export default function OfflinePage() {
  return <main style={{background:'#faf6ec',color:'#352a25',minHeight:'100vh',padding:'12vh 7vw'}}>
    <p style={{color:'#733435',letterSpacing:'.2em'}}>NEE·JEE</p>
    <h1 style={{fontFamily:'Georgia, serif',fontSize:'2rem',marginTop:'1.2rem'}}>The shop needs a connection.</h1>
    <p style={{margin:'1rem 0'}}>Reconnect to browse, check your bag or view your orders.</p>
    <Link href="/" style={{display:'inline-block',padding:'.8rem 1.2rem',background:'#733435',color:'#fff'}}>Open the shop</Link>
  </main>;
}
