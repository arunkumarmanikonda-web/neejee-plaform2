'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Command,
  CornerDownLeft,
  Search,
  Sparkles,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { ADMIN_COMMAND_ITEMS, type AdminCommandItem } from '@/lib/admin/admin-command-catalog';
import { getAdminCommandRoleBoost, getVisibleAdminCommandItems } from '@/lib/admin/admin-command-access';
import { getAdminCommandUsageState, recordAdminCommandUsage } from '@/lib/admin/admin-command-usage';

type Props = {
  user: SessionUser;
};

type PaletteActionItem = {
  kind: 'action';
  id: string;
  label: string;
  group: string;
  desc: string;
  keywords: string[];
  aliases?: string[];
  boost?: number;
  shortcutLabel?: string;
};

type PalettePageResult = AdminCommandItem & {
  kind: 'page';
  score: number;
};

type PaletteActionResult = PaletteActionItem & {
  score: number;
};

type PaletteResult = PalettePageResult | PaletteActionResult;

const QUICK_SCOPE_ITEMS = [
  { label: 'Reports', query: 'profit and loss', hint: 'P&L, trial balance, payouts' },
  { label: 'Settings', query: 'settings', hint: 'Platform settings and controls' },
  { label: 'SEO', query: 'seo settings', hint: 'SEO, metadata, canonical, robots' },
  { label: 'Sellers', query: 'seller onboarding', hint: 'Sellers, onboarding, change requests' },
  { label: 'Products', query: 'products', hint: 'Catalog, products, categories' },
  { label: 'Orders', query: 'orders', hint: 'Orders, disputes, customers' },
] as const;

function normalizeCommandText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTextMatch(
  q: string,
  item: {
    label: string;
    group: string;
    desc: string;
    keywords: string[];
    aliases?: string[];
    href?: string;
  },
) {
  if (!q) return 1;

  const aliases = item.aliases ?? [];
  const fields = [
    item.label,
    item.group,
    item.desc,
    item.href ?? '',
    ...item.keywords,
    ...aliases,
  ];

  const normalizedFields = fields.map(normalizeCommandText);
  const qTokens = q.split(' ').filter(Boolean);

  let score = 0;

  if (normalizeCommandText(item.label).includes(q)) score += 12;
  if (normalizeCommandText(item.group).includes(q)) score += 4;
  if (normalizeCommandText(item.desc).includes(q)) score += 3;
  if ((item.href ? normalizeCommandText(item.href).includes(q) : false)) score += 4;
  if (item.keywords.some((keyword) => normalizeCommandText(keyword).includes(q))) score += 8;
  if (aliases.some((alias) => normalizeCommandText(alias).includes(q))) score += 10;
  if (normalizedFields.some((field) => field.includes(q))) score += 2;

  if (qTokens.length && normalizedFields.some((field) => qTokens.every((token) => field.includes(token)))) {
    score += 7;
  }

  const exactAlias = aliases.find((alias) => normalizeCommandText(alias) === q);
  if (exactAlias) score += 6;

  return score;
}

