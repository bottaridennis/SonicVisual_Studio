import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Section

export const Section: React.FC<{
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = true, right, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-2 px-4 h-10">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-fg transition-colors"
          aria-expanded={open}
        >
          {icon && <span className="text-faint">{icon}</span>}
          <span>{title}</span>
          <ChevronDown className={cx('w-3.5 h-3.5 ml-auto transition-transform', !open && '-rotate-90')} />
        </button>
        {right}
      </div>
      {open && <div className="px-4 pb-4 space-y-3.5">{children}</div>}
    </section>
  );
};

// ---------------------------------------------------------------- Field label

export const FieldLabel: React.FC<{ label: string; value?: React.ReactNode; htmlFor?: string }> = ({ label, value, htmlFor }) => (
  <div className="flex items-baseline justify-between gap-2 mb-1.5">
    <label htmlFor={htmlFor} className="text-xs text-dim">
      {label}
    </label>
    {value !== undefined && <span className="text-[11px] font-mono text-fg/80 tabular-nums">{value}</span>}
  </div>
);

// ---------------------------------------------------------------- Slider

export const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, format, disabled }) => {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cx(disabled && 'opacity-40 pointer-events-none')}>
      <FieldLabel label={label} value={format ? format(value) : value} htmlFor={id} />
      <input
        id={id}
        type="range"
        className="sv-range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, pct))}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={(e) => e.currentTarget.blur()}
      />
    </div>
  );
};

// ---------------------------------------------------------------- Toggle

export const Toggle: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full flex items-center gap-3 text-left group"
  >
    <span className="flex-1 min-w-0">
      <span className="block text-xs text-fg/90">{label}</span>
      {hint && <span className="block text-[11px] text-faint leading-snug mt-0.5">{hint}</span>}
    </span>
    <span
      className={cx(
        'relative w-8 h-[18px] rounded-full transition-colors shrink-0',
        checked ? 'bg-acid' : 'bg-line-strong group-hover:bg-faint'
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] w-3 h-3 rounded-full transition-all',
          checked ? 'left-[17px] bg-bg' : 'left-[3px] bg-dim'
        )}
      />
    </span>
  </button>
);

// ---------------------------------------------------------------- Segmented

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  size = 'md',
}: {
  label?: string;
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div>
      {label && <FieldLabel label={label} />}
      <div className="flex p-0.5 rounded-lg bg-bg border border-line gap-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 min-w-0 rounded-md font-medium transition-colors flex items-center justify-center gap-1 truncate',
              size === 'sm' ? 'h-6 text-[11px] px-1.5' : 'h-7 text-xs px-2',
              value === o.value ? 'bg-raised text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-faint hover:text-dim'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Select

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} htmlFor={id} />
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none h-8 pl-2.5 pr-8 rounded-lg bg-bg border border-line hover:border-line-strong text-xs text-fg focus:outline-none focus:border-acid/60"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-panel">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Color

const QUICK_COLORS = ['#ffffff', '#fde047', '#f97316', '#f43f5e', '#ec4899', '#a855f7', '#6366f1', '#38bdf8', '#22d3ee', '#4ade80', '#c6ff3a', '#000000'];

export const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div>
      <FieldLabel label={label} />
      <div className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg bg-bg border border-line hover:border-line-strong focus-within:border-acid/60">
        <span className="relative w-6 h-6 rounded-md overflow-hidden shrink-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ background: value }}>
          <input
            type="color"
            aria-label={label}
            value={isHex ? value : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </span>
        <input
          type="text"
          spellCheck={false}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              const v = draft.trim();
              if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^rgba?\(/i.test(v)) onChange(v);
              setDraft(null);
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="flex-1 min-w-0 bg-transparent text-xs font-mono uppercase text-fg focus:outline-none"
        />
      </div>
      <div className="flex gap-1 mt-1.5">
        {QUICK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Usa colore ${c}`}
            onClick={() => onChange(c)}
            className={cx(
              'flex-1 h-3 rounded-[3px] transition-transform hover:scale-y-150',
              value.toLowerCase() === c && 'ring-1 ring-fg ring-offset-1 ring-offset-panel'
            )}
            style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Buttons

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string; size?: 'sm' | 'md' }
> = ({ active, label, size = 'md', className, children, ...rest }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={cx(
      'inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-30',
      size === 'sm' ? 'w-7 h-7' : 'w-8 h-8',
      active ? 'bg-raised text-acid shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-dim hover:text-fg hover:bg-hover',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger'; size?: 'sm' | 'md' | 'lg' }
> = ({ variant = 'outline', size = 'md', className, children, ...rest }) => (
  <button
    type="button"
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all disabled:opacity-40 whitespace-nowrap',
      size === 'sm' && 'h-7 px-2.5 text-xs',
      size === 'md' && 'h-8 px-3 text-xs',
      size === 'lg' && 'h-11 px-5 text-sm',
      variant === 'primary' && 'bg-acid text-bg hover:bg-[#d6ff6b] active:scale-[0.98] font-semibold',
      variant === 'outline' && 'border border-line-strong text-fg hover:bg-hover',
      variant === 'ghost' && 'text-dim hover:text-fg hover:bg-hover',
      variant === 'danger' && 'border border-danger/40 text-danger hover:bg-danger/10',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export const Grid2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 gap-3">{children}</div>
);
