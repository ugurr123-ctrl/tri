interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: ToggleProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumbSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const translate =
    size === 'sm'
      ? checked
        ? 'translate-x-[18px]'
        : 'translate-x-[3px]'
      : checked
        ? 'translate-x-[22px]'
        : 'translate-x-[4px]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${trackSize} ${
        checked
          ? 'bg-[#6255E7]'
          : 'bg-slate-300 dark:bg-[#2E364D]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block rounded-full bg-white shadow-xs transition-transform duration-150 ${thumbSize} ${translate}`}
      />
    </button>
  );
}
