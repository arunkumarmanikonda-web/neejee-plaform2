import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Camera, Home, Gift, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI — Personal Surfaces · NEEJEE',
  description: 'Mirror, Space, and Gift Concierge — personal AI surfaces that help you find what feels right.',
};

export default function AiHubPage() {
  return (
    <>
      <Header />

      <section className="bg-kohl text-ivory py-20 px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-banarasi mb-4">AI · PERSONAL SURFACES</p>
        <h1 className="font-display text-5xl md:text-7xl">Personal, even before it ships.</h1>
        <p className="font-italic italic text-ivory/70 max-w-2xl mx-auto mt-6 text-lg">
          Three quiet surfaces, built so the choice always stays yours. Try a piece on you.
          Place it in your home. Find a gift for someone you love.
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
        <Surface
          href="/ai/mirror"
          icon={<Camera className="w-7 h-7" />}
          name="AI Mirror"
          tagline="See it on you"
          body="Upload a portrait. We will mirror NEEJEE pieces onto you — privately, in seconds — so you know how something looks before it ships."
          accent="bg-kohl"
        />
        <Surface
          href="/ai/space"
          icon={<Home className="w-7 h-7" />}
          name="AI Space"
          tagline="See it at home"
          body="Upload a corner of your room. We will place a textile, a lamp, an artefact — so you know how it lives in your light."
          accent="bg-mitti"
        />
        <Surface
          href="/ai/gift"
          icon={<Gift className="w-7 h-7" />}
          name="Gift Concierge"
          tagline="Find a personal gift"
          body="Tell us who, what occasion, what feels like them. We will choose three to six pieces that fit — quietly, the way a friend would."
          accent="bg-madder"
        />
      </div>

      <section className="bg-beige py-16 px-6 text-center">
        <p className="label text-madder">A PROMISE</p>
        <h2 className="font-display text-3xl md:text-4xl text-kohl mt-3 max-w-2xl mx-auto">
          Your image stays yours.
        </h2>
        <p className="font-italic italic text-mitti mt-4 max-w-xl mx-auto leading-relaxed">
          Every photo you upload is used only to generate your preview. It stays private,
          is never shown to anyone but you, and auto-deletes after thirty days.
        </p>
      </section>

      <Footer />
    </>
  );
}

function Surface({ href, icon, name, tagline, body, accent }: any) {
  return (
    <Link
      href={href}
      className="group bg-ivory border border-mitti/20 hover:border-kohl p-8 transition-colors block"
    >
      <div className={`w-14 h-14 ${accent} text-ivory rounded-full flex items-center justify-center mb-6 group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <p className="text-xs tracking-[0.3em] text-madder">{tagline.toUpperCase()}</p>
      <h3 className="font-display text-3xl text-kohl mt-2">{name}</h3>
      <p className="text-sm text-kohl/75 leading-relaxed mt-4">{body}</p>
      <p className="text-xs tracking-wider text-madder mt-6 flex items-center gap-1.5">
        OPEN → <Sparkles className="w-3 h-3" />
      </p>
    </Link>
  );
}
