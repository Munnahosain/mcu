"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type ThemedSelectOption = {
  value: string;
  label: string;
};

type ThemedSelectProps = {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

export default function ThemedSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-left text-xs font-semibold text-foreground outline-none transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="truncate">{selected?.label || "Select an option"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/60 transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
      </button>
      {open ? (
        <div role="listbox" aria-label={ariaLabel} className="absolute left-0 top-[calc(100%+0.35rem)] z-50 max-h-60 w-full overflow-y-auto rounded-xl border border-primary/20 bg-[var(--card-bg)] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${isSelected ? "bg-primary text-[#06251b]" : "text-foreground/80 hover:bg-primary/10 hover:text-primary"}`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
