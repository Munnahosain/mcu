"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import FeaturePageGate from "@/components/dashboard/FeaturePageGate";

const TradingStudio = dynamic(
  () => import("@/components/dashboard/TradingStudio"),
  { ssr: false }
);

export default function PersistentTradingTab({ active }: { active: boolean }) {
  const [hasOpened, setHasOpened] = useState(active);

  if (active && !hasOpened) setHasOpened(true);

  return (
    <div hidden={!active} inert={!active} aria-hidden={!active} className="min-h-full w-full">
      {hasOpened ? (
        <FeaturePageGate active={active} feature="Trading Studio" keys={["trading_generation"]}>
          <TradingStudio />
        </FeaturePageGate>
      ) : null}
    </div>
  );
}
