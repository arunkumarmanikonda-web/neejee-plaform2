import Image from 'next/image';
import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = { sm: 88, md: 166, lg: 180, xl: 260 };
const LOCKUP_WIDTH = 440;
const LOCKUP_HEIGHT = 98;

export function NeejeeLogo({ className='', size='md', variant='default', showTagline=false }: Props) {
  const width=SIZE_MAP[size];
  return <span className={className} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',maxWidth:'100%',width}}>
    <Image src={variant==='ivory'?'/brand/neejee-personal-reverse.svg':'/brand/neejee-personal-lockup.svg'} alt="NEEJEE" width={LOCKUP_WIDTH} height={LOCKUP_HEIGHT}
      draggable={false} priority={size==='lg' || size==='xl'} style={{width:'100%',height:'auto',filter:variant==='mono'?'grayscale(1)':undefined}}/>
    {showTagline && <span style={{fontSize:Math.max(10,width*.073),lineHeight:1.35,letterSpacing:'.1em',marginTop:3}}>{NEEJEE_TAGLINE}</span>}
  </span>;
}
