"use client";

export default function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  ariaLabel?: string;
  // true면 탭해도 onChange가 호출되지 않고(버튼 자체가 disabled), 시각적으로도 흐릿하게 보인다.
  // 프리미엄 전용 기능을 무료 회원에게 "꺼져있고 탭할 수 없는" 상태로 보여줄 때 쓴다.
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-40"
      style={{
        width: 42,
        height: 24,
        background: checked ? "var(--accent)" : "var(--border-strong)",
        cursor: disabled ? "default" : "pointer",
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
