"use client";

import { useState } from "react";
import { 
  Calendar, 
  Trash2, 
  Image as ImageIcon, 
  Wand2, 
  BarChart, 
  StickyNote, 
  Plus,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Search,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- WIDGET PROPS ---
interface WidgetProps {
  onRemove?: () => void;
  className?: string;
}

// --- CALENDAR WIDGET ---
export const CalendarWidget = ({ onRemove }: WidgetProps) => {
  const [date] = useState(new Date());
  const events = [
    { time: "10:00 AM", title: "Adobe Stock Submission", type: "stock" },
    { time: "02:30 PM", title: "Keyword Optimization", type: "seo" },
  ];

  return (
    <div className="liquid-card glass-light-track h-full flex flex-col p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl overflow-hidden group transition-all duration-300 animate-fade-in" style={{
      background: 'linear-gradient(-45deg, rgba(237, 95, 43, 0.08), rgba(245, 122, 63, 0.06), rgba(237, 95, 43, 0.08))'
    }}>
      <div className="absolute inset-0 liquid-flow1" style={{
        background: 'linear-gradient(-45deg, rgba(237, 95, 43, 0.05), rgba(245, 122, 63, 0.03), rgba(237, 95, 43, 0.05))',
        pointerEvents: 'none'
      }} />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 icon-bg-primary rounded-xl">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="dashboard-muted text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Calendar</span>
          </div>
          {onRemove && (
             <button onClick={onRemove} className="p-1.5 hover:bg-red-500/15 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300">
               <Trash2 className="w-4 h-4" />
             </button>
          )}
        </div>
        
        <div className="flex-1 space-y-2 sm:space-y-3">
          <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            {date.toLocaleString('default', { month: 'short' })} {date.getDate()}
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {events.map((e, i) => (
               <div key={i} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white/8 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:border-orange-300 transition-all duration-300">
                  <div className={`w-1 h-6 sm:h-8 rounded-full ${e.type === 'stock' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                  <div className="flex-1 min-w-0">
                     <div className="dashboard-muted text-[10px] sm:text-xs font-semibold">{e.time}</div>
                     <div className="dashboard-soft text-xs sm:text-sm font-semibold truncate">{e.title}</div>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- IMAGE TOOLS WIDGET ---
export const ImageToolsWidget = ({ onRemove }: WidgetProps) => {
  return (
    <div className="liquid-card glass-light-track h-full flex flex-col p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl overflow-hidden group transition-all duration-300 animate-fade-in" style={{
      background: 'linear-gradient(-45deg, rgba(56, 141, 198, 0.08), rgba(79, 172, 254, 0.06), rgba(56, 141, 198, 0.08))'
    }}>
      <div className="absolute inset-0 liquid-flow2" style={{
        background: 'linear-gradient(-45deg, rgba(56, 141, 198, 0.05), rgba(79, 172, 254, 0.03), rgba(56, 141, 198, 0.05))',
        pointerEvents: 'none'
      }} />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 icon-bg-secondary rounded-xl">
              <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="dashboard-muted text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Image Lab</span>
          </div>
          {onRemove && (
             <button onClick={onRemove} className="p-1.5 hover:bg-red-500/15 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300">
               <Trash2 className="w-4 h-4" />
             </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:gap-3 flex-1">
           <button className="flex items-center justify-center p-3 sm:p-4 bg-white/8 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 hover:bg-white/12 transition-all gap-2 sm:gap-3 group/btn flex-1">
              <div className="p-2 sm:p-2.5 icon-bg-secondary rounded-lg sm:rounded-xl group-hover/btn:scale-110 transition-transform duration-300">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="dashboard-soft text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide">BG Remover</span>
           </button>
        </div>
      </div>
    </div>
  );
};

// --- ASCII WIDGET ---
export const ASCIIWidget = ({ onRemove }: WidgetProps) => {
  return (
    <div className="liquid-card glass-light-track h-full flex flex-col p-4 bg-[#0a0a0b] text-white border border-white/10 rounded-3xl overflow-hidden group font-mono">
       <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/10 rounded-lg">
            <span className="text-[10px] font-bold">#</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">ASCII Art</span>
        </div>
        {onRemove && (
           <button onClick={onRemove} className="p-1 hover:bg-white/10 rounded-lg text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
             <Trash2 className="w-4 h-4" />
           </button>
        )}
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center text-[8px] leading-[6px] opacity-70">
        <pre>
{`   _  __  ___  __  
  / |/ / / -_)/ _| 
 /_/|_|  \\__/ /_/   `}
        </pre>
        <button className="mt-4 px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-[10px] border border-white/10 transition-all">
          Generate
        </button>
      </div>
    </div>
  );
};

// --- ANALYTICS WIDGET ---
export const AnalyticsWidget = ({ onRemove }: WidgetProps) => {
  return (
    <div className="liquid-card glass-light-track h-full flex flex-col p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl overflow-hidden group transition-all duration-300 animate-fade-in" style={{
      background: 'linear-gradient(-45deg, rgba(34, 197, 94, 0.08), rgba(74, 222, 128, 0.06), rgba(34, 197, 94, 0.08))'
    }}>
      <div className="absolute inset-0 liquid-flow1" style={{
        background: 'linear-gradient(-45deg, rgba(34, 197, 94, 0.05), rgba(74, 222, 128, 0.03), rgba(34, 197, 94, 0.05))',
        pointerEvents: 'none'
      }} />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 icon-bg-success rounded-xl">
              <BarChart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="dashboard-muted text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Analytics</span>
          </div>
          {onRemove && (
             <button onClick={onRemove} className="p-1.5 hover:bg-red-500/15 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300">
               <Trash2 className="w-4 h-4" />
             </button>
          )}
        </div>

        <div className="flex-1">
           <div className="flex items-end gap-1 sm:gap-1.5 h-20 sm:h-24 mb-3 sm:mb-4 pt-3 sm:pt-4">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                 <div key={i} className="flex-1 rounded-t-lg relative group/bar bg-emerald-500/30 hover:bg-emerald-500/50 transition-all duration-300">
                    <div className="w-full bg-gradient-to-t from-emerald-500 to-green-400 rounded-t-lg" style={{ height: `${h}%` }} />
                 </div>
              ))}
           </div>
           <div className="flex justify-between items-center px-1">
              <span className="dashboard-muted text-[9px] sm:text-xs font-semibold">Total Sales</span>
              <span className="text-xs sm:text-sm font-bold text-green-500">+12.4%</span>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- NOTES WIDGET ---
export const NotesWidget = ({ onRemove }: WidgetProps) => {
  return (
    <div className="liquid-card glass-light-track h-full flex flex-col p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl overflow-hidden group transition-all duration-300 animate-fade-in" style={{
      background: 'linear-gradient(-45deg, rgba(237, 95, 43, 0.08), rgba(245, 122, 63, 0.06), rgba(245, 158, 11, 0.04))'
    }}>
      <div className="absolute inset-0 liquid-flow2" style={{
        background: 'linear-gradient(-45deg, rgba(237, 95, 43, 0.04), rgba(245, 122, 63, 0.02), rgba(245, 158, 11, 0.02))',
        pointerEvents: 'none'
      }} />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 icon-bg-warning rounded-xl">
              <StickyNote className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="dashboard-muted text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Quick Notes</span>
          </div>
          {onRemove && (
             <button onClick={onRemove} className="p-1.5 hover:bg-red-500/15 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-300">
               <Trash2 className="w-4 h-4" />
             </button>
          )}
        </div>

        <textarea 
          placeholder="Type something..."
          className="dashboard-soft flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-medium placeholder:text-gray-400 resize-none h-full relative z-10 focus:ring-0"
        />
      </div>
    </div>
  );
};

// --- WIDGET MAP ---
export const WIDGET_COMPONENTS: Record<string, React.FC<WidgetProps>> = {
  calendar: CalendarWidget,
  tools: ImageToolsWidget,
  ascii: ASCIIWidget,
  analytics: AnalyticsWidget,
  notes: NotesWidget,
};
