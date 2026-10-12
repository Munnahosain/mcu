"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Maximize2, Minimize2, RotateCcw } from "lucide-react";

type Status =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "missing" }
  | { kind: "broken"; reason: string };

const PROBE_TIMEOUT_MS = 10_000;

// Checks index.html and the *_bg.wasm it names, so a missing engine shows a message instead of an endless "Loading…".
async function probe(url: string, signal: AbortSignal): Promise<Status> {
  const page = await fetch(url, { cache: "no-store", signal });
  if (!page.ok) return { kind: "missing" };
  const html = await page.text();
  const wasmName = html.match(/["'(]([^"'()\s]+_bg\.wasm)["')]/)?.[1];
  if (!wasmName) return { kind: "ready" };
  const wasmUrl = new URL(wasmName, new URL(url, window.location.href)).href;
  const wasm = await fetch(wasmUrl, { method: "HEAD", cache: "no-store", signal });
  if (!wasm.ok) return { kind: "broken", reason: `Engine file not found (${wasm.status}): ${wasmName.split("/").pop()}` };
  const type = wasm.headers.get("content-type") || "";
  if (type && !type.includes("application/wasm")) {
    return { kind: "broken", reason: `Engine file is served as "${type}", it must be "application/wasm".` };
  }
  return { kind: "ready" };
}

type Props = {
  title: string;
  /** Address of the app's index.html: a /public path or a full CDN URL. */
  url: string;
  icon: ReactNode;
  /** Shown when the files are not installed. */
  installHint: ReactNode;
};

export default function EmbeddedStudio({ title, url, icon, installHint }: Props) {
  const studioRef = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const retry = useCallback(() => {
    setStatus({ kind: "checking" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!url.startsWith("/")) {
      setStatus({ kind: "ready" }); // cross-origin: cannot probe without CORS, trust the URL
      return;
    }
    const controller = new AbortController();
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PROBE_TIMEOUT_MS);
    probe(url, controller.signal)
      .then(setStatus)
      .catch(() => {
        if (controller.signal.aborted && !timedOut) return;
        setStatus({ kind: "broken", reason: timedOut ? "The files did not answer in time." : "The files could not be reached." });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [url, attempt]);

  const syncEditorTheme = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;

    const editorUrl = new URL(url, window.location.href);
    if (editorUrl.origin !== window.location.origin) return;

    const stored = localStorage.getItem("mcustock_theme");
    const mode = stored === "light" || stored === "dark"
      ? stored
      : document.documentElement.classList.contains("light")
        ? "light"
        : "dark";
    frame.postMessage({ type: "mint-canvas:theme", mode }, editorUrl.origin);
  }, [url]);

  useEffect(() => {
    const sync = () => syncEditorTheme();
    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current?.contentWindow;
      if (event.origin !== window.location.origin || event.source !== frame) return;
      if (event.data?.type === "mint-canvas:ready") syncEditorTheme();
    };
    window.addEventListener("mcustock-theme-changed", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("mcustock-theme-changed", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("message", onMessage);
    };
  }, [syncEditorTheme]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === studioRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const studio = studioRef.current;
    if (!studio) return;

    try {
      if (document.fullscreenElement === studio) {
        await document.exitFullscreen();
      } else {
        await studio.requestFullscreen();
      }
    } catch (error) {
      console.error(`Could not change ${title} fullscreen mode:`, error);
    }
  };

  if (status.kind === "missing" || status.kind === "broken") {
    const missing = status.kind === "missing";
    return (
      <section className="min-h-0 min-w-0 flex-1 overflow-auto p-6 sm:p-8">
        <div className="flex items-center gap-3 text-primary">
          {missing ? icon : <AlertTriangle className="h-5 w-5" />}
          <h1 className="text-xl font-black">{missing ? `${title} is not installed yet` : `${title} could not start`}</h1>
        </div>
        {!missing && <p className="mt-3 text-sm font-semibold text-red-400">{status.reason}</p>}
        <div className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{installHint}</div>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-[var(--card-border)] px-4 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
      </section>
    );
  }

  return (
    <section
      ref={studioRef}
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-[100] h-[100dvh] w-screen bg-[var(--main-bg)]" : ""
      }`}
    >
      {status.kind === "checking" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking files&hellip;
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <iframe
              ref={iframeRef}
              onLoad={syncEditorTheme}
              src={url}
              title={title}
              className="block h-full min-h-0 w-full flex-1 border-0 bg-[#0f1014]"
              allow="fullscreen; clipboard-read; clipboard-write"
              allowFullScreen
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit full screen" : "Full screen"}
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              className="absolute right-[16%] top-1 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#25262b] text-white transition-colors hover:bg-[#3a3b42]"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
