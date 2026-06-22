import { Check } from 'lucide-react';

type Step = 'contact' | 'address' | 'payment';

export function CheckoutSteps({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'contact', label: 'CONTACT' },
    { id: 'address', label: 'ADDRESS' },
    { id: 'payment', label: 'PAYMENT' },
  ];
  const currentIdx = steps.findIndex(s => s.id === current);

  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      {steps.map((s, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-ui ${
                  isComplete ? 'bg-madder text-ivory' :
                  isCurrent  ? 'bg-kohl text-ivory' :
                               'bg-beige text-mitti'
                }`}
              >
                {isComplete ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`font-ui text-xs tracking-widest ${isCurrent ? 'text-madder font-medium' : 'text-mitti'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-mitti/30" />}
          </div>
        );
      })}
    </div>
  );
}
