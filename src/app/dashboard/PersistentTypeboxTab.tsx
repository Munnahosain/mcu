"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import FeaturePageGate from "@/components/dashboard/FeaturePageGate";

const TypeboxStudio = dynamic(
  () => import("@/components/dashboard/TypeboxStudio"),
  { ssr: false }
);

export default function PersistentTypeboxTab({ active }: { active: boolean }) {
  const [hasOpened, setHasOpened] = useState(active);

  if (active && !hasOpened) setHasOpened(true);

  return (
    <div hidden={!active} inert={!active} aria-hidden={!active} className="min-h-full w-full">
      {hasOpened ? (
        <FeaturePageGate active={active} feature="Typebox" keys={["typebox_generation"]}>
          <TypeboxStudio />
        </FeaturePageGate>
      ) : null}
    </div>
  );
}
