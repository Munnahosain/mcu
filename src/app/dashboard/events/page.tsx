"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, DownloadCloud, Heart, Sparkles, MapPin, Tag, Plus, X, Globe, Image as ImageIcon, Search, Copy, Check, ClipboardCopy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAllEvents, CalendarEvent, EventCategory } from "@/data/events2026";
import { getActiveProvider, getProviderModels, syncProviderKeys } from "@/lib/ai-settings";
import SegmentedToggle from "@/components/ui/SegmentedToggle";
import Link from "next/link";

interface GeneratedIdeaData {
  uploader_insight?: {
    orientation?: string;
    content_style?: string;
    advice?: string;
  };
  stock_ideas?: string[];
  keywords?: string[];
  prompts?: string[];
  captions?: string[];
}

interface CustomEventForm {
  title: string;
  date: string;
  category: EventCategory;
  country: string;
}

export default function EventCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // Default for SSR
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // Start null to show all events in the month by default 
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // User Data
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  
  // Modals
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [activeEventForIdea, setActiveEventForIdea] = useState<CalendarEvent | null>(null);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [generatedIdeaData, setGeneratedIdeaData] = useState<GeneratedIdeaData | null>(null);
  const [ideaError, setIdeaError] = useState("");
  const [ideaProvider, setIdeaProvider] = useState("Groq");
  const [copiedItem, setCopiedItem] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [newCustomEvent, setNewCustomEvent] = useState<CustomEventForm>({ title: '', date: '', category: 'Custom', country: 'Global' });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const copyPlannerText = async (text: string, item: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setCopyFeedback(item === "all" ? "Planner content copied." : "Copied to clipboard.");
      window.setTimeout(() => setCopiedItem((current) => current === item ? "" : current), 1800);
      window.setTimeout(() => setCopyFeedback(""), 2500);
    } catch (error) {
      console.error("[Event Planner] Clipboard copy failed:", error);
      setCopiedItem("");
      setCopyFeedback("Could not copy. Check clipboard permissions and try again.");
    }
  };

  const getPlannerCopyText = (data: GeneratedIdeaData) => {
    const sections = [
      ["UPLOADER INSIGHT", [
        data.uploader_insight?.orientation ? `Orientation: ${data.uploader_insight.orientation}` : "",
        data.uploader_insight?.content_style ? `Content style: ${data.uploader_insight.content_style}` : "",
        data.uploader_insight?.advice || "",
      ].filter(Boolean).join("\n")],
      ["STOCK IMAGE CONCEPTS", (data.stock_ideas || []).map((idea, index) => `${index + 1}. ${idea}`).join("\n")],
      ["KEYWORDS", (data.keywords || []).join(", ")],
      ["AI GENERATION PROMPTS", (data.prompts || []).map((prompt, index) => `${index + 1}. ${prompt}`).join("\n\n")],
      ["SOCIAL MEDIA CAPTIONS", (data.captions || []).map((caption, index) => `${index + 1}. ${caption}`).join("\n\n")],
    ];
    return sections.filter(([, content]) => content).map(([title, content]) => `${title}\n${content}`).join("\n\n");
  };
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const categories = ["All", "Global Holidays", "Marketing Events", "Social Media Days", "Stock Content Ideas", "Religious Events", "Custom"];

  useEffect(() => {
     // Dynamically set to real current month/year
     const today = new Date();
     setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
     
     const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
     setNewCustomEvent((prev) => ({ ...prev, date: todayStr }));

     const favs = localStorage.getItem('event_favorites');
     if (favs) setFavorites(JSON.parse(favs));
     const custom = localStorage.getItem('event_custom');
     if (custom) setCustomEvents(JSON.parse(custom));
  }, []);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFavorites(prev => {
          const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
          localStorage.setItem('event_favorites', JSON.stringify(newFavs));
          return newFavs;
      });
  };

  const handleAddCustomEvent = () => {
      if (!newCustomEvent.title || !newCustomEvent.date) return;
      
      const newEvent: CalendarEvent = {
          id: `custom-${crypto.randomUUID()}`,
          ...newCustomEvent,
          isCustom: true
      };
      
      setCustomEvents(prev => {
          const updated = [...prev, newEvent];
          localStorage.setItem('event_custom', JSON.stringify(updated));
          return updated;
      });
      setAddCustomModalOpen(false);
      setNewCustomEvent({ 
          title: '', 
          date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, 
          category: 'Custom', 
          country: 'Global' 
      });
  };

  const totalEvents = useMemo(() => {
     return [...getAllEvents(currentYear), ...customEvents];
  }, [currentYear, customEvents]);

  const uniqueCountries = useMemo(() => {
      const set = new Set(totalEvents.map(e => e.country).filter(Boolean) as string[]);
      return ["All", ...Array.from(set)];
  }, [totalEvents]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const setMonthDirectly = (monthIndex: number) => {
    setCurrentDate(new Date(currentYear, monthIndex, 1));
    setSelectedDate(null);
  };

  // Calendar Engine mappings
  const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  const daysInPrevMonth = getDaysInMonth(currentYear, currentMonth - 1);

  const calendarCells = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({ date: new Date(currentYear, currentMonth - 1, daysInPrevMonth - i), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({ date: new Date(currentYear, currentMonth, i), isCurrentMonth: true });
  }
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ date: new Date(currentYear, currentMonth + 1, i), isCurrentMonth: false });
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    totalEvents.forEach(event => {
       if (selectedCategory !== "All" && event.category !== selectedCategory) return;
       if (selectedCountry !== "All" && event.country !== selectedCountry) return;

       const list = map.get(event.date) || [];
       list.push(event);
       map.set(event.date, list);
    });
    return map;
  }, [selectedCategory, selectedCountry, totalEvents]);

  const hasEvent = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return eventsByDate.has(dateStr);
  };

  const displayedEvents = useMemo(() => {
    const filtered = totalEvents.filter(e => {
        if (selectedCategory !== "All" && e.category !== selectedCategory) return false;
        if (selectedCountry !== "All" && e.country !== selectedCountry) return false;
        if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase()) && !e.category.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        
        const eDate = new Date(e.date);
        
        // Always constrain to the viewed month/year in right panel
        if (eDate.getMonth() !== currentMonth || eDate.getFullYear() !== currentYear) return false;

        // If a specific date is selected in the grid, only show that day
        if (selectedDate && (eDate.getDate() !== selectedDate.getDate() || eDate.getMonth() !== selectedDate.getMonth())) {
            return false;
        }
        
        return true;
    });

    return [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [currentMonth, currentYear, selectedDate, selectedCategory, selectedCountry, searchQuery, totalEvents]);

  const totalMonthEventsCount = useMemo(() => {
      let count = 0;
      totalEvents.forEach(e => {
          const eDate = new Date(e.date);
          if (eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear 
              && (selectedCategory === "All" || e.category === selectedCategory)
              && (selectedCountry === "All" || e.country === selectedCountry)
              && (!searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.category.toLowerCase().includes(searchQuery.toLowerCase()))) {
             count++;
          }
      });
      return count;
  }, [currentMonth, currentYear, selectedCategory, selectedCountry, searchQuery, totalEvents]);

  const startIdeaGeneration = async (event: CalendarEvent) => {
      const activeProvider = getActiveProvider();
      setActiveEventForIdea(event);
      setIdeaModalOpen(true);
      setGeneratedIdeaData(null);
      setIdeaError("");
      setIdeaProvider(activeProvider);
      setIsGeneratingIdea(true);

      try {
         const providerKeys = await syncProviderKeys();
         const activeKeyObj = providerKeys.find((k) => k.provider === activeProvider);
         const activeModel = getProviderModels()[activeProvider] || '';

         const response = await fetch('/api/generate-event-ideas', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                eventTitle: event.title,
                eventCategory: event.category,
                eventDate: event.date,
                ...(activeKeyObj?.key ? { apiKey: activeKeyObj.key } : {}),
                provider: activeProvider,
                model: activeModel
            })
         });

         const data = await response.json() as { success?: boolean; data?: GeneratedIdeaData; error?: string };
         if (!response.ok || !data.success || !data.data) {
           throw new Error(data.error || `Unable to generate event ideas (HTTP ${response.status}).`);
         }

         setGeneratedIdeaData(data.data);
         window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
      } catch (err: unknown) {
         console.error(err);
         setIdeaError(err instanceof Error ? err.message : 'Failed to generate event ideas');
      } finally {
         setIsGeneratingIdea(false);
      }
  };

  const exportCSV = () => {
    if (!totalEvents.length) return;
    const esc = (value: string) => `"${(value||'').replace(/"/g, '""')}"`;
    const lines = [
        "Date,Event Title,Category,Country,Favorite,IsCustom",
        ...totalEvents.map((e) => [
            esc(e.date), esc(e.title), esc(e.category), esc(e.country||''), 
            favorites.includes(e.id) ? 'Yes' : 'No', 
            e.isCustom ? 'Yes' : 'No'
        ].join(","))
    ];

    try {
      const csvContent = lines.join("\r\n");
      const fileName = `mcustock_events_calendar_${currentYear}.csv`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("CSV download failed. Please try again.");
    }
  };

  return (
    <div className="dashboard-liquid-page flex flex-col w-full bg-[#fafaf8] dark:bg-[#0f0d0b] p-4 sm:p-6 lg:p-10 font-sans min-h-full">
      
      {/* Page Header */}
      <div className="max-w-6xl mx-auto w-full flex flex-col items-center justify-center text-center space-y-4 mb-10 pt-4 relative">
        <div className="order-first flex flex-col items-center gap-4">
          <button
            onClick={() => setAddCustomModalOpen(true)}
            className="event-add-button liquid-button-primary relative -top-1 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-md sm:absolute sm:right-0 sm:top-0"
          >
              <Plus className="w-4 h-4" /> Add Event
          </button>
          <div className="liquid-chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#1a1814] border border-gray-200 dark:border-white/10 shadow-sm">
            <CalendarIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tracking-wide">AI Event Planner</span>
          </div>
        </div>
        <h1 className="max-w-full break-words px-2 text-3xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl md:text-5xl">Event Calendar {currentYear}</h1>
        <p className="max-w-lg px-3 text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400 md:px-0 md:text-base">Discover important events globally and generate smart stock concepts using AI.</p>
        
      </div>

      <div className="max-w-6xl mx-auto w-full flex flex-col items-center">
        
        {/* Main Interface Layout */}
        <div className="event-panels-grid w-full grid grid-cols-1 min-[760px]:grid-cols-2 gap-6 lg:gap-8 items-stretch">

            {/* LEFTSIDE: Calendar Card */}
            <div className="event-calendar-card dashboard-liquid-card glass-light-track bg-white dark:bg-[#1a1814] rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/10 w-full lg:flex-1 flex flex-col shrink-0 min-[760px]:h-[640px] z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6 shrink-0">
                    <button onClick={handlePrevMonth} className="dashboard-liquid-ghost p-2 rounded-full text-gray-600 dark:text-gray-300 hover:text-[#ED5F2B]">
                       <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">{fullMonths[currentMonth]} {currentYear}</h2>
                    <button onClick={handleNextMonth} className="dashboard-liquid-ghost p-2 rounded-full text-gray-600 dark:text-gray-300 hover:text-[#ED5F2B]">
                       <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5" />
                    </button>
                </div>

                {/* Days Label Header */}
                <div className="grid grid-cols-7 gap-1 mb-3 sm:mb-4 shrink-0">
                    {daysOfWeek.map(day => (
                        <div key={day} className="text-center text-[9px] sm:text-[11px] font-bold text-gray-400 tracking-widest">{day}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-1 sm:gap-y-2 gap-x-1 sm:gap-x-2 flex-1">
                    {calendarCells.map((cell, i) => {
                        const isSelected = selectedDate && cell.date.getDate() === selectedDate.getDate() && cell.date.getMonth() === selectedDate.getMonth();
                        const isEventDay = hasEvent(cell.date);
                        const isCurrentMonth = cell.isCurrentMonth;
                        
                        return (
                            <div key={i} className="flex items-center justify-center">
                                <button
                                    onClick={() => {
                                        if (!isCurrentMonth) {
                                           setCurrentDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                                        }
                                        if (isSelected) {
                                            setSelectedDate(null); 
                                        } else {
                                            setSelectedDate(cell.date);
                                        }
                                    }}
                                    className={`relative w-full aspect-square flex flex-col items-center justify-center rounded-[10px] text-xs sm:text-sm font-semibold transition-all
                                        ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}
                                        ${isEventDay && !isSelected ? 'dashboard-liquid-ghost' : ''}
                                        ${isSelected ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' : 'hover:bg-gray-50 dark:hover:bg-white/5'}
                                    `}
                                >
                                    {cell.date.getDate()}
                                    {isEventDay && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#ED5F2B]"></span>}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* RIGHTSIDE: Event List Card */}
            <div className="event-list-card dashboard-liquid-card glass-light-track bg-white dark:bg-[#1a1814] rounded-[24px] p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-white/10 w-full lg:flex-1 flex flex-col min-[760px]:h-[640px]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-white/10 shrink-0 gap-4">
                    <div>
                         <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
                             {selectedDate ? `${selectedDate.getDate()} ${fullMonths[selectedDate.getMonth()]} Events` : `${fullMonths[currentMonth]} Events`}
                         </h2>
                         <p className="text-xs sm:text-sm text-gray-500 font-medium">
                             {selectedDate ? `${displayedEvents.length} events today` : `${totalMonthEventsCount} events this month`}
                         </p>
                    </div>
                    
                    <button onClick={exportCSV} title="Download Event List as CSV" className="dashboard-liquid-ghost p-2 sm:p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-[#ED5F2B] shrink-0">
                        <DownloadCloud className="w-4 h-4" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6 w-full shrink-0">
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search events..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="dashboard-liquid-input w-full rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none"
                        />
                    </div>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="dashboard-liquid-select rounded-xl px-4 py-2 text-xs font-bold outline-none appearance-none cursor-pointer"
                    >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select 
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="dashboard-liquid-select rounded-xl px-4 py-2 text-xs font-bold outline-none appearance-none cursor-pointer"
                    >
                        {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                    {displayedEvents.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 opacity-60">
                            <CalendarIcon className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="font-semibold text-gray-500">No events found.</p>
                            <p className="text-sm text-gray-400 mt-1">Try selecting a different date or filter.</p>
                        </div>
                    ) : (
                        <AnimatePresence>
                            {displayedEvents.map(event => {
                                const eDate = new Date(event.date);
                                const isFav = favorites.includes(event.id);
                                return (
                                <motion.div 
                                    layout
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    key={event.id}
                                    className="event-list-row dashboard-liquid-card glass-light-track group flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#f8f9fa] dark:bg-white/[0.03] p-3 sm:pr-6 rounded-[18px] border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all relative shadow-sm hover:shadow"
                                >
                                    <div className="flex items-center justify-center flex-col shrink-0 w-14 h-14 bg-white dark:bg-black rounded-[14px] shadow-sm border border-gray-100 dark:border-white/5">
                                        <div className="text-[17px] font-bold text-gray-900 dark:text-white leading-none">{eDate.getDate()}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{months[eDate.getMonth()]}</div>
                                    </div>
                                    
                                    <div className="flex-1 w-full min-w-0 pr-4">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate mb-1 flex items-center gap-2">
                                            {event.title}
                                            {event.isCustom && <span className="bg-[#ED5F2B]/20 text-[#ED5F2B] text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-widest border border-[#ED5F2B]/30">Custom</span>}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wide border ${event.category === 'Global Holidays' ? 'bg-blue-100 dark:bg-[#388DC6]/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-[#388DC6]/40' : event.category === 'Marketing Events' ? 'bg-orange-100 dark:bg-[#ED5F2B]/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-[#ED5F2B]/40' : event.category === 'Social Media Days' ? 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-500/40' : event.category === 'Stock Content Ideas' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-white/20'}`}>{event.category}</span>
                                            {event.country && (
                                                <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{event.country}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end mt-2 sm:mt-0">
                                        <button onClick={(e) => toggleFavorite(event.id, e)} title="Favorite" className={`dashboard-liquid-ghost p-2 rounded-full ${isFav ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
                                           <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                                        </button>
                                        <button onClick={() => startIdeaGeneration(event)} title="Generate Content Ideas" className="liquid-button-primary flex items-center gap-1.5 px-3 py-1.5 !text-white rounded-full text-[11px] font-bold shadow-sm">
                                            <Sparkles className="w-3.5 h-3.5" /> AI Planner
                                        </button>
                                    </div>
                                </motion.div>
                            )})}
                        </AnimatePresence>
                    )}
                </div>
            </div>

        </div>

        {/* BOTTOM: Month Selector Nav Pill */}
        <div className="event-month-selector mt-8 mb-10 overflow-x-auto w-full max-w-full flex justify-center no-scrollbar px-4">
            <SegmentedToggle<number>
                options={months.map((month, idx) => ({ id: idx, label: month }))}
                value={currentMonth}
                onChange={(monthIndex) => setMonthDirectly(monthIndex)}
                size="sm"
                className="event-month-toggle min-w-[900px]"
                ariaLabel="Select event month"
            />
        </div>

      </div>

      {typeof document !== "undefined" ? createPortal(
        <>
          {/* IDEA GENERATOR MODAL */}
          <AnimatePresence>
         {ideaModalOpen && activeEventForIdea && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGeneratingIdea && setIdeaModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="dashboard-liquid-panel relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
                     
                     <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-white/10 sm:px-7">
                         <div className="flex min-w-0 items-start gap-3">
                             <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                 <Sparkles className="h-5 w-5" />
                             </div>
                             <div className="min-w-0">
                                 <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Event strategy</p>
                                 <h3 className="mt-0.5 text-lg font-bold leading-tight text-gray-900 dark:text-white">AI Content Planner</h3>
                                 <p className="mt-1 truncate text-xs font-medium text-gray-500 dark:text-gray-400">{activeEventForIdea.title}</p>
                                 {generatedIdeaData ? (
                                   <div className="mt-2 flex flex-wrap gap-1.5">
                                     <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">{activeEventForIdea.category}</span>
                                     <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">{activeEventForIdea.date}</span>
                                   </div>
                                 ) : null}
                             </div>
                         </div>
                         <div className="flex shrink-0 items-center gap-2">
                           {generatedIdeaData ? (
                             <button
                               type="button"
                               onClick={() => void copyPlannerText(getPlannerCopyText(generatedIdeaData), "all")}
                               className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-600 transition hover:border-primary/40 hover:text-primary dark:border-white/10 dark:text-gray-300"
                             >
                               {copiedItem === "all" ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                               <span className="hidden sm:inline">{copiedItem === "all" ? "Copied" : "Copy all"}</span>
                             </button>
                           ) : null}
                           <button onClick={() => setIdeaModalOpen(false)} disabled={isGeneratingIdea} aria-label="Close content planner" className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white">
                               <X className="h-5 w-5" />
                           </button>
                         </div>
                     </div>

                     <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 custom-scrollbar sm:px-7">
                     {isGeneratingIdea ? (
                         <div className="flex min-h-64 flex-col items-center justify-center">
                             <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
                             <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{ideaProvider} is analyzing the event...</p>
                         </div>
                     ) : ideaError ? (
                         <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-center">
                             <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-300">{ideaError}</p>
                             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                               Check the selected provider and saved key in Generator settings, then retry.
                             </p>
                             <div className="mt-4 flex flex-wrap justify-center gap-3">
                               <button
                                 type="button"
                                 onClick={() => activeEventForIdea && void startIdeaGeneration(activeEventForIdea)}
                                 className="liquid-button-primary rounded-xl px-4 py-2 text-sm font-bold"
                               >
                                 Retry
                               </button>
                               <Link
                                 href="/dashboard/generator"
                                 onClick={() => setIdeaModalOpen(false)}
                                 className="dashboard-liquid-ghost rounded-xl px-4 py-2 text-sm font-bold"
                               >
                                 Open Generator
                               </Link>
                             </div>
                         </div>
                     ) : generatedIdeaData ? (
                         <div className="space-y-5">
                             {copyFeedback ? (
                               <p aria-live="polite" className={`text-xs font-medium ${copiedItem ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-300"}`}>{copyFeedback}</p>
                             ) : null}
                             {generatedIdeaData.uploader_insight ? (
                               <section className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4 sm:p-5">
                                 <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                                   <Globe className="h-4 w-4" /> Uploader insight
                                 </div>
                                 <div className="grid gap-3 sm:grid-cols-2">
                                   {generatedIdeaData.uploader_insight.orientation ? (
                                     <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">Orientation</span><span className="mx-2 text-gray-300 dark:text-gray-600">/</span>{generatedIdeaData.uploader_insight.orientation}</p>
                                   ) : null}
                                   {generatedIdeaData.uploader_insight.content_style ? (
                                     <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold text-gray-900 dark:text-white">Content style</span><span className="mx-2 text-gray-300 dark:text-gray-600">/</span>{generatedIdeaData.uploader_insight.content_style}</p>
                                   ) : null}
                                 </div>
                                 {generatedIdeaData.uploader_insight.advice ? (
                                   <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{generatedIdeaData.uploader_insight.advice}</p>
                                 ) : null}
                               </section>
                             ) : null}

                             <div className="grid gap-5 md:grid-cols-2">
                               {(generatedIdeaData.stock_ideas?.length ?? 0) > 0 ? (
                                 <section className="min-w-0">
                                   <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                     <ImageIcon className="h-4 w-4 text-primary" /> Stock image concepts
                                   </div>
                                   <ol className="space-y-2.5">
                                     {generatedIdeaData.stock_ideas?.map((idea, index) => {
                                       const itemKey = `idea-${index}`;
                                       return (
                                         <li key={itemKey} className="group flex gap-3 rounded-xl border border-gray-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
                                           <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{index + 1}</span>
                                           <p className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{idea}</p>
                                           <button type="button" onClick={() => void copyPlannerText(idea, itemKey)} aria-label={`Copy concept ${index + 1}`} title="Copy concept" className="h-fit rounded-md p-1.5 text-gray-400 transition hover:bg-primary/10 hover:text-primary">
                                             {copiedItem === itemKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                           </button>
                                         </li>
                                       );
                                     })}
                                   </ol>
                                 </section>
                               ) : null}
                               {(generatedIdeaData.keywords?.length ?? 0) > 0 ? (
                                 <section className="min-w-0">
                                   <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                     <Tag className="h-4 w-4 text-primary" /> High-value keywords
                                   </div>
                                   <div className="flex flex-wrap gap-2">
                                     {generatedIdeaData.keywords?.map((keyword, index) => {
                                       const itemKey = `keyword-${index}`;
                                       return (
                                         <button key={itemKey} type="button" onClick={() => void copyPlannerText(keyword, itemKey)} title={`Copy ${keyword}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gray-700 transition hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                                           <span className="break-words">{keyword}</span>
                                           {copiedItem === itemKey ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0 opacity-50" />}
                                         </button>
                                       );
                                     })}
                                   </div>
                                 </section>
                               ) : null}
                             </div>

                             {(generatedIdeaData.prompts?.length ?? 0) > 0 ? (
                               <section>
                                 <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                   <Sparkles className="h-4 w-4 text-primary" /> AI generation prompts
                                 </div>
                                 <div className="space-y-2.5">
                                   {generatedIdeaData.prompts?.map((prompt, index) => {
                                     const itemKey = `prompt-${index}`;
                                     return (
                                       <article key={itemKey} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                                         <div className="mb-2 flex items-center justify-between gap-3">
                                           <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Prompt {index + 1}</span>
                                           <button type="button" onClick={() => void copyPlannerText(prompt, itemKey)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-primary/10 hover:text-primary dark:text-gray-400">
                                             {copiedItem === itemKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                             {copiedItem === itemKey ? "Copied" : "Copy"}
                                           </button>
                                         </div>
                                         <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{prompt}</p>
                                       </article>
                                     );
                                   })}
                                 </div>
                               </section>
                             ) : null}

                             {(generatedIdeaData.captions?.length ?? 0) > 0 ? (
                               <section>
                                 <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                                   <Tag className="h-4 w-4 text-primary" /> Social media captions
                                 </div>
                                 <div className="space-y-2.5">
                                   {generatedIdeaData.captions?.map((caption, index) => {
                                     const itemKey = `caption-${index}`;
                                     return (
                                       <article key={itemKey} className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-500/15 dark:bg-emerald-500/[0.06]">
                                         <div className="mb-2 flex items-center justify-between gap-3">
                                           <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Caption {index + 1}</span>
                                           <button type="button" onClick={() => void copyPlannerText(caption, itemKey)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400">
                                             {copiedItem === itemKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                             {copiedItem === itemKey ? "Copied" : "Copy"}
                                           </button>
                                         </div>
                                         <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{caption}</p>
                                       </article>
                                     );
                                   })}
                                 </div>
                               </section>
                             ) : null}
                         </div>
                     ) : null}
                     </div>

                     {!isGeneratingIdea && (
                         <div className="border-t border-gray-200 px-5 py-3 dark:border-white/10 sm:px-7">
                         <button onClick={() => setIdeaModalOpen(false)} className="dashboard-liquid-ghost w-full rounded-xl py-3 text-sm font-bold">
                            Close Planner
                         </button>
                         </div>
                     )}
                 </motion.div>
             </div>
         )}
      </AnimatePresence>

          {/* ADD CUSTOM EVENT MODAL */}
          <AnimatePresence>
         {addCustomModalOpen && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddCustomModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="dashboard-liquid-panel relative w-full max-w-sm bg-white dark:bg-[#111] rounded-[24px] shadow-2xl border border-gray-100 dark:border-white/10 p-6 sm:p-8">
                     <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-6">Add Custom Event</h3>
                     <div className="space-y-4 mb-6">
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Event Title</label>
                             <input type="text" value={newCustomEvent.title} onChange={e=>setNewCustomEvent({...newCustomEvent, title: e.target.value})} className="dashboard-liquid-input w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" placeholder="E.g. Brand Anniversary" />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Date</label>
                             <input type="date" value={newCustomEvent.date} onChange={e=>setNewCustomEvent({...newCustomEvent, date: e.target.value})} className="dashboard-liquid-input w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Category</label>
                             <select value={newCustomEvent.category} onChange={e=>setNewCustomEvent({...newCustomEvent, category: e.target.value as EventCategory})} className="dashboard-liquid-select w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none">
                                 {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Country (Optional)</label>
                             <input type="text" value={newCustomEvent.country} onChange={e=>setNewCustomEvent({...newCustomEvent, country: e.target.value})} className="dashboard-liquid-input w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none" placeholder="E.g. USA, Global" />
                         </div>
                     </div>
                     <div className="flex gap-3">
                         <button onClick={() => setAddCustomModalOpen(false)} className="dashboard-liquid-ghost flex-1 py-3 font-bold text-sm rounded-xl">Cancel</button>
                         <button onClick={handleAddCustomEvent} disabled={!newCustomEvent.title || !newCustomEvent.date} className="liquid-button-primary flex-1 py-3 !text-white font-bold text-sm rounded-xl disabled:opacity-50 tracking-wide shadow-md">Save Event</button>
                     </div>
                 </motion.div>
             </div>
         )}
       </AnimatePresence>
        </>,
        document.body
      ) : null}
    </div>
  );
}
