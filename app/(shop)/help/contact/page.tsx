import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MessageCircle, Mail, Phone } from 'lucide-react';

export const metadata = { title: 'Contact · NEEJEE' };

export default function ContactPage() {
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
        <a href="https://wa.me/919876512345" className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <MessageCircle className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">WHATSAPP · FASTEST</p>
          <p className="font-display text-lg mt-2">+91 98765 12345</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
        </a>
        <a href="mailto:hello@neejee.com" className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <Mail className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">EMAIL</p>
          <p className="font-display text-lg mt-2">hello@neejee.com</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Replied within 24h</p>
        </a>
        <a href="tel:+919876512345" className="bg-beige p-8 text-center hover:bg-mitti/10 transition-colors">
          <Phone className="w-8 h-8 mx-auto text-madder" />
          <p className="label text-madder mt-4">CALL</p>
          <p className="font-display text-lg mt-2">+91 98765 12345</p>
          <p className="font-italic italic text-mitti text-sm mt-1">Mon–Sat · 10am–7pm IST</p>
        </a>
      </section>
      <Footer />
    </>
  );
}
