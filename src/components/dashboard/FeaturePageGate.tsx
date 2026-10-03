"use client";

import { useEffect, useState } from "react";
import { ensureAccessToken } from "@/lib/auth";
import FeatureDisabledNotice from "@/components/dashboard/FeatureDisabledNotice";

type AccessState = {
  key: string;
  status: "allowed" | "disabled";
  error?: string;
};

export default function FeaturePageGate({
  feature,
  keys,
  children,
}: {
  feature: string;
  keys: string[];
  children: React.ReactNode;
}) {
  const gateKey = keys.join(",");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [timedOutKey, setTimedOutKey] = useState<string | null>(null);
  const currentAccess = access?.key === gateKey ? access : null;
  const timedOut = timedOutKey === gateKey;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const token = await ensureAccessToken();
        const response = await fetch(`/api/feature-flags?key=${encodeURIComponent(gateKey)}`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = await response.json() as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          if (!cancelled) {
            setAccess({
              key: gateKey,
              status: "disabled",
              error: payload.error || `Unable to check ${feature.toLowerCase()} availability (HTTP ${response.status}).`,
            });
          }
          return;
        }
        if (!cancelled) setAccess({ key: gateKey, status: "allowed" });
      } catch (error) {
        if (!cancelled) {
          setAccess({
            key: gateKey,
            status: "disabled",
            error: error instanceof Error ? error.message : `Unable to check ${feature.toLowerCase()} availability.`,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [feature, gateKey, retryCount]);

  useEffect(() => {
    if (currentAccess) return;
    const timeoutId = setTimeout(() => setTimedOutKey(gateKey), 10000);
    return () => clearTimeout(timeoutId);
  }, [currentAccess, gateKey, retryCount]);

  if (currentAccess?.status === "disabled" || timedOut) {
    return (
      <FeatureDisabledNotice
        feature={feature}
        message={
          currentAccess?.status === "disabled"
            ? currentAccess.error
            : "Unable to check feature availability right now. Please try again."
        }
        onRetry={
          timedOut || currentAccess?.error?.includes("Unable to check")
            ? () => {
                setAccess(null);
                setTimedOutKey(null);
                setRetryCount((count) => count + 1);
              }
            : undefined
        }
      />
    );
  }

  if (currentAccess?.status === "allowed") return children;

  return (
    <div inert aria-busy="true">
      {children}
    </div>
  );
}
