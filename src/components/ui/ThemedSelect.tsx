"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

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
  portalMenu?: boolean;
};

export default function ThemedSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  portalMenu = false,
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const selected = options.find((option) => option.value === value) || options[0];

  const updateMenuPosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 220 && rect.top > spaceBelow;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(240, openAbove ? rect.top - 12 : spaceBelow - 12)),
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      zIndex: 10000,
    });
  };

  const focusOption = (index: number) => {
    window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    if (!open) {
      if (portalMenu) updateMenuPosition();
      setOpen(true);
    }
    focusOption(selectedIndex);
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(options.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    } else {
      return;
    }
    event.preventDefault();
    focusOption(nextIndex);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
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

  useEffect(() => {
    if (!open || !portalMenu) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, portalMenu]);

  const menu = open ? (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={ariaLabel}
      style={portalMenu ? menuStyle : undefined}
      className={`z-50 max-h-60 w-full overflow-y-auto rounded-xl border border-primary/20 bg-[var(--card-bg)] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.2)] ${portalMenu ? "fixed" : "absolute left-0 top-[calc(100%+0.35rem)]"}`}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            type="button"
            role="option"
            aria-selected={isSelected}
            key={option.value}
            ref={(node) => { optionRefs.current[index] = node; }}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
              buttonRef.current?.focus();
            }}
            className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${isSelected ? "bg-primary text-[#06251b]" : "text-foreground/80 hover:bg-primary/10 hover:text-primary"}`}
          >
            <span className="truncate">{option.label}</span>
            {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        ref={buttonRef}
        onClick={() => {
          if (!open && portalMenu) updateMenuPosition();
          setOpen((current) => !current);
        }}
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-left text-xs font-semibold text-foreground outline-none transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="truncate">{selected?.label || "Select an option"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/60 transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
      </button>
      {portalMenu && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
