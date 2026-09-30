"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
  const [isReady, setIsReady] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // 1. Fetch Google Client ID config
  useEffect(() => {
    let active = true;
    fetch("/api/auth/google/config")
      .then((response) => response.json())
      .then((data: { clientId?: string }) => {
        if (active) {
          setClientId(data.clientId || "");
          setConfigLoaded(true);
          if (!data.clientId) {
            setConfigError("Google sign-in is not configured on this server.");
            setIsScriptLoading(false);
          }
        }
      })
      .catch(() => {
        if (active) {
          setConfigLoaded(true);
          setConfigError("Google sign-in is unavailable right now.");
          setIsScriptLoading(false);
        }
      });
    return () => { active = false; };
  }, [retryCount]);

  // 2. Initialize Google GSI Script & Render Button
  const initGoogleButton = useCallback(() => {
    if (!clientId || !buttonRef.current) return;
    setIsScriptLoading(true);
    setError("");

    const renderGsi = () => {
      if (!window.google || !buttonRef.current) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: async ({ credential }) => {
            if (!credential) return;
            setLoading(true);
            setError("");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            try {
              const response = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential, mode }),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.error || "Google sign-in failed.");
              }

              setAccessToken(data.accessToken);
              setAuthUser({
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                avatarUrl: data.user.avatarUrl || "",
                signedInAt: Date.now(),
              });

              router.replace(mode === "admin" ? "/admin" : "/dashboard/generator");
              router.refresh();
            } catch (reason: unknown) {
              if (reason instanceof Error && reason.name === "AbortError") {
                setError("Sign-in request timed out. Please try again.");
              } else {
                setError(reason instanceof Error ? reason.message : "Google sign-in failed.");
              }
            } finally {
              clearTimeout(timeoutId);
              setLoading(false);
            }
          },
        });

        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: Math.min(360, buttonRef.current.clientWidth || 360),
        });

        setIsReady(true);
        setIsScriptLoading(false);
      } catch (err) {
        console.error("Failed to initialize Google button:", err);
        setError("Failed to load Google Sign-in. Please try again.");
        setIsScriptLoading(false);
      }
    };

    if (window.google) {
      renderGsi();
      return;
    }

    // Handle script loading with timeout
    const scriptTimeout = setTimeout(() => {
      if (!window.google) {
        setIsScriptLoading(false);
        setError("Google script took too long to load.");
      }
    }, 8000);

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]');
    if (existingScript) {
      const handleLoad = () => {
        clearTimeout(scriptTimeout);
        renderGsi();
      };
      const handleError = () => {
        clearTimeout(scriptTimeout);
        setIsScriptLoading(false);
        setError("Google sign-in is unavailable right now.");
      };
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "true";
    script.onload = () => {
      clearTimeout(scriptTimeout);
      renderGsi();
    };
    script.onerror = () => {
      clearTimeout(scriptTimeout);
      setIsScriptLoading(false);
      setError("Google sign-in is unavailable right now.");
    };
    document.head.appendChild(script);
  }, [clientId, mode, router]);

  useEffect(() => {
    if (clientId) {
      initGoogleButton();
    }
  }, [clientId, initGoogleButton]);

  const handleRetry = () => {
    setError("");
    setConfigError("");
    setRetryCount((c) => c + 1);
  };

  if (configLoaded && configError) {
    return (
      <div className="space-y-2 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {configError}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-11 w-full overflow-hidden rounded-xl">
        <button
          type="button"
          disabled={loading || isScriptLoading || !isReady}
          className="absolute inset-0 z-0 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.035] px-4 text-sm font-semibold text-foreground shadow-[0_8px_24px_rgba(7,27,23,0.07)] transition-all hover:border-primary/35 hover:bg-primary/[0.06] hover:shadow-[0_10px_28px_rgba(22,199,132,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Signing in...</span>
            </>
          ) : isScriptLoading && !isReady ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Loading Google Sign-in...</span>
            </>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-5 w-5"
              />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* The Google iframe overlay is ONLY clickable and active when fully ready & not loading */}
        <div
          ref={buttonRef}
          className={`absolute inset-0 min-h-11 opacity-0 transition-opacity ${
            isReady && !loading ? "z-10 pointer-events-auto cursor-pointer" : "z-0 pointer-events-none"
          }`}
        />
      </div>

      {error && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-center text-xs font-semibold text-red-500">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
