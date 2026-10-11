"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Maximize2, RotateCcw } from "lucide-react";

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
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);

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

  const goFullscreen = () => {
    const frame = document.getElementById("embedded-studio-frame");
    frame?.requestFullscreen?.().catch(() => {});
  };

  if (status.kind === "missing" || status.kind === "broken") {
    const missing = status.kind === "missing";
    return (
      <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8">
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
    <section className="overflow-hidden rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)]">
      {status.kind === "checking" ? (
        <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking files&hellip;
        </div>
      ) : (
        <div className="relative">
          <iframe
            id="embedded-studio-frame"
            src={url}
            title={title}
            className="block w-full border-0 bg-[#0f1014]"
            style={{ height: "calc(100dvh - 9rem)", minHeight: 520 }}
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
          />
          <button
            type="button"
            onClick={goFullscreen}
            title="Fullscreen"
            aria-label="Fullscreen"
            className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)]/90 text-primary hover:bg-primary/10"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
