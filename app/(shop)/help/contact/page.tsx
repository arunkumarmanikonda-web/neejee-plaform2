'use client';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MessageCircle, Mail, Phone } from 'lucide-react';

interface PublicContact {
  email: string;
  phone: string;
  whatsappUrl: string;
  telUrl: string;
  mailUrl: string;
}

const FALLBACK: PublicContact = {
  email: 'hello@neejee.com',
  phone: '',
  whatsappUrl: '',
  telUrl: '',
  mailUrl: 'mailto:hello@neejee.com',
};

export default function ContactPage() {
  const [contact, setContact] = useState<PublicContact>(FALLBACK);

  useEffect(() => {
    let active = true;
    fetch('/api/public/site-config')
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Contact configuration unavailable');
        return body;
      })
      .then((body) => {
        if (active && body?.contact) setContact({ ...FALLBACK, ...body.contact });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <>
      <Header />
      <main>
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="label text-madder">PERSONALLY HERE FOR YOU</p>
          <h1 className="font-display text-5xl text-kohl mt-4">Contact</h1>
          <p className="font-italic italic text-mitti mt-4">A small team. Personal replies.</p>
          <div className="madder-divider mx-auto mt-6"></div>
        </section>

        <section className="max-w-3xl mx-auto px-6 flex flex-wrap justify-center gap-6 pb-16" aria-label="Contact NEEJEE">
          {contact.whatsappUrl && contact.phone && (
            <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors w-full md:w-[calc(33.333%-1rem)] min-w-[200px]">
              <MessageCircle className="w-8 h-8 mx-auto text-madder" aria-hidden="true" />
              <p className="label text-madder mt-4">WHATSAPP · FASTEST</p>
              <p className="font-display text-lg mt-2">{contact.phone}</p>
              <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
            </a>
          )}

          {contact.mailUrl && contact.email && (
            <a href={contact.mailUrl} className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors w-full md:w-[calc(33.333%-1rem)] min-w-[200px]">
              <Mail className="w-8 h-8 mx-auto text-madder" aria-hidden="true" />
              <p className="label text-madder mt-4">EMAIL</p>
              <p className="font-display text-lg mt-2 break-all">{contact.email}</p>
              <p className="font-italic italic text-mitti text-sm mt-1">Replied within 24h</p>
            </a>
          )}

          {contact.telUrl && contact.phone && (
            <a href={contact.telUrl} className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors w-full md:w-[calc(33.333%-1rem)] min-w-[200px]">
              <Phone className="w-8 h-8 mx-auto text-madder" aria-hidden="true" />
              <p className="label text-madder mt-4">CALL</p>
              <p className="font-display text-lg mt-2">{contact.phone}</p>
              <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
            </a>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
