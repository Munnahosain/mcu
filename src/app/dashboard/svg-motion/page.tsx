'use client';

import React from 'react';
import SvgMotionStudio from '@/components/SvgMotionStudio/SvgMotionStudio';

export default function DashboardSvgMotionPage() {
  return (
    <div className="w-full flex-1 flex flex-col min-h-0 border-t border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden transition-colors">
      <SvgMotionStudio />
    </div>
  );
}
