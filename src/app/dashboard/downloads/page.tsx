"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, File as FileIcon, Search, Calendar } from "lucide-react";
import { getAuthUser, getDownloadsKey } from "@/lib/auth";

type DownloadRecord = {
  id: string;
  fileName: string;
  type: "CSV";
  date: string;
  size: number;
  itemCount: number;
  content?: string;
};

const formatBytes = (size: number) => {
  if (!size) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    const historyKey = getDownloadsKey(user?.email);
    const existingRaw = localStorage.getItem(historyKey);
    if (!existingRaw) {
      setDownloads([]);
      return;
    }
    try {
      const existing = JSON.parse(existingRaw) as DownloadRecord[];
      setDownloads(existing);
    } catch {
      setDownloads([]);
    }
  }, []);

  const filteredDownloads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return downloads;
    return downloads.filter((item) => item.fileName.toLowerCase().includes(term));
  }, [downloads, search]);

  const handleDownload = (item: DownloadRecord) => {
    if (!item.content) {
      alert("This file is not available for re-download.");
      return;
    }
    const blob = new Blob([item.content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Downloads History</h2>
          <p className="text-gray-400 mt-1">Access previously generated CSV and prompt files.</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden mt-8">
         <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02] gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search files..."
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 border border-white/10 rounded-lg"><Calendar className="w-4 h-4" /> Filter by Date</button>
         </div>

         <div className="w-full">
           <table className="w-full text-sm text-left">
             <thead className="text-xs text-gray-400 bg-black/40 uppercase">
               <tr>
                 <th className="px-6 py-4 font-medium">File Name</th>
                 <th className="px-6 py-4 font-medium">Type</th>
                 <th className="px-6 py-4 font-medium">Date</th>
                 <th className="px-6 py-4 font-medium">Size</th>
                 <th className="px-6 py-4 font-medium text-right">Action</th>
               </tr>
             </thead>
             <tbody>
                {filteredDownloads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-24 text-center text-gray-500">
                      <FileIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      No download history found.
                    </td>
                  </tr>
                ) : (
                  filteredDownloads.map((item) => (
                    <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{item.fileName}</div>
                        <div className="text-xs text-gray-500">{item.itemCount} images</div>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{item.type}</td>
                      <td className="px-6 py-4 text-gray-400">{new Date(item.date).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-400">{formatBytes(item.size)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDownload(item)}
                          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                      </td>
                    </tr>
                  ))
                )}
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
}
