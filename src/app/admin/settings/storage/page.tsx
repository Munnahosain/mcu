'use client';

import { useEffect, useState } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink, ShieldCheck, Play } from 'lucide-react';

type S3Status = {
  configured: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  hasCustomDomain: boolean;
  publicDomain: string;
};

export default function StorageSettingsPage() {
  const [status, setStatus] = useState<S3Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testError, setTestError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/storage');
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleTestPresignedUrl = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const res = await fetch('/api/admin/storage', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate test pre-signed URL.');
      }
      setTestResult(data.testResult);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Testing failed.');
    } finally {
      setTesting(false);
    }
  };

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const corsSample = JSON.stringify(
    [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD', 'DELETE'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000,
      },
    ],
    null,
    2
  );

  return (
    <div className="mx-auto max-w-4xl space-y-7 pb-12">
      {/* Header */}
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Cloud Infrastructure</p>
        <h2 className="mt-2 text-3xl font-black text-white">AWS S3 Cloud Storage & Pre-Signed URLs</h2>
        <p className="mt-2 text-sm text-white/55">
          Configure direct client-to-cloud file uploads via AWS S3 Pre-Signed URLs. Eliminates backend server load and
          accelerates asset generation exports.
        </p>
      </section>

      {/* Status Card */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">AWS S3 Connection Status</h3>
              <p className="text-xs text-white/50">Direct PUT Pre-Signed URL Engine</p>
            </div>
          </div>

          <div>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking...
              </span>
            ) : status?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> S3 Configured & Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> Missing Environment Variables
              </span>
            )}
          </div>
        </div>

        {/* Configuration Values Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-[11px] font-semibold text-white/50">Bucket Name:</span>
            <p className="mt-1 font-mono text-sm font-bold text-white">
              {status?.bucket || <span className="text-white/30">Not set</span>}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-[11px] font-semibold text-white/50">AWS Region:</span>
            <p className="mt-1 font-mono text-sm font-bold text-white">
              {status?.region || <span className="text-white/30">us-east-1 (Default)</span>}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-[11px] font-semibold text-white/50">S3 Endpoint:</span>
            <p className="mt-1 truncate font-mono text-xs font-bold text-white">
              {status?.endpoint || 'AWS Standard'}
            </p>
          </div>
        </div>

        {/* Test Connection Button */}
        <div className="mt-6 flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleTestPresignedUrl}
            disabled={testing || !status?.configured}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-background transition hover:brightness-110 disabled:opacity-40"
          >
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Generating Pre-Signed URL...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Test Pre-Signed URL Generation
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchStatus}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-white/70 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
          </button>
        </div>

        {/* Test Output Box */}
        {testError && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
            <p className="font-bold">Test Failed:</p>
            <p className="mt-1 font-mono">{testError}</p>
          </div>
        )}

        {testResult && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
            <p className="flex items-center gap-1.5 font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Pre-Signed URL Generated Successfully!
            </p>
            <div className="mt-3 space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-white/60">Upload Key:</span> {String(testResult.fileKey)}
              </div>
              <div className="break-all">
                <span className="text-white/60">Pre-Signed URL:</span>{' '}
                <span className="text-emerald-300">{String(testResult.uploadUrl).slice(0, 80)}...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step-by-Step Setup Guide */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h3 className="flex items-center gap-2 text-lg font-black text-white">
          <ShieldCheck className="h-5 w-5 text-primary" /> How to Setup AWS S3 in `.env`
        </h3>
        <p className="mt-1 text-xs text-white/55">
          Add the following environment variables in your server <code className="text-primary">.env</code> file:
        </p>

        <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs text-white/90">
          <button
            type="button"
            onClick={() =>
              copyText(
                'env',
                `AWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=your_access_key_id\nAWS_SECRET_ACCESS_KEY=your_secret_access_key\nAWS_S3_BUCKET_NAME=your-bucket-name\n# Optional:\n# AWS_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com\n# AWS_S3_PUBLIC_DOMAIN=https://cdn.yourdomain.com`
              )
            }
            className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
            title="Copy ENV Template"
          >
            {copied === 'env' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <pre className="overflow-x-auto leading-relaxed text-emerald-400">
{`AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=your-bucket-name

# Optional Custom CDN or R2 Endpoint:
# AWS_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
# AWS_S3_PUBLIC_DOMAIN=https://cdn.yourdomain.com`}
          </pre>
        </div>

        {/* CORS configuration */}
        <h4 className="mt-6 text-sm font-bold text-white">Required AWS S3 Bucket CORS Configuration:</h4>
        <p className="mt-1 text-xs text-white/50">
          In your AWS S3 Console &gt; Bucket &gt; Permissions &gt; Cross-origin resource sharing (CORS):
        </p>

        <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs text-white/80">
          <button
            type="button"
            onClick={() => copyText('cors', corsSample)}
            className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
            title="Copy CORS JSON"
          >
            {copied === 'cors' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-white/70">{corsSample}</pre>
        </div>
      </div>
    </div>
  );
}
