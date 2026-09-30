'use client';

import { useEffect, useState } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, Copy, ShieldCheck, Play, Sparkles, Cloud } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'r2' | 'aws'>('r2');

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
        <h2 className="mt-2 text-3xl font-black text-white">Cloudflare R2 &amp; AWS S3 Storage</h2>
        <p className="mt-2 text-sm text-white/55">
          Configure direct client-to-cloud file uploads via Pre-Signed URLs. Cloudflare R2 offers 10GB free storage and
          zero bandwidth egress charges.
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
              <h3 className="text-lg font-black text-white">Storage Engine Status</h3>
              <p className="text-xs text-white/50">Direct PUT Pre-Signed URL Pipeline</p>
            </div>
          </div>

          <div>
            {loading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking...
              </span>
            ) : status?.configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Storage Configured &amp; Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> Missing Credentials in .env
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
            <span className="text-[11px] font-semibold text-white/50">Region:</span>
            <p className="mt-1 font-mono text-sm font-bold text-white">
              {status?.region || <span className="text-white/30">auto / us-east-1</span>}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <span className="text-[11px] font-semibold text-white/50">Endpoint:</span>
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
                <RefreshCw className="h-4 w-4 animate-spin" /> Testing Pre-Signed URL...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Test Pre-Signed URL Upload
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

      {/* Provider Selector Tabs */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('r2')}
          className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
            activeTab === 'r2'
              ? 'border-primary bg-primary/15 text-primary shadow-lg ring-1 ring-primary/30'
              : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white'
          }`}
        >
          <Cloud className="h-4 w-4" />
          <span>Cloudflare R2 Setup (100% Free - Recommended)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aws')}
          className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
            activeTab === 'aws'
              ? 'border-primary bg-primary/15 text-primary shadow-lg ring-1 ring-primary/30'
              : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>AWS S3 Setup</span>
        </button>
      </div>

      {/* Cloudflare R2 Step-by-Step Setup Guide */}
      {activeTab === 'r2' ? (
        <div className="space-y-6 rounded-3xl border border-primary/20 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-black text-white">
              <Sparkles className="h-5 w-5 text-primary" /> Cloudflare R2 Setup Guide (10GB Free Forever)
            </h3>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              Zero Bandwidth Fees
            </span>
          </div>

          <div className="space-y-4 text-xs leading-relaxed text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-bold text-white">১. Cloudflare ড্যাশবোর্ডে লগইন করুন ও R2 Bucket বানান:</p>
              <p className="mt-1 text-white/60">
                Cloudflare Dashboard &gt; <strong>R2 Object Storage</strong> &gt; <strong>Create bucket</strong> (যেমন নাম দিন:{' '}
                <code className="text-primary">mcustock-assets</code>)
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-bold text-white">২. R2 API Token তৈরি করুন:</p>
              <p className="mt-1 text-white/60">
                R2 &gt; <strong>Manage R2 API Tokens</strong> &gt; <strong>Create API token</strong> &gt; Permissions দিন{' '}
                <strong>Object Read &amp; Write</strong>। এটি তৈরি করার পর আপনি পাবেন:
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-white/80 font-mono text-[11px]">
                <li>Access Key ID</li>
                <li>Secret Access Key</li>
                <li>Endpoint URL (e.g. <code>https://&lt;ACCOUNT_ID&gt;.r2.cloudflarestorage.com</code>)</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-bold text-white">৩. আপনার `.env` ফাইলে ভ্যালুগুলো পেস্ট করুন:</p>
              <div className="relative mt-3 rounded-xl border border-white/10 bg-black/80 p-4 font-mono text-xs">
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'r2_env',
                      `AWS_REGION=auto\nAWS_ACCESS_KEY_ID=your_cloudflare_r2_access_key_id\nAWS_SECRET_ACCESS_KEY=your_cloudflare_r2_secret_access_key\nAWS_S3_BUCKET_NAME=mcustock-assets\nAWS_S3_ENDPOINT=https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com\n# Optional public domain if enabled in R2:\n# AWS_S3_PUBLIC_DOMAIN=https://pub-<id>.r2.dev`
                    )
                  }
                  className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
                  title="Copy R2 ENV"
                >
                  {copied === 'r2_env' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="overflow-x-auto text-emerald-400">
{`AWS_REGION=auto
AWS_ACCESS_KEY_ID=your_cloudflare_r2_access_key_id
AWS_SECRET_ACCESS_KEY=your_cloudflare_r2_secret_access_key
AWS_S3_BUCKET_NAME=mcustock-assets
AWS_S3_ENDPOINT=https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com

# Optional Public Domain (if Custom Domain or r2.dev is enabled):
# AWS_S3_PUBLIC_DOMAIN=https://pub-<id>.r2.dev`}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="font-bold text-white">৪. R2 Bucket CORS রুলস অন করুন:</p>
              <p className="mt-1 text-white/60">
                আপনার R2 Bucket &gt; <strong>Settings</strong> &gt; <strong>CORS Policy</strong> &gt; <strong>Add CORS rule</strong> এ পেস্ট করুন:
              </p>
              <div className="relative mt-2 rounded-xl border border-white/10 bg-black/80 p-3 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => copyText('r2_cors', corsSample)}
                  className="absolute right-2.5 top-2.5 rounded-lg border border-white/10 bg-white/5 p-1 text-white/60 hover:text-white"
                >
                  {copied === 'r2_cors' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3 w-3" />}
                </button>
                <pre className="overflow-x-auto text-white/80">{corsSample}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* AWS S3 Step-by-Step Setup Guide */
        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-lg font-black text-white">
            <ShieldCheck className="h-5 w-5 text-primary" /> AWS S3 Setup Guide
          </h3>
          <p className="text-xs text-white/55">
            Add the following environment variables in your server <code className="text-primary">.env</code> file:
          </p>

          <div className="relative rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs text-white/90">
            <button
              type="button"
              onClick={() =>
                copyText(
                  'aws_env',
                  `AWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=your_access_key_id\nAWS_SECRET_ACCESS_KEY=your_secret_access_key\nAWS_S3_BUCKET_NAME=your-bucket-name`
                )
              }
              className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
              title="Copy AWS ENV"
            >
              {copied === 'aws_env' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <pre className="overflow-x-auto text-emerald-400">
{`AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=your-bucket-name`}
            </pre>
          </div>

          <h4 className="text-sm font-bold text-white">AWS S3 Bucket CORS Configuration:</h4>
          <p className="text-xs text-white/50">
            AWS S3 Console &gt; Bucket &gt; Permissions &gt; Cross-origin resource sharing (CORS):
          </p>
          <div className="relative rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-xs text-white/80">
            <button
              type="button"
              onClick={() => copyText('aws_cors', corsSample)}
              className="absolute right-3 top-3 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
            >
              {copied === 'aws_cors' ? <span className="text-xs font-bold text-primary">Copied!</span> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <pre className="overflow-x-auto text-[11px] leading-relaxed text-white/70">{corsSample}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
