"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, DownloadCloud, Heart, Sparkles, MapPin, Tag, Plus, X, Globe, Image as ImageIcon, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAllEvents, CalendarEvent, EventCategory } from "@/data/events2026";
import { getActiveProvider, getProviderKeys, getProviderModels, syncProviderKeys } from "@/lib/ai-settings";

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
  const [generatedIdeaData, setGeneratedIdeaData] = useState<any>(null);

  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [newCustomEvent, setNewCustomEvent] = useState<any>({ title: '', date: '', category: 'Custom', country: 'Global' });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysOfWeek = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const categories = ["All", "Global Holidays", "Marketing Events", "Social Media Days", "Stock Content Ideas", "Religious Events", "Custom"];

  useEffect(() => {
     // Dynamically set to real current month/year
     const today = new Date();
     setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
     
     const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
     setNewCustomEvent((prev: any) => ({ ...prev, date: todayStr }));

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
    let filtered = totalEvents.filter(e => {
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

    return filtered.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [currentMonth, currentYear, selectedDate, selectedCategory, selectedCountry, totalEvents]);

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
      setActiveEventForIdea(event);
      setIdeaModalOpen(true);
      setGeneratedIdeaData(null);
      setIsGeneratingIdea(true);

      try {
         const activeProvider = getActiveProvider();
         const providerKeys = await syncProviderKeys();
         const activeKeyObj = providerKeys.find((k) => k.provider === activeProvider);
         const activeModel = getProviderModels()[activeProvider] || '';
         
         if (!activeKeyObj?.key) {
             throw new Error(`API key required for ${activeProvider}. Please add one in the Generator tool's API Keys panel first.`);
         }

         const response = await fetch('/api/generate-event-ideas', {
            method: 'POST',
            body: JSON.stringify({ 
                eventTitle: event.title,
                eventCategory: event.category,
                eventDate: event.date,
                apiKey: activeKeyObj.key,
                provider: activeProvider,
                model: activeModel
            })
         });

         const data = await response.json();
         if (!data.success) throw new Error(data.error);

         setGeneratedIdeaData(data.data);
      } catch (err: any) {
         console.error(err);
         alert(err.message);
         setIdeaModalOpen(false);
      } finally {
         setIsGeneratingIdea(false);
      }
  };

  const exportCSV = () => {
    if (!totalEvents.length) return;
    const esc = (value: string) => `"${(value||'').replace(/"/g, '""')}"`;
    let lines = [
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
        <button onClick={() => setAddCustomModalOpen(true)} className="liquid-button-primary hidden sm:flex absolute right-0 top-0 items-center gap-2 px-4 py-2 text-white rounded-full text-xs font-bold shadow-md">
            <Plus className="w-4 h-4" /> Add Event
        </button>
        <div className="liquid-chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#1a1814] border border-gray-200 dark:border-white/10 shadow-sm">
          <CalendarIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tracking-wide">AI Event Planner</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">Event Calendar {currentYear}</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm md:text-base max-w-lg leading-relaxed">Discover important events globally and generate smart stock concepts using AI.</p>
        
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
            <div className="inline-flex items-center gap-1 p-2 rounded-full border border-primary/20 bg-primary/5 max-w-full shrink-0 shadow-inner">
                {months.map((month, idx) => (
                    <motion.button
                        key={month}
                        onClick={() => setMonthDirectly(idx)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className={`event-month-button rounded-full px-5 sm:px-6 py-2.5 text-sm font-bold transition-all duration-200 relative min-w-[72px] ${idx === currentMonth ? '!text-[#052716]' : 'text-primary/60 hover:text-primary'}`}
                    >
                        {idx === currentMonth && (
                            <motion.div layoutId="activeMonthPill" transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 rounded-full shadow-[0_4px_16px_rgba(22,199,132,0.3)] -z-10 bg-primary" />
                        )}
                        {month}
                    </motion.button>
                ))}
            </div>
        </div>

      </div>

      {/* IDEA GENERATOR MODAL */}
      <AnimatePresence>
         {ideaModalOpen && activeEventForIdea && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isGeneratingIdea && setIdeaModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                 <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="dashboard-liquid-panel relative w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#111] rounded-[24px] shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col p-6 sm:p-8">
                     
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-3">
                             <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                 <Sparkles className="w-5 h-5" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">AI Content Planner</h3>
                                 <p className="text-xs text-gray-500 font-medium">Smart strategy for {activeEventForIdea.title}</p>
                             </div>
                         </div>
                         <button onClick={() => setIdeaModalOpen(false)} disabled={isGeneratingIdea} className="text-gray-400 hover:text-gray-600 dark:hover:text-white disabled:opacity-50">
                             <X className="w-5 h-5" />
                         </button>
                     </div>

                     {isGeneratingIdea ? (
                         <div className="flex flex-col items-center justify-center py-20">
                             <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full mb-4" />
                             <p className="text-sm font-bold text-gray-500">Groq AI is analyzing the event...</p>
                         </div>
                     ) : generatedIdeaData ? (
                         <div className="space-y-6">
                             {/* Smart Stock Mode */}
                             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-white/[0.05] dark:to-white/[0.02] border border-blue-100 dark:border-white/10 rounded-2xl p-5">
                                <h4 className="font-bold text-gray-900 dark:text-blue-300 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Globe className="w-4 h-4 opacity-70" /> Uploader Insight
                                </h4>
                                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium space-y-1.5">
                                    <p><strong className="text-gray-900 dark:text-white">Orientation:</strong> {generatedIdeaData.uploader_insight?.orientation}</p>
                                    <p><strong className="text-gray-900 dark:text-white">Content Style:</strong> {generatedIdeaData.uploader_insight?.content_style}</p>
                                    <p className="mt-2 text-gray-600 dark:text-gray-400 border-l-2 border-blue-200 dark:border-blue-800 pl-3 py-1 italic">{generatedIdeaData.uploader_insight?.advice}</p>
                                </div>
                             </div>

                             {/* Ideas and Keywords */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                     <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Stock Image Concepts</h5>
                                     <ul className="text-sm font-medium text-gray-700 dark:text-gray-300 space-y-2 pl-4 list-disc marker:text-blue-500">
                                         {generatedIdeaData.stock_ideas?.map((idea: string, idx: number) => <li key={idx}>{idea}</li>)}
                                     </ul>
                                 </div>
                                 <div>
                                     <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> High-Value Keywords</h5>
                                     <div className="flex flex-wrap gap-2">
                                         {generatedIdeaData.keywords?.map((k: string) => (
                                             <span key={k} className="px-2.5 py-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200 dark:border-transparent drop-shadow-sm">{k}</span>
                                         ))}
                                     </div>
                                 </div>
                             </div>

                             {/* Prompts and Captions */}
                             <div className="space-y-4">
                                 <div>
                                     <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Generation Prompts</h5>
                                     {generatedIdeaData.prompts?.map((prompt: string, idx: number) => (
                                         <div key={idx} className="bg-gray-100 dark:bg-black/50 p-4 border border-gray-200 dark:border-white/10 rounded-xl mb-3 text-xs text-gray-800 dark:text-gray-300 leading-relaxed font-medium">
                                             {prompt}
                                         </div>
                                     ))}
                                 </div>
                                 <div>
                                     <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Social Media Captions</h5>
                                     {generatedIdeaData.captions?.map((cap: string, idx: number) => (
                                         <div key={idx} className="bg-green-50 dark:bg-green-900/10 p-3 border border-green-200 dark:border-green-500/20 rounded-xl mb-3 text-xs text-green-800 dark:text-green-300 leading-relaxed font-medium">
                                             {cap}
                                         </div>
                                     ))}
                                 </div>
                             </div>

                         </div>
                     ) : null}

                     {!isGeneratingIdea && (
                         <button onClick={() => setIdeaModalOpen(false)} className="dashboard-liquid-ghost w-full mt-6 py-3.5 font-bold text-sm rounded-xl">
                            Close Planner
                         </button>
                     )}
                 </motion.div>
             </div>
         )}
      </AnimatePresence>

      {/* ADD CUSTOM EVENT MODAL */}
      <AnimatePresence>
         {addCustomModalOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
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
                             <select value={newCustomEvent.category} onChange={e=>setNewCustomEvent({...newCustomEvent, category: e.target.value})} className="dashboard-liquid-select w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none appearance-none">
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
    </div>
  );
}
