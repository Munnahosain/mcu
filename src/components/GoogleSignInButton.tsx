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
      initialize: (options: {
        client_id: string;
        auto_select?: boolean;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          logo_alignment?: "left" | "center";
          width?: number | string;
        }
      ) => void;
      prompt?: (momentListener?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
      cancel: () => void;
      disableAutoSelect: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleApi;
  }
}

export default function GoogleSignInButton({ mode = "user" }: { mode?: GoogleMode }) {
  const router = useRouter();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
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
          setConfigError("Google sign-in configuration unavailable.");
          setIsScriptLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retryCount]);

  // 2. Initialize Google Identity Services & Render Native Button
  const renderGoogleButton = useCallback(() => {
    if (!clientId || !buttonContainerRef.current) return;
    setIsScriptLoading(true);
    setError("");

    const doRender = () => {
      if (!window.google || !buttonContainerRef.current) return;
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

        // Determine container width
        const containerWidth = buttonContainerRef.current.parentElement?.clientWidth || 360;
        const targetWidth = Math.min(380, Math.max(240, containerWidth));

        // Clear existing children and render native Google button visibly
        buttonContainerRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: targetWidth,
        });

        setIsReady(true);
        setIsScriptLoading(false);
      } catch (err) {
        console.error("Failed to render Google button:", err);
        setError("Failed to load Google Sign-in. Please try again.");
        setIsScriptLoading(false);
      }
    };

    if (window.google) {
      doRender();
      return;
    }

    // Script loading timeout
    const scriptTimeout = setTimeout(() => {
      if (!window.google) {
        setIsScriptLoading(false);
        setError("Google script took too long to load (Check adblocker or connection).");
      }
    }, 7000);

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]');
    if (existingScript) {
      const handleLoad = () => {
        clearTimeout(scriptTimeout);
        doRender();
      };
      const handleError = () => {
        clearTimeout(scriptTimeout);
        setIsScriptLoading(false);
        setError("Google sign-in is blocked by browser or connection.");
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
      doRender();
    };
    script.onerror = () => {
      clearTimeout(scriptTimeout);
      setIsScriptLoading(false);
      setError("Google sign-in is blocked by browser or connection.");
    };
    document.head.appendChild(script);
  }, [clientId, mode, router]);

  useEffect(() => {
    if (clientId) {
      renderGoogleButton();
    }
  }, [clientId, renderGoogleButton]);

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
    <div className="w-full space-y-3">
      <div className="relative min-h-[44px] w-full flex items-center justify-center">
        {/* Loading / Processing State */}
        {loading && (
          <div className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-bold text-primary">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Signing in to MCUSTOCK...</span>
          </div>
        )}

        {/* Script Loading State */}
        {!loading && (isScriptLoading || !isReady) && (
          <div className="flex h-11 w-full animate-pulse items-center justify-center gap-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.035] px-4 text-xs font-semibold text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading Google Sign-in...</span>
          </div>
        )}

        {/* Official Google GSI Native Render Container (Visible, Zero Opacity Tricks) */}
        <div
          ref={buttonContainerRef}
          className={`w-full flex justify-center ${loading || isScriptLoading || !isReady ? "hidden" : "block"}`}
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

