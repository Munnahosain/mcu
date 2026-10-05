"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import FeaturePageGate from "@/components/dashboard/FeaturePageGate";

const PatternMakerApp = dynamic(
  () => import("@/components/pattern-maker/PatternMakerApp"),
  { ssr: false }
);

export default function PersistentPatternMakerTab({ active }: { active: boolean }) {
  const [hasOpened, setHasOpened] = useState(active);

  if (active && !hasOpened) setHasOpened(true);

  return (
    <div
      hidden={!active}
      inert={!active}
      aria-hidden={!active}
      className="pattern-maker-route h-[calc(100dvh-7rem)] min-h-0 w-full overflow-hidden bg-background text-foreground"
    >
      {hasOpened ? (
        <FeaturePageGate active={active} feature="Pattern Maker" keys={["pattern_maker", "pattern_generation"]}>
          <PatternMakerApp />
        </FeaturePageGate>
      ) : null}
    </div>
  );
}
