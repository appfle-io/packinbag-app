"use client";

export default function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="relative inline-flex shrink-0 items-center rounded-full transition-colors"
      style={{
        width: 42,
        height: 24,
        background: checked ? "var(--accent)" : "var(--border-strong)",
      }}
    >
      <span
        className="inline-block rounded-full bg-white shadow transition-transform"
        style={{
          width: 18,
          height: 18,
          transform: checked ? "translateX(21px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}
