"use client";

import React from "react";

export interface ToggleOption<T extends string | number> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  ariaLabel?: string;
}

export interface SegmentedToggleProps<T extends string | number> {
  options: Array<ToggleOption<T> | T>;
  value: T;
  onChange: (value: T, index: number) => void;
  className?: string;
  optionClassName?: string;
  thumbClassName?: string;
  size?: "sm" | "md" | "lg";
  /** Column count for wrapped grids. Defaults to a single row. */
  columns?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * GPU-accelerated sliding option switch.
 * The thumb only moves with transform: translate(col * 100%, row * 100%).
 */
export function SegmentedToggle<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
  optionClassName = "",
  thumbClassName = "",
  size = "md",
  columns,
  disabled = false,
  ariaLabel,
}: SegmentedToggleProps<T>) {
  const normalizedOptions: ToggleOption<T>[] = options.map((opt) =>
    typeof opt === "object" && opt !== null && "id" in opt
      ? (opt as ToggleOption<T>)
      : { id: opt as T, label: String(opt) }
  );

  const activeIndex = normalizedOptions.findIndex((opt) => opt.id === value);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;
  const optionCount = normalizedOptions.length;
  const cols = Math.max(1, columns ?? optionCount);
  const rows = Math.max(1, Math.ceil(optionCount / cols));
  const col = safeIndex % cols;
  const row = Math.floor(safeIndex / cols);
  const isGrid = rows > 1;

  const sizeStyles = {
    sm: "!py-1.5 !px-2 !text-[11px]",
    md: "!py-2 !px-3 !text-xs",
    lg: "!py-2.5 !px-4 !text-sm",
  }[size];

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = Math.min(optionCount - 1, index + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (e.key === "ArrowDown") next = Math.min(optionCount - 1, index + cols);
    else if (e.key === "ArrowUp") next = Math.max(0, index - cols);
    else return;
    e.preventDefault();
    onChange(normalizedOptions[next].id, next);
  };

  return (
    <div
      className={`toggle ${isGrid ? "toggle-grid" : ""} ${className}`}
      style={
        {
          "--options": optionCount,
          "--cols": cols,
          "--rows": rows,
        } as React.CSSProperties
      }
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        className={`toggle-thumb ${thumbClassName}`}
        style={{
          transform: `translate(${col * 100}%, ${row * 100}%)`,
        }}
        aria-hidden="true"
      />

      {normalizedOptions.map((option, index) => {
        const isActive = option.id === value;
        return (
          <button
            key={String(option.id)}
            type="button"
            role="tab"
            data-target={String(option.id)}
            aria-selected={isActive}
            aria-label={
              option.ariaLabel ||
              (typeof option.label === "string" ? option.label : undefined)
            }
            tabIndex={isActive ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.id, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`toggle-option ${sizeStyles} ${
              isActive ? "active" : ""
            } ${optionClassName}`}
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
            {option.badge && <span className="shrink-0">{option.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedToggle;
