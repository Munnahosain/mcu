"use client";

type PremiumSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  className?: string;
};

export default function PremiumSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  className = "",
}: PremiumSliderProps) {
  const progress = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div
      className={`premium-slider ${className}`}
      style={{ "--slider-progress": progress, "--range-progress": progress } as React.CSSProperties}
    >
      <div className="premium-slider-heading">
        <span>{label}</span>
        <output>{value}{suffix}</output>
      </div>
      <div className="premium-slider-track">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          className="liquid-slider"
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
