'use client';

import { useEffect } from 'react';

function updateRangeProgress(input: HTMLInputElement) {
  const minValue = Number(input.min);
  const maxValue = Number(input.max);
  const min = input.min !== '' && Number.isFinite(minValue) ? minValue : 0;
  const max = input.max !== '' && Number.isFinite(maxValue) ? maxValue : 100;
  const value = input.valueAsNumber;
  const progress = Number.isFinite(value) && max > min
    ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
    : 0;
  input.style.setProperty('--range-progress', `${progress}%`);
}

export function GlobalControlBehavior() {
  useEffect(() => {
    let refreshFrame = 0;

    const refreshRanges = () => {
      refreshFrame = 0;
      document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(updateRangeProgress);
    };

    const scheduleRefresh = () => {
      if (!refreshFrame) refreshFrame = requestAnimationFrame(refreshRanges);
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'range') {
        updateRangeProgress(target);
      }
      scheduleRefresh();
    };

    const handleWheel = (event: WheelEvent) => {
      const input = event.target;
      if (
        !(input instanceof HTMLInputElement) ||
        input.type !== 'number' ||
        document.activeElement !== input ||
        input.disabled ||
        input.readOnly ||
        event.deltaY === 0
      ) {
        return;
      }

      const step = input.step && input.step !== 'any' ? Number(input.step) : 1;
      if (!Number.isFinite(step) || step <= 0) return;

      const current = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : 0;
      const direction = event.deltaY < 0 ? 1 : -1;
      const minValue = Number(input.min);
      const maxValue = Number(input.max);
      const min = input.min === '' || !Number.isFinite(minValue) ? -Infinity : minValue;
      const max = input.max === '' || !Number.isFinite(maxValue) ? Infinity : maxValue;
      const precision = input.step.includes('.') ? input.step.split('.')[1].length : 0;
      const next = Math.max(min, Math.min(max, Number((current + direction * step).toFixed(precision))));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      event.preventDefault();
      setter?.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('click', scheduleRefresh, true);
    document.addEventListener('pointerup', scheduleRefresh, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    refreshRanges();

    return () => {
      observer.disconnect();
      if (refreshFrame) cancelAnimationFrame(refreshFrame);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
      document.removeEventListener('click', scheduleRefresh, true);
      document.removeEventListener('pointerup', scheduleRefresh, true);
      document.removeEventListener('wheel', handleWheel, true);
    };
  }, []);

  return (
    <style>{`
      input[type="number"] {
        appearance: textfield !important;
        -webkit-appearance: textfield !important;
        -moz-appearance: textfield !important;
        min-width: 0;
        color: var(--foreground) !important;
        font-variant-numeric: tabular-nums;
        -webkit-text-fill-color: currentColor;
      }
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button {
        display: none !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        width: 0 !important;
        margin: 0 !important;
      }
    `}</style>
  );
}