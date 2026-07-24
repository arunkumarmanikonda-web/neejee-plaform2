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
import { ADMIN_COMMAND_ITEMS } from '@/lib/admin/admin-command-catalog';
import { recordAdminCommandUsage } from '@/lib/admin/admin-command-usage';

export default function AdminCommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

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
    if (!open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    return ADMIN_COMMAND_ITEMS
      .filter((item) => item.href !== pathname)
      .map((item) => {
        const haystack = [item.label, item.group, item.desc, item.href, ...item.keywords]
          .join(' ')
          .toLowerCase();

        let score = 0;
        if (!q) {
          score = 1;
        } else {
          if (item.label.toLowerCase().includes(q)) score += 8;
          if (item.group.toLowerCase().includes(q)) score += 4;
          if (item.href.toLowerCase().includes(q)) score += 3;
          if (item.desc.toLowerCase().includes(q)) score += 2;
          if (item.keywords.some((keyword) => keyword.toLowerCase().includes(q))) score += 5;
          if (haystack.includes(q)) score += 1;
        }

        return { ...item, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 12);
  }, [pathname, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const active = results[cursor];

  const go = (href: string) => {
    recordAdminCommandUsage(href);
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-2 px-2 pb-6 bg-gradient-to-b from-ivory via-ivory to-transparent">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-white border border-mitti/15 rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-sm hover:border-madder/30 transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Search className="w-4 h-4 text-madder shrink-0" />
            <span className="text-sm text-kohl text-left truncate">
              Search admin pages, settings, reports, sellers, products, and actions
            </span>
          </span>
          <span className="flex items-center gap-2 text-[11px] text-mitti shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-banarasi" />
            <span className="hidden sm:inline">COMMAND PALETTE</span>
            <span className="px-2 py-1 rounded border border-mitti/20 bg-ivory font-mono">Ctrl K</span>
          </span>
        </button>
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
                      go(active.href);
                    }
                  }}
                  placeholder="Search pages, settings, reports, users, sellers, products..."
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
                        key={item.href}
                        type="button"
                        onClick={() => go(item.href)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                          isActive
                            ? 'border-madder bg-madder/10'
                            : 'border-transparent bg-white hover:border-mitti/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="label text-madder">{item.group}</p>
                            <p className="text-sm text-kohl mt-2 font-medium">{item.label}</p>
                            <p className="text-xs text-mitti mt-1 leading-5">{item.desc}</p>
                            <p className="text-[11px] text-mitti/80 mt-2 font-mono">{item.href}</p>
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
                    Try broader keywords like products, settings, sellers, analytics, inventory, or sms.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-mitti/15 px-5 py-3 bg-white flex flex-wrap items-center gap-4 text-[11px] text-mitti">
              <span className="flex items-center gap-1"><Command className="w-3.5 h-3.5" /> Ctrl/Cmd + K</span>
              <span>↑ ↓ to move</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3.5 h-3.5" /> Enter to open</span>
              <span>Esc to close</span>
              <Link href="/admin/settings" className="ml-auto text-madder hover:underline">
                OPEN SETTINGS →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}