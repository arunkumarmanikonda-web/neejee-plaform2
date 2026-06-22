'use client';

interface Props {
  label: string;
  value: string | null | undefined; // ISO string or null
  onChange: (iso: string | null) => void;
  helpText?: string;
}

/** Renders a datetime-local input. Stores as ISO string in parent state, null when cleared. */
export function DateTimeInput({ label, value, onChange, helpText }: Props) {
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const toLocalInput = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handle = (s: string) => {
    if (!s) { onChange(null); return; }
    const d = new Date(s);
    if (isNaN(d.getTime())) { onChange(null); return; }
    onChange(d.toISOString());
  };

  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">{label}</label>
      <input
        type="datetime-local"
        value={toLocalInput(value)}
        onChange={e => handle(e.target.value)}
        className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-sm focus:outline-none focus:border-madder"
      />
      {helpText && <p className="font-ui text-[11px] text-mitti mt-1">{helpText}</p>}
    </div>
  );
}
