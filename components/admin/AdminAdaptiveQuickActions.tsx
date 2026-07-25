'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  Compass,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import {
  ADMIN_COMMAND_ITEMS,
  ADMIN_FEATURED_HREFS,
  type AdminCommandItem,
} from '@/lib/admin/admin-command-catalog';
import { getVisibleAdminCommandItems } from '@/lib/admin/admin-command-access';
import { getAdminCommandInsights } from '@/lib/admin/admin-command-usage';
import {
  dedupeAdminItems,
  getAdminRoleFocus,
  getAdminRouteContext,
  getContextualAdminItems,
  getExplorationAdminItems,
  getRolePriorityAdminItems,
} from '@/lib/admin/admin-page-quick-actions';

type Props = {
  user: SessionUser;
};

type QuickSection = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: 'continue' | 'context' | 'role' | 'explore';
  items: AdminCommandItem[];
};

function SectionIcon({ icon }: { icon: QuickSection['icon'] }) {
  if (icon === 'continue') return <Clock3 className="w-4 h-4 text-banarasi" />;
  if (icon === 'context') return <Compass className="w-4 h-4 text-madder" />;
  if (icon === 'role') return <ShieldCheck className="w-4 h-4 text-banarasi" />;
  return <Sparkles className="w-4 h-4 text-madder" />;
}

export default function AdminAdaptiveQuickActions({ user }: Props) {
  const pathname = usePathname() || '/admin';
  const visibleItems = useMemo(
    () => getVisibleAdminCommandItems(ADMIN_COMMAND_ITEMS, user),
    [user],
  );

  const featuredItems = useMemo(
    () =>
      dedupeAdminItems(
        ADMIN_FEATURED_HREFS
          .map((href) => visibleItems.find((item) => item.href === href))
          .filter((item): item is AdminCommandItem => Boolean(item)),
        6,
      ),
    [visibleItems],
  );

  const [recentItems, setRecentItems] = useState<AdminCommandItem[]>([]);
  const [frequentItems, setFrequentItems] = useState<AdminCommandItem[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<AdminCommandItem[]>(featuredItems);

  useEffect(() => {
    const load = () => {
      const insights = getAdminCommandInsights(visibleItems, 6);
      setRecentItems(insights.recentItems);
      setFrequentItems(insights.frequentItems);
      setSuggestedItems(dedupeAdminItems([...insights.suggestedItems, ...featuredItems], 6));
    };

    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [featuredItems, visibleItems]);

  const routeContext = useMemo(() => getAdminRouteContext(pathname), [pathname]);
  const roleFocus = useMemo(() => getAdminRoleFocus(user), [user]);

  const sections = useMemo<QuickSection[]>(() => {
    const used = new Set<string>();
    const nextSections: QuickSection[] = [];

    const takeUnused = (items: AdminCommandItem[], limit = 6) => {
      const picked: AdminCommandItem[] = [];

      for (const item of items) {
        if (item.href === pathname || used.has(item.href)) continue;
        used.add(item.href);
        picked.push(item);
        if (picked.length >= limit) break;
      }

      return picked;
    };

    const continueItems = takeUnused(
      dedupeAdminItems([...recentItems, ...frequentItems], 8),
      6,
    );

    if (continueItems.length) {
      nextSections.push({
        key: 'continue',
        eyebrow: 'CONTINUE',
        title: 'Resume your active workflows',
        description: 'These are the places you touched most recently or most often, so you can pick work back up immediately.',
        icon: 'continue',
        items: continueItems,
      });
    }

    const contextualItems = takeUnused(getContextualAdminItems(visibleItems, pathname, 8), 6);
    if (contextualItems.length) {
      nextSections.push({
        key: 'context',
        eyebrow: routeContext.eyebrow,
        title: routeContext.title,
        description: routeContext.description,
        icon: 'context',
        items: contextualItems,
      });
    }

    const roleItems = takeUnused(getRolePriorityAdminItems(visibleItems, user, 8), 6);
    if (roleItems.length) {
      nextSections.push({
        key: 'role',
        eyebrow: roleFocus.eyebrow,
        title: roleFocus.title,
        description: roleFocus.description,
        icon: 'role',
        items: roleItems,
      });
    }

    const exploreItems = takeUnused(
      dedupeAdminItems(
        [
          ...suggestedItems,
          ...featuredItems,
          ...getExplorationAdminItems(visibleItems, Array.from(used), 8),
        ],
        12,
      ),
      6,
    );

    if (exploreItems.length) {
      nextSections.push({
        key: 'explore',
        eyebrow: 'EXPLORE',
        title: 'Suggested next actions',
        description: 'These suggestions broaden the path from your recent work into adjacent admin surfaces worth checking next.',
        icon: 'explore',
        items: exploreItems,
      });
    }

    return nextSections;
  }, [
    featuredItems,
    pathname,
    recentItems,
    roleFocus.description,
    roleFocus.eyebrow,
    roleFocus.title,
    routeContext.description,
    routeContext.eyebrow,
    routeContext.title,
    suggestedItems,
    user,
    visibleItems,
    frequentItems,
  ]);

  return (
    <div className="space-y-8 mt-10">
      {sections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mt-1">
              <SectionIcon icon={section.icon} />
            </div>
            <div className="min-w-0">
              <p className="label text-madder">{section.eyebrow}</p>
              <h2 className="font-display text-2xl text-kohl mt-1">{section.title}</h2>
              <p className="font-ui text-sm text-mitti mt-2 leading-6 max-w-3xl">
                {section.description}
              </p>
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

                {item.aliases?.length ? (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {item.aliases.slice(0, 2).map((alias) => (
                      <span
                        key={`${item.href}:${alias}`}
                        className="px-2 py-1 rounded-full bg-white border border-mitti/15 text-[10px] text-mitti"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="font-mono text-[11px] text-mitti/80 mt-5">{item.href}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}