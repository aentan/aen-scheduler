import React from 'react';

export function PillSwitch({
  checked,
  onClick,
  onChange,
  disabled,
}: {
  checked: boolean;
  onClick?: () => void;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = () => {
    onClick?.();
    onChange?.(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      // Knob is always paper-colored; only the track changes: 38.2% ink when
      // off, solid ink when on. Only the knob position animates — color
      // transitions leave frames where knob and track match and blink.
      className={`relative inline-flex h-5 w-8 flex-shrink-0 cursor-pointer p-0.5 disabled:opacity-30 ${
        checked ? 'bg-ink' : 'bg-ink-38'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 bg-paper transition-transform duration-150 ease-out ${
          checked ? 'translate-x-3' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
