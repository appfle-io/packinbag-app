"use client";

export default function PercentSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 5,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-text-secondary">{label}</span>
        <span className="text-[11px] text-text-secondary font-medium">{Math.round(value)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pib-slider w-full"
        aria-label={label}
      />
    </div>
  );
}
