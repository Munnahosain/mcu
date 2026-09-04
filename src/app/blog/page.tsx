import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog | MCUSTOCK AI',
  description: 'Tips, updates, and tutorials for stock image creators.',
};

const posts = [
  {
    title: "How to Optimize Your Stock Portfolio for Adobe Stock AI Search",
    excerpt: "Learn the specific keywords and title structures that Adobe's new AI search engine prioritizes for ranking stock images.",
    date: "March 15, 2026",
    category: "SEO Strategy",
    image: "bg-gradient-to-br from-[#46BBE8]/20 to-[#1F61AE]/20",
  },
  {
    title: "Using Llama 4 Vision to Reverse-Engineer Midjourney Prompts",
    excerpt: "Discover how we use the latest vision models to look at any generated image and reconstruct the exact prompt used to create it.",
    date: "March 10, 2026",
    category: "AI Generation",
    image: "bg-gradient-to-br from-[#46BBE8]/20 to-[#1F61AE]/20",
  },
  {
    title: "Why 49 Keywords is the Magic Number for Shutterstock",
    excerpt: "An analysis of 100,000 top-selling stock photos reveals why maximizing your keyword count to strictly 49 yields the best CTR.",
    date: "March 02, 2026",
    category: "Data Analysis",
    image: "bg-gradient-to-br from-[#46BBE8]/20 to-[#1F61AE]/20",
  },
  {
    title: "Introducing MCUSTOCK Automation Workflows",
    excerpt: "A deep dive into our new feature that allows you to automate the entire upload process from a constantly watched folder on your desktop.",
    date: "February 28, 2026",
    category: "Platform Update",
    image: "bg-gradient-to-br from-[#46BBE8]/20 to-[#1F61AE]/20",
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full glass-dark-premium border-x-0 border-t-0 rounded-none z-50 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 hover:scale-105 transition-transform underline-animated">
          <Image
            src="/MCU-LOGO-0.2V-1.png"
            alt="MCU Logo"
            width={32}
            height={32}
            className="w-8 object-contain drop-shadow"
          />
          <span className="font-bold text-xl tracking-tight text-gradient-premium">MCUSTOCK</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
          <Link href="/tools" className="hover:text-white transition-colors">Tools</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
          <Link href="/blog" className="text-white transition-colors font-semibold">Blog</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:text-white transition-colors">Log in</Link>
          <Link href="/signup" className="btn-gradient-premium px-4 py-2 rounded-full text-sm font-semibold btn-hover-lift">
            Start Free
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto space-y-16 mt-8">
        
        {/* Header */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight heading-premium">
            Latest Updates & Insights
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Strategies for stock creators, deeper dives into AI vision models, and platform announcements.
          </p>
        </div>

        {/* Blog Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 divider-premium">
          {posts.map((post, index) => (
             <Link 
               key={index}
               href="#"
               className="card-elevated group flex flex-col overflow-hidden transition-all duration-300"
             >
                <div className={`h-48 w-full ${post.image} flex items-center justify-center p-8 text-center`}>
                   <h3 className="text-2xl font-bold opacity-80 group-hover:opacity-100 transition-opacity">{post.title}</h3>
                </div>
                <div className="p-6 flex flex-col flex-1">
                   <div className="flex justify-between items-center mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                     <span className="badge-premium">{post.category}</span>
                     <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                   </div>
                   <h4 className="text-xl font-bold mb-3 text-gradient-premium group-hover:text-[#F57A3F] transition-colors">{post.title}</h4>
                   <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">{post.excerpt}</p>
                   
                   <span className="text-sm font-semibold text-[#F07B3F] flex items-center gap-2 group-hover:translate-x-1 transition-transform w-fit">
                     Read article <ArrowRight className="w-4 h-4" />
                   </span>
                </div>
             </Link>
          ))}
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto pt-24 border-t border-white/10 mt-24 pb-8 text-center text-gray-500 text-sm">
        <p>© 2026 MCUSTOCK AI. Built by MCU Automation.</p>
      </footer>
    </div>
  );
}
