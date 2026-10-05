"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import FeaturePageGate from "@/components/dashboard/FeaturePageGate";

const BentoBuilder = dynamic(
  () => import("@/components/dashboard/BentoBuilder"),
  { ssr: false }
);

export default function PersistentBentoTab({ active }: { active: boolean }) {
  const [hasOpened, setHasOpened] = useState(active);

  if (active && !hasOpened) setHasOpened(true);

  return (
    <div hidden={!active} inert={!active} aria-hidden={!active} className="h-full min-h-0 w-full">
      {hasOpened ? (
        <FeaturePageGate active={active} feature="Bento Studio" keys={["bento_generation"]}>
          <BentoBuilder />
        </FeaturePageGate>
      ) : null}
    </div>
  );
}
