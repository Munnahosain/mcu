import { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Code, Key, Sparkles, Terminal } from "lucide-react";
import MarketingChrome from "../../components/MarketingChrome";
import MarketingFooter from "../../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Documentation | MCUSTOCK AI",
  description:
    "Learn how to use MCUSTOCK AI to generate stock metadata and connect APIs.",
};

export default function DocsPage() {
  return (
    <div className="liquid-page-shell min-h-screen pt-28 bg-background text-foreground">
      <MarketingChrome activePath="/docs" />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-12 sm:px-6 lg:px-8 md:flex-row">
        <aside className="border border-primary/20 bg-background rounded-3xl p-6 hidden h-max w-full shrink-0 space-y-8 md:sticky md:top-28 md:block md:w-72">
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <BookOpen className="h-4 w-4" />
              Getting Started
            </h4>
            <ul className="space-y-2 text-xs font-semibold text-primary/80">
              <li><a href="#intro" className="block py-1 hover:underline">Introduction</a></li>
              <li><a href="#quickstart" className="block py-1 hover:underline">Quickstart Guide</a></li>
              <li><a href="#uploading" className="block py-1 hover:underline">Uploading Images</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Key className="h-4 w-4" />
              API Configuration
            </h4>
            <ul className="space-y-2 text-xs font-semibold text-primary/80">
              <li><a href="#groq-setup" className="block py-1 hover:underline">Groq AI Setup</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              <Code className="h-4 w-4" />
              Export and Integration
            </h4>
            <ul className="space-y-2 text-xs font-semibold text-primary/80">
              <li><a href="#csv-format" className="block py-1 hover:underline">CSV Format Guide</a></li>
            </ul>
          </div>
        </aside>

        <main className="border border-primary/20 rounded-3xl p-6 sm:p-8 bg-background flex-1 max-w-3xl space-y-6">
          <div className="flex">
            <div className="border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="h-4.5 w-4.5" />
              Liquid docs
            </div>
          </div>
          <h1 id="intro" className="liquid-title mb-2 text-4xl font-extrabold tracking-tight text-primary">
            Documentation
          </h1>
          <p className="text-lg text-primary/85 leading-relaxed">
            Learn how to automate your stock photography workflow.
          </p>

          <div className="h-px bg-primary/10 my-6" />

          <h2 id="quickstart" className="text-xl font-bold text-primary">
            Quickstart Guide
          </h2>
          <p className="text-xs text-primary/80 leading-relaxed">
            MCUSTOCK AI is designed to be plug-and-play. Follow these simple
            steps to generate your first batch of metadata.
          </p>
          <ol className="space-y-3 text-xs text-primary/85 font-semibold list-decimal pl-4">
            <li><strong>Create an account</strong>: Sign up for a MongoDB credentials account.</li>
            <li><strong>Add your API key</strong>: Access the homepage workspace and configure your Groq key under settings.</li>
            <li><strong>Upload images</strong>: Drag and drop up to 100 images into the generation queue.</li>
            <li><strong>Generate</strong>: Click Generate All and let the AI build titles, keywords, and prompts.</li>
            <li><strong>Export</strong>: Download the formatted CSV file and check your MongoDB history log.</li>
          </ol>

          <div className="h-px bg-primary/10 my-6" />

          <h2 id="groq-setup" className="text-xl font-bold text-primary">
            Groq AI Setup
          </h2>
          <p className="text-xs text-primary/80 leading-relaxed">
            We use Groq&apos;s high-speed vision pipeline for instant metadata
            generation. You need to provide your own API key.
          </p>
          
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 font-mono text-[11px] text-primary">
            <div className="mb-2 flex items-center gap-2 text-primary/60">
              <Terminal className="h-4 w-4" />
              Console output
            </div>
            Success: Connected to Groq API using key starting with gsk_8F3a...
          </div>

          <div className="h-px bg-primary/10 my-6" />

          <h2 id="csv-format" className="text-xl font-bold text-primary">
            CSV Formats
          </h2>
          <p className="text-xs text-primary/80 leading-relaxed">
            The exported CSV files are tested against major stock platforms and
            include the required fields:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-4 text-xs text-primary/85 font-semibold">
            <li><code className="rounded bg-primary/10 px-1 py-0.5 font-mono">Filename</code> - Exact match of your uploaded file.</li>
            <li><code className="rounded bg-primary/10 px-1 py-0.5 font-mono">Title</code> - SEO-optimized title up to 200 characters.</li>
            <li><code className="rounded bg-primary/10 px-1 py-0.5 font-mono">Keywords</code> - Comma-separated list of exactly 49 keywords.</li>
            <li><code className="rounded bg-primary/10 px-1 py-0.5 font-mono">Category</code> - Agency-specific category mapping.</li>
          </ul>
        </main>
      </div>
      <MarketingFooter />
    </div>
  );
}
