'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Sparkles, TrendingUp } from 'lucide-react';
import {
  ADMIN_COMMAND_ITEMS,
  ADMIN_FEATURED_HREFS,
  type AdminCommandItem,
} from '@/lib/admin/admin-command-catalog';
import { getAdminCommandInsights } from '@/lib/admin/admin-command-usage';

type QuickSection = {
  key: string;
  eyebrow: string;
  title: string;
  icon: 'recent' | 'frequent' | 'suggested';
  items: AdminCommandItem[];
};

function SectionIcon({ icon }: { icon: QuickSection['icon'] }) {
  if (icon === 'recent') return <Clock3 className="w-4 h-4 text-banarasi" />;
  if (icon === 'frequent') return <TrendingUp className="w-4 h-4 text-madder" />;
  return <Sparkles className="w-4 h-4 text-banarasi" />;
}

export default function AdminAdaptiveQuickActions() {
  const featuredItems = useMemo(
    () =>
      ADMIN_FEATURED_HREFS
        .map((href) => ADMIN_COMMAND_ITEMS.find((item) => item.href === href))
        .filter((item): item is AdminCommandItem => Boolean(item)),
    [],
  );

  const [recentItems, setRecentItems] = useState<AdminCommandItem[]>([]);
  const [frequentItems, setFrequentItems] = useState<AdminCommandItem[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<AdminCommandItem[]>(featuredItems.slice(0, 6));

  useEffect(() => {
    const load = () => {
      const insights = getAdminCommandInsights(ADMIN_COMMAND_ITEMS, 6);
      setRecentItems(insights.recentItems);
      setFrequentItems(insights.frequentItems);
      setSuggestedItems(insights.suggestedItems);
    };

    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  const sections = useMemo<QuickSection[]>(() => {
    const items: QuickSection[] = [];

    if (recentItems.length) {
      items.push({
        key: 'recent',
        eyebrow: 'PERSONALIZED',
        title: 'Recent destinations',
        icon: 'recent',
        items: recentItems,
      });
    }

    if (frequentItems.length) {
      items.push({
        key: 'frequent',
        eyebrow: 'ADAPTIVE',
        title: 'Most-used actions',
        icon: 'frequent',
        items: frequentItems,
      });
    }

    items.push({
      key: 'foundation',
      eyebrow: recentItems.length || frequentItems.length ? 'SUGGESTED' : 'FOUNDATION',
      title: recentItems.length || frequentItems.length ? 'Suggested next actions' : 'Core admin quick actions',
      icon: 'suggested',
      items: featuredItems.slice(0, 6),
    });

    if ((recentItems.length || frequentItems.length) && suggestedItems.length) {
      items.push({
        key: 'explore',
        eyebrow: 'EXPLORE',
        title: 'Additional admin surfaces',
        icon: 'suggested',
        items: suggestedItems,
      });
    }

    return items;
  }, [featuredItems, frequentItems, recentItems, suggestedItems]);

  return (
    <div className="space-y-8 mt-10">
      {sections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SectionIcon icon={section.icon} />
            <div>
              <p className="label text-madder">{section.eyebrow}</p>
              <h2 className="font-display text-2xl text-kohl mt-1">{section.title}</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {section.items.map((item) => (
              <Link
                key={`${section.key}:${item.href}`}
                href={item.href}
                className="bg-beige p-8 hover:bg-white transition-colors border border-mitti/10 rounded-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label text-madder">{item.group}</p>
                    <p className="font-ui text-base text-kohl mt-3 font-medium">{item.label}</p>
                    <p className="font-ui text-sm text-mitti mt-3 leading-6">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-mitti shrink-0 mt-1" />
                </div>
                <p className="font-mono text-[11px] text-mitti/80 mt-5">{item.href}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}