import { faqs } from './shop-faq';
import type { PitariReply } from './pitari';

const topics: Record<string,RegExp> = {
  international:/international|outside india|overseas|ship (?:to|in) (?:the )?(?:us|uk|usa|uae|dubai|america|canada|australia|singapore)\b/i,
  shipping:/shipping (?:fees?|charges?|cost|rates?)|delivery (?:fee|charge|cost)|free (?:shipping|delivery)|express shipping|cost.*(?:ship|deliver)|(?:ship|deliver).*cost/i,
  returns:/return policy|returns policy|returnable|returns? allowed|damaged (?:piece|item)|wrong item/i,
  cod:/cash on delivery|\bcod\b|pay on delivery/i,
  authenticity:/authentic|provenance|verified craft|genuine|neejee select/i,
  preview:/photo privacy|who (?:can )?sees? my photo|keep my photo|what happens to my photo|how.*(?:ai preview|use my photo)/i,
  sellers:/seller commission|seller fees?|vendor commission|sell (?:on|with) neejee|become a seller/i,
};
export function shopHelp(question:string): PitariReply | null {
  if (/who (?:is|are) (?:sakhi|you)|what can (?:sakhi|you) do|^hi$|^hello$|^namaste$|^नमस्ते$/i.test(question.trim())) return {
    text:'I’m Sakhi, your Neejee companion. I can help you pick a gift, style a saree, check a piece’s price or fabric, and follow an order. What do you have in mind?',
    links:[{label:'Browse the collection',href:'/products'}]};
  if (/founder|founded|who (?:owns|started) neejee|what (?:is|does) neejee (?:mean|stand for)|story behind neejee/i.test(question)) return {
    text:'Neejee means personal. Our founder, Nidhi Chauhan, tells the story of how a loom in Banaras helped inspire the house.',
    links:[{label:'Our story',href:'/about'}]};
  const key=Object.keys(topics).find(k=>topics[k].test(question));
  const entry=faqs.find(f=>f.key===key);
  if (!entry) return null;
  const link=key==='returns' ? {label:'Returns and exchanges',href:'/help/returns'} :
    key==='preview' ? {label:'Read the privacy policy',href:'/legal/privacy'} :
    key==='sellers' ? {label:'Sell with Neejee',href:'/sellers'} :
    key==='shipping'||key==='international' ? {label:'Shipping and delivery',href:'/help/shipping'} : {label:'Shop FAQs',href:'/help/faq'};
  return {text:entry.a,links:[link]};
}
