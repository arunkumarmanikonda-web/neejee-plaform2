'use client';
import { useEffect, useState } from 'react';
import { paiseToRupees, rupeesToPaise, formatINR } from '@/lib/money';

interface Props {
  label: string;
  /** Value in paise (DB unit). */
  valuePaise: number | null | undefined;
  /** Returns updated value in paise. */
  onChangePaise: (paise: number | null) => void;
  required?: boolean;
  optional?: boolean;
  helpText?: string;
  /** If true, empty input means null (for optional sale prices). */
  allowNull?: boolean;
}

export function PriceInput({ label, valuePaise, onChangePaise, required, optional, helpText, allowNull }: Props) {
  // Internal state in rupees as string so user can type freely (e.g. "8500" or "8500.50")
  const [text, setText] = useState<string>('');

  useEffect(() => {
    if (valuePaise == null || valuePaise === 0) {
      setText(allowNull ? '' : '0');
    } else {
      const rupees = paiseToRupees(valuePaise);
      // Drop trailing .00
      setText(rupees % 1 === 0 ? String(rupees) : rupees.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePaise]);

  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      onChangePaise(allowNull ? null : 0);
      return;
    }
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0) {
      onChangePaise(0);
      return;
    }
    onChangePaise(rupeesToPaise(n));
  };

  const previewPaise = valuePaise ?? 0;

  return (
    <div className="mb-3">
      <label className="label text-mitti block mb-1">
        {label} {required && <span className="text-madder">*</span>}
        {optional && <span className="text-mitti/60 font-ui normal-case ml-1">(optional)</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mitti font-ui text-sm pointer-events-none">₹</span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={e => commit(e.target.value)}
          onBlur={e => commit(e.target.value)}
          placeholder="0"
          required={required}
          className="w-full pl-7 pr-3 py-2 bg-ivory border border-mitti/20 font-ui text-sm focus:outline-none focus:border-madder"
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        {helpText && <p className="font-ui text-[11px] text-mitti">{helpText}</p>}
        <p className="font-ui text-[11px] text-mitti ml-auto">Display: <span className="text-kohl">{formatINR(previewPaise)}</span></p>
      </div>
    </div>
  );
}
