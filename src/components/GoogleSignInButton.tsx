"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setAccessToken, setAuthUser } from "@/lib/auth";

type GoogleMode = "user" | "admin";

type GoogleCredentialResponse = { credential?: string };

type GoogleApi = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; auto_select?: boolean; callback: (response: GoogleCredentialResponse) => void }) => void;
      renderButton: (element: HTMLElement, options: { type: "standard"; theme: "outline"; size: "large"; text: "continue_with"; shape: "rectangular"; width: number }) => void;
      cancel: () => void;
      disableAutoSelect: () => void;
    };
  };
};

declare global {
  interface Window { google?: GoogleApi }
}

export default function GoogleSignInButton({ mode = "user" }: { mode?: GoogleMode }) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/google/config")
      .then((response) => response.json())
      .then((data: { clientId?: string }) => { if (active) { setClientId(data.clientId || ""); setConfigLoaded(true); if (!data.clientId) setConfigError("Google sign-in is not configured on this server."); } })
      .catch(() => { if (active) { setConfigLoaded(true); setConfigError("Google sign-in is unavailable right now."); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    const initialize = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async ({ credential }) => {
          if (!credential) return;
          setLoading(true);
          setError("");
          try {
            const response = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential, mode }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "Google sign-in failed.");
            setAccessToken(data.accessToken);
            setAuthUser({ id: data.user.id, email: data.user.email, name: data.user.name, avatarUrl: data.user.avatarUrl || "", signedInAt: Date.now() });
            router.replace(mode === "admin" ? "/admin" : "/dashboard/generator");
            router.refresh();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Google sign-in failed.");
          } finally {
            setLoading(false);
          }
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: Math.min(360, buttonRef.current.clientWidth || 360) });
    };

    if (window.google) initialize();
    else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", initialize, { once: true });
        existingScript.addEventListener("error", () => setConfigError("Google sign-in is unavailable right now."), { once: true });
        return () => existingScript.removeEventListener("load", initialize);
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = "true";
      script.onload = initialize;
      script.onerror = () => setConfigError("Google sign-in is unavailable right now.");
      document.head.appendChild(script);
    }
  }, [clientId, mode, router]);

  if (configLoaded && configError) {
    return <div className="space-y-2"><p className="text-center text-xs font-semibold text-red-500">{configError}</p></div>;
  }

  return (
    <div className="space-y-2">
      <div className="relative h-11 w-full overflow-hidden rounded-xl">
        <button
          type="button"
          disabled={loading}
          className="absolute inset-0 z-0 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.035] px-4 text-sm font-semibold text-foreground shadow-[0_8px_24px_rgba(7,27,23,0.07)] transition-all hover:border-primary/35 hover:bg-primary/[0.06] hover:shadow-[0_10px_28px_rgba(22,199,132,0.12)] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />}
          Continue with Google
        </button>
        <div ref={buttonRef} className="absolute inset-0 z-10 min-h-11 opacity-0" />
      </div>
      {error && <p className="text-center text-xs font-semibold text-red-500">{error}</p>}
    </div>
  );
}
