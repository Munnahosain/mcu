import Link from "next/link";
import { ArrowLeft, CircleOff, ShieldAlert } from "lucide-react";

export default function FeatureDisabledNotice({
  feature,
  message,
  checking = false,
  onRetry,
}: {
  feature: string;
  message?: string;
  checking?: boolean;
  onRetry?: () => void;
}) {
  const isCheckError = message?.includes("Unable to check") ?? false;
  return (
    <section
      className="mx-auto flex min-h-[55vh] w-full max-w-3xl items-center justify-center px-4 py-12"
      aria-live="polite"
      aria-busy={checking}
    >
      <div className="w-full rounded-3xl border border-foreground/10 bg-background/80 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
          {checking ? (
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-amber-600/20 border-t-amber-600" />
          ) : isCheckError ? (
            <ShieldAlert className="h-7 w-7" />
          ) : (
            <CircleOff className="h-7 w-7" />
          )}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-primary">Feature availability</p>
        <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">
          {checking ? "Checking feature availability" : `${feature} is unavailable`}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-foreground/60">
          {checking
            ? "Please wait while we check whether this feature is available for your account."
            : message || "This feature has been turned off by the administrator. Its controls are unavailable while it is disabled."}
        </p>
        {!checking ? (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                Try again
              </button>
            ) : null}
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.04] px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
