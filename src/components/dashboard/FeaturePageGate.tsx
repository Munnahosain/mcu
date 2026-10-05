"use client";

import { useEffect, useState } from "react";
import { ensureAccessToken } from "@/lib/auth";
import FeatureDisabledNotice from "@/components/dashboard/FeatureDisabledNotice";

type AccessState = {
  key: string;
  activation: number;
  status: "allowed" | "disabled";
  error?: string;
};

export default function FeaturePageGate({
  active = true,
  activation = 0,
  feature,
  keys,
  children,
}: {
  active?: boolean;
  activation?: number;
  feature: string;
  keys: string[];
  children: React.ReactNode;
}) {
  const gateKey = keys.join(",");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [timedOutActivation, setTimedOutActivation] = useState<number | null>(null);
  const currentAccess = active && access?.key === gateKey && access.activation === activation ? access : null;
  const timedOut = active && timedOutActivation === activation;

  useEffect(() => {
    const invalidateAccess = () => {
      setAccess(null);
      setRetryCount((count) => count + 1);
    };
    window.addEventListener("mcustock-auth-changed", invalidateAccess);
    window.addEventListener("storage", invalidateAccess);
    return () => {
      window.removeEventListener("mcustock-auth-changed", invalidateAccess);
      window.removeEventListener("storage", invalidateAccess);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    void (async () => {
      try {
        const token = await ensureAccessToken();
        const response = await fetch(`/api/feature-flags?key=${encodeURIComponent(gateKey)}`, {
          credentials: "include",
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const payload = await response.json() as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          if (!cancelled) {
            setAccess({
              key: gateKey,
              activation,
              status: "disabled",
              error: payload.error || `Unable to check ${feature.toLowerCase()} availability (HTTP ${response.status}).`,
            });
          }
          return;
        }
        if (!cancelled) setAccess({ key: gateKey, activation, status: "allowed" });
      } catch (error) {
        if (!cancelled) {
          setAccess({
            key: gateKey,
            activation,
            status: "disabled",
            error: error instanceof Error ? error.message : `Unable to check ${feature.toLowerCase()} availability.`,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, activation, feature, gateKey, retryCount]);

  useEffect(() => {
    if (!active) return;
    if (currentAccess) return;
    const timeoutId = setTimeout(() => setTimedOutActivation(activation), 10000);
    return () => clearTimeout(timeoutId);
  }, [active, activation, currentAccess, retryCount]);

  if (!active) return children;
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
                setTimedOutActivation(null);
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
