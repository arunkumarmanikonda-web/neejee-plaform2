'use client';
// v23.40.21 — AI product name generator
// Proposes 7 names across 7 angles (Heritage, Royal, Sensory, Craft-tech,
// Poetic, SEO-search, Trend) with per-name SEO score and rationale.
// Designed to be the PRIMARY way an admin names a product.

import { useState } from 'react';
import { Sparkles, Loader2, X, Search, Crown, Feather, Hand, Award, TrendingUp, Landmark, RefreshCw } from 'lucide-react';

interface Props {
  brief: {
    name?: string;            // ← v26.1.2: the half-typed product name, anchors the AI
    description?: string;     // ← if user wrote anything, AI uses it
    craft?: string;
    region?: string;
    cluster?: string;
    material?: string;
    technique?: string;
    occasion?: string;
    categoryName?: string;
  };
  onApply: (name: string) => void;
  variant?: 'inline' | 'prominent'; // prominent = button on top of name field
}

type NameProposal = {
  name: string;
  rationale: string;
  seoScore?: number;
  angle?: 'HERITAGE' | 'ROYAL' | 'SENSORY' | 'CRAFT_TECH' | 'POETIC' | 'SEO_SEARCH' | 'TREND' | string;
};

const ANGLE_META: Record<string, { label: string; icon: any; color: string }> = {
  HERITAGE:   { label: 'Heritage',     icon: Landmark,   color: 'bg-mitti/15 text-mitti'  },
  ROYAL:      { label: 'Royal',        icon: Crown,      color: 'bg-haldi/20 text-mitti'  },
  SENSORY:    { label: 'Sensory',      icon: Feather,    color: 'bg-madder/10 text-madder'},
  CRAFT_TECH: { label: 'Craft tech',   icon: Hand,       color: 'bg-neem/15 text-neem'    },
  POETIC:     { label: 'Poetic',       icon: Sparkles,   color: 'bg-monsoon/10 text-monsoon'},
  SEO_SEARCH: { label: 'SEO-friendly', icon: Search,     color: 'bg-blue-50 text-blue-700' },
  TREND:      { label: 'On-trend',     icon: TrendingUp, color: 'bg-purple-50 text-purple-700' },
};

export default function AiNameSuggester({ brief, onApply, variant = 'inline' }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState<NameProposal[]>([]);
  const [error, setError] = useState('');

  // We now accept a typed product name as an anchor too — if the user has
  // written "Banarsi silk saree" we should suggest variants of *that*, not
  // unrelated crafts.
  const hasAnchor = !!(brief.name || brief.craft || brief.region || brief.categoryName);
  const missing: string[] = [];
  if (!brief.craft && !brief.name) missing.push('Craft (or a working product name)');
  if (!brief.region && !brief.name) missing.push('Region');
  if (!brief.categoryName) missing.push('Category');

  async function fetchNames() {
    if (!hasAnchor) {
      setError('Type a working product name (e.g. "Banarsi silk saree") OR fill Craft / Region / Category first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          field: 'nameSuggestions',
          // v26.1.2 — pass the user's typed name as the anchor. If empty, the
          // API falls back to its old prompt. If filled ("Banarsi silk saree"),
          // every suggestion must orbit that piece.
          name: brief.name || 'PRODUCT_NAME_SUGGESTION',
          workingName: brief.name || '',
          description: brief.description || '',
          craft: brief.craft,
          region: brief.region,
          artisanName: '',
          material: brief.material,
          technique: brief.technique,
          occasion: brief.occasion,
          categoryName: brief.categoryName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch names');
        return;
      }
      if (data.configured === false) {
        setError('OpenAI not configured. Add OPENAI_API_KEY in Vercel env vars.');
        return;
      }
      const list: NameProposal[] = data.json?.names || data.names || [];
      if (!Array.isArray(list) || list.length === 0) {
        setError('AI returned no name proposals. Try again — sometimes the first call misses.');
        return;
      }
      setNames(list);
    } catch (e: any) {
      setError(e?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setOpen(true);
    setNames([]);
    setError('');
    fetchNames();
  }

  const trigger = variant === 'prominent' ? (
    <button
      type="button"
      onClick={openModal}
      className="w-full mb-3 px-4 py-3 bg-gradient-to-r from-madder to-madder/80 hover:from-madder/90 hover:to-madder/70 text-ivory inline-flex items-center justify-center gap-2 text-sm tracking-wider uppercase transition-all group"
    >
      <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
      Let AI name this product
      <span className="text-[10px] opacity-75 normal-case tracking-normal">· SEO + trend + memorable</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={openModal}
      className="text-[10px] tracking-widest text-madder hover:text-kohl flex items-center gap-1.5"
    >
      <Sparkles className="w-3 h-3" />
      AI NAME SUGGESTIONS
    </button>
  );

  return (
    <>
      {trigger}

      {open && (
        <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-ivory border border-mitti/20 max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-5 border-b border-mitti/15 sticky top-0 bg-ivory">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-madder" />
                  <h2 className="font-display text-2xl text-kohl">AI Product Names</h2>
                </div>
                <p className="text-xs text-mitti">
                  7 names balanced across heritage, sensory, SEO-friendly, and on-trend angles.
                  {brief.craft && <> Rooted in <strong>{brief.craft}</strong></>}
                  {brief.region && <> from <strong>{brief.region}</strong></>}.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-mitti hover:text-madder">
                <X className="w-5 h-5" />
              </button>
            </div>

            {missing.length > 0 && names.length === 0 && !loading && (
              <div className="m-5 p-3 bg-haldi/15 border-l-4 border-haldi text-xs text-mitti">
                <strong>Tip:</strong> The AI will produce far better names if you fill in{' '}
                <strong>{missing.join(', ')}</strong> first. You can still proceed with what you have.
              </div>
            )}

            <div className="p-5 space-y-2">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-mitti">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating 7 name proposals across all angles…
                </div>
              )}
              {error && (
                <div className="bg-madder/10 border border-madder/30 p-3 text-xs text-madder flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={fetchNames} className="ml-2 px-2 py-1 bg-madder text-ivory inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}
              {!loading && !error && names.map((n, i) => {
                const meta = ANGLE_META[n.angle || ''] || ANGLE_META.SENSORY;
                const Icon = meta.icon;
                const seo = typeof n.seoScore === 'number' ? Math.max(0, Math.min(100, n.seoScore)) : null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onApply(n.name);
                      setOpen(false);
                    }}
                    className="block w-full text-left p-4 border border-mitti/15 hover:border-madder hover:bg-beige/40 transition group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-xl text-kohl group-hover:text-madder transition-colors">
                          {n.name}
                        </div>
                        <div className="text-xs text-mitti mt-1.5 leading-relaxed">{n.rationale}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 inline-flex items-center gap-1 ${meta.color}`}>
                          <Icon className="w-3 h-3" /> {meta.label}
                        </span>
                        {seo !== null && (
                          <span className="text-[10px] text-mitti">
                            SEO <strong className={seo >= 75 ? 'text-neem' : seo >= 50 ? 'text-haldi' : 'text-mitti'}>{seo}</strong>/100
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-mitti/15 p-3 flex justify-between items-center bg-beige/30 sticky bottom-0">
              <button
                type="button"
                onClick={fetchNames}
                disabled={loading}
                className="text-xs text-madder hover:text-kohl inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" /> Generate new set
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-mitti hover:text-kohl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