export default function AdminCommandPalette({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const visibleItems = useMemo(
    () => getVisibleAdminCommandItems(ADMIN_COMMAND_ITEMS, user),
    [user],
  );

  const directActions = useMemo<PaletteActionItem[]>(
    () => [
      {
        kind: 'action',
        id: 'copy-url',
        label: 'Copy current admin URL',
        group: 'Actions',
        desc: 'Copy the current admin page link to the clipboard.',
        keywords: ['copy', 'url', 'link', 'share', 'clipboard'],
        aliases: ['copy page link', 'share this page', 'copy current link'],
        boost: 4,
        shortcutLabel: 'COPY URL',
      },
      {
        kind: 'action',
        id: 'refresh-page',
        label: 'Refresh this admin page',
        group: 'Actions',
        desc: 'Refresh the current page without leaving the workflow.',
        keywords: ['refresh', 'reload', 'retry', 'reopen'],
        aliases: ['reload page', 'refresh current page', 'retry this screen'],
        boost: 3,
        shortcutLabel: 'REFRESH',
      },
      {
        kind: 'action',
        id: 'open-new-tab',
        label: 'Open this admin page in a new tab',
        group: 'Actions',
        desc: 'Duplicate the current admin page in a separate browser tab.',
        keywords: ['new tab', 'duplicate tab', 'open separately'],
        aliases: ['duplicate this page', 'open in another tab'],
        boost: 2,
        shortcutLabel: 'NEW TAB',
      },
      {
        kind: 'action',
        id: 'go-back',
        label: 'Go back to the previous page',
        group: 'Actions',
        desc: 'Return to the previous admin screen.',
        keywords: ['back', 'previous', 'return'],
        aliases: ['go back', 'previous page', 'back one page'],
        boost: 2,
        shortcutLabel: 'BACK',
      },
      {
        kind: 'action',
        id: 'admin-home',
        label: 'Open admin home',
        group: 'Actions',
        desc: 'Jump back to the admin dashboard.',
        keywords: ['home', 'dashboard', 'admin home'],
        aliases: ['go to admin', 'dashboard home', 'open dashboard'],
        boost: 2,
        shortcutLabel: 'HOME',
      },
    ],
    [],
  );

  const openPalette = (nextQuery = '') => {
    setQuery(nextQuery);
    setCursor(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (hotkey) {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      setQuery(detail?.query ?? '');
      setCursor(0);
      setOpen(true);
    };

    window.addEventListener('neejee:admin-command-open', onOpen as EventListener);
    return () => window.removeEventListener('neejee:admin-command-open', onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = normalizeCommandText(query);
    const usage = getAdminCommandUsageState();
    const recentOrder = new Map(usage.recent.map((href, index) => [href, index]));
    const counts = usage.counts;

    const pageResults: PalettePageResult[] = visibleItems
      .filter((item) => item.href !== pathname)
      .map((item): PalettePageResult => {
        const textScore = scoreTextMatch(q, item);
        const usageScore = Math.min((counts[item.href] ?? 0) * 2, 10);
        const recentScore = recentOrder.has(item.href)
          ? Math.max(6 - (recentOrder.get(item.href) ?? 0), 1)
          : 0;
        const roleScore = getAdminCommandRoleBoost(item, user);
        const baseBoost = item.boost ?? 0;

        return {
          ...item,
          kind: 'page' as const,
          score: textScore + usageScore + recentScore + roleScore + baseBoost,
        };
      })
      .filter((item) => item.score > 0);

    const actionResults: PaletteActionResult[] = directActions
      .map((item) => {
        const textScore = scoreTextMatch(q, item);
        const baseBoost = item.boost ?? 0;

        return {
          ...item,
          score: textScore + baseBoost,
        };
      })
      .filter((item) => item.score > 0);

    return [...actionResults, ...pageResults]
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 16);
  }, [directActions, pathname, query, user, visibleItems]);

  const active = results[cursor];

  const openHref = (href: string) => {
    recordAdminCommandUsage(href);
    setOpen(false);
    router.push(href);
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      const input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
  };

  const runAction = async (id: PaletteActionItem['id']) => {
    setOpen(false);

    switch (id) {
      case 'copy-url':
        await copyToClipboard(window.location.href);
        break;
      case 'refresh-page':
        router.refresh();
        break;
      case 'open-new-tab':
        window.open(window.location.href, '_blank', 'noopener,noreferrer');
        break;
      case 'go-back':
        router.back();
        break;
      case 'admin-home':
        router.push('/admin');
        break;
      default:
        break;
    }
  };

  const runResult = (item: PaletteResult) => {
    if (item.kind === 'action') {
      void runAction(item.id);
      return;
    }

    openHref(item.href);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-2 px-2 pb-6 bg-gradient-to-b from-ivory via-ivory to-transparent">
        <button
          type="button"
          onClick={() => openPalette('')}
          className="w-full bg-white border border-mitti/15 rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-sm hover:border-madder/30 transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Search className="w-4 h-4 text-madder shrink-0" />
            <span className="text-sm text-kohl text-left truncate">
              Search pages, settings, reports, SEO, sellers, products, orders, or run direct actions
            </span>
          </span>
          <span className="flex items-center gap-2 text-[11px] text-mitti shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-banarasi" />
            <span className="hidden sm:inline">COMMAND PALETTE</span>
            <span className="px-2 py-1 rounded border border-mitti/20 bg-ivory font-mono">Ctrl K</span>
          </span>
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-[0.18em] text-mitti uppercase">Popular starts</span>
          {QUICK_SCOPE_ITEMS.map((scope) => (
            <button
              key={scope.label}
              type="button"
              onClick={() => openPalette(scope.query)}
              className="px-3 py-2 rounded-full bg-white border border-mitti/15 text-[11px] text-kohl hover:border-madder/30 transition-colors"
              title={scope.hint}
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-kohl/35 backdrop-blur-[1px] px-4 py-8 sm:px-8">
          <div className="max-w-3xl mx-auto bg-ivory border border-mitti/15 shadow-2xl rounded-2xl overflow-hidden">
            <div className="border-b border-mitti/15 px-5 py-4 bg-white">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-madder" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setCursor((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setCursor((value) => Math.max(value - 1, 0));
                    }
                    if (e.key === 'Enter' && active) {
                      e.preventDefault();
                      runResult(active);
                    }
                  }}
                  placeholder="Try settings, SEO metadata, seller payouts, products, refresh page..."
                  className="w-full bg-transparent outline-none text-kohl placeholder:text-mitti text-sm"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs tracking-wider text-mitti hover:text-madder"
                >
                  ESC
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-3 bg-ivory">
              {results.length ? (
                <div className="space-y-2">
                  {results.map((item, index) => {
                    const isActive = index === cursor;

                    return (
                      <button
                        key={item.kind === 'action' ? item.id : item.href}
                        type="button"
                        onClick={() => runResult(item)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                          isActive
                            ? 'border-madder bg-madder/10'
                            : 'border-transparent bg-white hover:border-mitti/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="label text-madder">{item.group}</p>
                              {item.kind === 'action' ? (
                                <span className="px-2 py-1 rounded-full bg-banarasi/10 text-[10px] font-semibold tracking-[0.18em] text-banarasi">
                                  DIRECT ACTION
                                </span>
                              ) : null}
                              {'shortcutLabel' in item && item.shortcutLabel ? (
                                <span className="px-2 py-1 rounded-full bg-ivory border border-mitti/20 text-[10px] font-semibold tracking-[0.14em] text-kohl">
                                  {item.shortcutLabel}
                                </span>
                              ) : null}
                            </div>

                            <p className="text-sm text-kohl mt-2 font-medium">{item.label}</p>
                            <p className="text-xs text-mitti mt-1 leading-5">{item.desc}</p>

                            {'href' in item && item.href ? (
                              <p className="text-[11px] text-mitti/80 mt-2 font-mono">{item.href}</p>
                            ) : null}

                            {item.aliases?.length ? (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {item.aliases.slice(0, 3).map((alias) => (
                                  <span
                                    key={`${item.kind}-${item.label}-${alias}`}
                                    className="px-2 py-1 rounded-full bg-ivory border border-mitti/20 text-[10px] text-mitti"
                                  >
                                    {alias}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <ArrowRight className="w-4 h-4 text-mitti mt-1 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-mitti/15 p-6">
                  <p className="label text-madder">NO MATCHES</p>
                  <p className="text-sm text-mitti mt-3 leading-6">
                    Try broader natural phrases like settings, SEO metadata, seller payouts, products, inventory, orders, or refresh page.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-mitti/15 px-5 py-3 bg-white flex flex-wrap items-center gap-4 text-[11px] text-mitti">
              <span className="flex items-center gap-1">
                <Command className="w-3.5 h-3.5" />
                Ctrl/Cmd + K
              </span>
              <span>Ã¢â€ â€˜ Ã¢â€ â€œ to move</span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3.5 h-3.5" />
                Enter to open
              </span>
              <span>Esc to close</span>
              <Link href="/admin/settings" className="ml-auto text-madder hover:underline">
                OPEN SETTINGS
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}