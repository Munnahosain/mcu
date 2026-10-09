"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize, PenTool } from "lucide-react";

// Where the pattern editor is served from. Defaults to the copy in /public/vectorcraft.
// Set NEXT_PUBLIC_VECTORCRAFT_URL to a CDN/S3 URL (ending in index.html) to host it elsewhere.
const EDITOR_URL = process.env.NEXT_PUBLIC_VECTORCRAFT_URL || "/vectorcraft/index.html";

type Status = "checking" | "ready" | "missing";

export default function VectorEditorPage() {
  const editorSectionRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<Status>(() =>
    EDITOR_URL.startsWith("/") ? "checking" : "ready",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const isSameOrigin = EDITOR_URL.startsWith("/");

    // Cross-origin hosts can't be probed without CORS, so trust the configured URL there.
    if (!isSameOrigin) {
      return;
    }

    fetch(EDITOR_URL, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === editorSectionRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const editorSection = editorSectionRef.current;
    if (!editorSection) return;

    setFullscreenError("");
    try {
      if (document.fullscreenElement === editorSection) {
        await document.exitFullscreen();
      } else {
        await editorSection.requestFullscreen();
      }
    } catch (error) {
      console.error("Could not change Mata Pattern Studio fullscreen mode:", error);
      setFullscreenError("Fullscreen could not be opened. Check your browser permissions and try again.");
    }
  };

  if (status === "missing") {
    return (
      <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8">
        <div className="flex items-center gap-3 text-primary">
          <PenTool className="h-5 w-5" />
          <h1 className="text-xl font-black">Mata Pattern Studio is not installed yet</h1>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Place the web editor build in <code>public/vectorcraft</code>, or set{" "}
          <code>NEXT_PUBLIC_VECTORCRAFT_URL</code> to its hosted <code>index.html</code>.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={editorSectionRef}
      className={`relative min-h-0 min-w-0 overflow-hidden bg-[var(--card-bg)] ${
        isFullscreen
          ? "fixed inset-0 z-[100] h-[100dvh] w-screen"
          : "h-full w-full"
      }`}
    >
      {status === "checking" ? (
        <div className="flex h-full min-h-0 items-center justify-center text-sm text-[var(--text-secondary)]">
          Loading editor&hellip;
        </div>
      ) : (
        <>
          {fullscreenError && (
            <p role="alert" className="absolute left-4 top-14 z-10 rounded-lg bg-[var(--card-bg)] px-3 py-2 text-sm text-red-600 shadow dark:text-red-400">
              {fullscreenError}
            </p>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            className="absolute left-[65%] top-2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center text-foreground"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <iframe
            src={EDITOR_URL}
            title="Mata Pattern Studio"
            loading="lazy"
            className="absolute inset-0 block h-full w-full border-0"
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
          />
        </>
      )}
    </section>
  );
}
