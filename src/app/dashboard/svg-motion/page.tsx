'use client';

import React from 'react';
import SvgMotionStudio from '@/components/SvgMotionStudio/SvgMotionStudio';

export default function DashboardSvgMotionPage() {
  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--card-bg)] transition-colors">
      <SvgMotionStudio />
    </div>
  );
}
