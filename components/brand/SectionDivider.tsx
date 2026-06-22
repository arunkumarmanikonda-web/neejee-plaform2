// Decorative section divider used in checkout, cart, between major sections.
// Two thin lines with a centered ornamental motif (mimics the brand's hand-pressed feel).

export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-px bg-mitti/20" />
      <svg width="24" height="8" viewBox="0 0 24 8" className="text-madder">
        <circle cx="4" cy="4" r="1.5" fill="currentColor" />
        <circle cx="12" cy="4" r="2.5" fill="currentColor" />
        <circle cx="20" cy="4" r="1.5" fill="currentColor" />
      </svg>
      <div className="flex-1 h-px bg-mitti/20" />
    </div>
  );
}
