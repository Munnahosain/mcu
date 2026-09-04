"use client";

import { motion } from "framer-motion";
import { FileSpreadsheet } from "lucide-react";

export default function CSVGeneratorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">CSV & Export Manager</h2>
      </div>
      
      <p className="text-gray-400">
        Manage your generated CSV structures and map columns for different stock agencies.
      </p>

      {/* Stats/Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col gap-4">
           <div className="p-3 bg-red-500/10 text-red-500 w-max rounded-xl"><FileSpreadsheet className="w-6 h-6" /></div>
           <h3 className="font-semibold">Adobe Stock Format</h3>
           <p className="text-sm text-gray-400">Default mapping (Filename, Title, Keywords, Category).</p>
           <button className="text-sm font-semibold text-primary self-start mt-2">Edit template config</button>
        </div>
        <div className="glass-card p-6 flex flex-col gap-4">
           <div className="p-3 bg-orange-500/10 text-orange-500 w-max rounded-xl"><FileSpreadsheet className="w-6 h-6" /></div>
           <h3 className="font-semibold">Shutterstock Format</h3>
           <p className="text-sm text-gray-400">Standard mapping with Description fallback.</p>
           <button className="text-sm font-semibold text-primary self-start mt-2">Edit template config</button>
        </div>
        <div className="glass-card p-6 flex flex-col gap-4 border-primary/20 bg-primary/5">
           <div className="p-3 bg-primary/20 text-primary w-max rounded-xl"><FileSpreadsheet className="w-6 h-6" /></div>
           <h3 className="font-semibold">Freepik Format</h3>
           <p className="text-sm text-gray-400">Optimized mapping with exact keyword structures.</p>
           <button className="text-sm font-semibold text-primary self-start mt-2">Edit template config</button>
        </div>
      </div>

    </div>
  );
}
