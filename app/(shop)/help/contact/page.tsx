'use client';
// v23.40.25 — Reads contact info from public site-config so admin edits in
// /admin/legal-entity propagate instantly to this page.
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
  phone: '+91 98765 12345',
  whatsappUrl: 'https://wa.me/919876512345',
  telUrl: 'tel:+919876512345',
  mailUrl: 'mailto:hello@neejee.com',
};

export default function ContactPage() {
  const [contact, setContact] = useState<PublicContact>(FALLBACK);

  useEffect(() => {
    fetch('/api/public/site-config', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.contact) setContact({ ...FALLBACK, ...d.contact }); })
      .catch(() => {});
  }, []);

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="label text-madder">PERSONALLY HERE FOR YOU</p>
        <h1 className="font-display text-5xl text-kohl mt-4">Contact</h1>
        <p className="font-italic italic text-mitti mt-4">A small team. Personal replies.</p>
        <div className="madder-divider mx-auto mt-6"></div>
      </section>

      <section className="max-w-3xl mx-auto px-6 grid md:grid-cols-3 gap-6 pb-16">
        <a href={contact.whatsappUrl} target="_blank" rel="noopener" className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <MessageCircle className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">WHATSAPP · FASTEST</p>
          <p className="font-display text-lg mt-2">{contact.phone}</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
        </a>
        <a href={contact.mailUrl} className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <Mail className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">EMAIL</p>
          <p className="font-display text-lg mt-2 break-all">{contact.email}</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Replied within 24h</p>
        </a>
        <a href={contact.telUrl} className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <Phone className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">CALL</p>
          <p className="font-display text-lg mt-2">{contact.phone}</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
        </a>
      </section>
      <Footer />
    </>
  );
}
