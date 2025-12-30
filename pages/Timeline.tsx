
import React, { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useWorld } from '../context/WorldContext';
import { useView } from '../context/ViewContext'; // Import
import { I18N } from '../constants';
import { Entity, CalendarConfig } from '../types';
import { Plus, Search, Filter, Calendar, Settings, Pin, AlignLeft, MoveHorizontal, ZoomIn, ZoomOut, History, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Eye, EyeOff, MoreHorizontal, AlignJustify } from 'lucide-react';
import EntityEditor from '../components/EntityEditor';
import TagFilter from '../components/TagFilter';

// --- Types & Utilities ---

interface TimelineItem {
    entity: Entity;
    score: number;
    startYear: number;
    endYear?: number;
    duration: number;
    isRange: boolean;
    displayInfo: { main: string; era?: string };
    color: string;
}

// Sticky Configuration State
interface StickyConfig {
    showDates: boolean;
    showDescription: boolean;
    showJumpControls: boolean;
    maxLines: number; 
}

// Helper: Get Attribute
const getAttr = (e: Entity, keys: string[]) => e.attributes.find(a => keys.includes(a.key.toLowerCase().trim()))?.value;

// Helper: Parse Year safely
const parseYear = (val: string | undefined): number | null => {
    if (!val) return null;
    const match = val.match(/-?\d+/);
    if (match) {
        let y = parseInt(match[0]);
        if (val.toUpperCase().includes('BC') || val.toUpperCase().includes('B.C.')) y = -y;
        return y;
    }
    return null;
};

// Helper: Process Entity into TimelineItem
const processEntity = (e: Entity, config: CalendarConfig, categories: any[]): TimelineItem | null => {
    const startStr = getAttr(e, ['year', 'date', '年份', 'start year']);
    const startYear = parseYear(startStr);
    
    if (startYear === null) return null;

    const endStr = getAttr(e, ['end year', 'end date', '结束年份']);
    const endYear = parseYear(endStr);
    const isRange = endYear !== null && endYear !== startYear;
    const duration = isRange ? Math.abs(endYear! - startYear) : 0;
    
    const era = getAttr(e, ['era', 'epoch', 'age', '纪元']);
    const cat = categories.find(c => c.id === e.categoryId);

    let displayMain = `${isNaN(startYear) ? startStr : startYear}`;
    if (isRange) displayMain += ` — ${endYear}`;

    let score = startYear * 10000;
    if (config.useEras && era) {
        const eraIdx = config.eras.findIndex(er => er.name === era);
        if (eraIdx >= 0) score += eraIdx * 100000000;
    }

    return {
        entity: e,
        score,
        startYear,
        endYear: isRange ? endYear! : undefined,
        duration,
        isRange,
        displayInfo: { main: displayMain, era },
        color: e.customColor || cat?.color || '#94a3b8'
    };
};

// --- Virtualized Ruler Component ---
const TimeRuler = React.memo(({ min, max, scale, mode, viewportStart, viewportSize }: { min: number, max: number, scale: number, mode: 'vertical' | 'horizontal', viewportStart: number, viewportSize: number }) => {
    
    let interval = 1;
    if (scale < 0.5) interval = 1000;
    else if (scale < 2) interval = 100;
    else if (scale < 10) interval = 50;
    else if (scale < 20) interval = 10;
    else interval = 1;

    const visibleYearStart = min + (viewportStart / scale);
    const visibleYearEnd = min + ((viewportStart + viewportSize) / scale);

    const buffer = (viewportSize / scale) * 0.5; 
    const renderStartYear = Math.max(min, Math.floor((visibleYearStart - buffer) / interval) * interval);
    const renderEndYear = Math.min(max, Math.ceil((visibleYearEnd + buffer) / interval) * interval);

    const ticks = [];
    for (let y = renderStartYear; y <= renderEndYear; y += interval) {
        const pos = (y - min) * scale;
        ticks.push({ year: y, pos });
    }

    return (
        <div className={`absolute pointer-events-none select-none z-0 ${mode === 'vertical' ? 'left-[60px] top-0 bottom-0 w-full border-l-2 border-dashed border-gray-200' : 'top-[60px] left-0 right-0 h-full border-t-2 border-dashed border-gray-200'}`}>
            {ticks.map(t => (
                <div 
                    key={t.year} 
                    className="absolute flex items-center justify-center"
                    style={mode === 'vertical' 
                        ? { top: t.pos, left: -6, width: '100%' } 
                        : { left: t.pos, top: -6, height: '100%' }
                    }
                >
                    <div className={`bg-gray-300 ${mode === 'vertical' ? 'w-3 h-px' : 'h-3 w-px'}`}></div>
                    <div className={`text-[10px] text-gray-400 font-mono absolute ${mode === 'vertical' ? 'left-[-45px] text-right w-10' : 'top-[-20px] text-center w-12'}`}>
                        {t.year}
                    </div>
                    <div className={`absolute bg-gray-50 -z-10 ${mode === 'vertical' ? 'left-0 right-0 h-px' : 'top-0 bottom-0 w-px'}`} style={{ opacity: 0.5 }}></div>
                </div>
            ))}
        </div>
    );
});

// --- Settings Modals ---
const CalendarSettingsModal = ({ onClose, language }: { onClose: () => void, language: string }) => {
    const { data, updateCalendar } = useWorld();
    const [eras, setEras] = useState(data.calendarConfig?.eras || []);

    const handleSave = () => {
        const currentConfig = data.calendarConfig || { eras: [], months: [], daysInYear: 365, useEras: true };
        updateCalendar({ ...currentConfig, eras: eras });
        onClose();
    };

    const updateEra = (index: number, field: string, value: any) => {
        const newEras = [...eras];
        newEras[index] = { ...newEras[index], [field]: value };
        setEras(newEras);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center"><Calendar className="w-5 h-5 mr-2 text-primary-600" />{I18N.calendar_settings[language]}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><Settings className="w-5 h-5" /></button>
                </div>
                <div className="mb-4">
                    <h4 className="text-sm font-bold text-gray-600 uppercase mb-2">{I18N.era_config[language]}</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                        {eras.map((era, idx) => (
                            <div key={era.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                                <input value={era.name} onChange={(e) => updateEra(idx, 'name', e.target.value)} className="flex-1 text-sm bg-transparent border-b border-gray-300 px-1 outline-none" />
                                <input type="number" value={era.startYear || ''} onChange={(e) => updateEra(idx, 'startYear', parseInt(e.target.value))} className="w-20 text-xs bg-white border border-gray-200 rounded px-1" placeholder="Start" />
                                <input type="number" value={era.endYear || ''} onChange={(e) => updateEra(idx, 'endYear', parseInt(e.target.value))} className="w-20 text-xs bg-white border border-gray-200 rounded px-1" placeholder="End" />
                                <button onClick={() => setEras(eras.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setEras([...eras, { id: crypto.randomUUID(), name: 'New Era' }])} className="mt-2 text-xs text-primary-600 flex items-center"><Plus className="w-3 h-3 mr-1" />{I18N.add_era[language]}</button>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button onClick={handleSave} className="bg-primary-600 text-white px-4 py-2 rounded-lg">{I18N.save[language]}</button>
                </div>
            </div>
        </div>
    );
};

// --- Timeline Component ---
const Timeline = () => {
  const { data, language, addEntity, updateEntity, deleteEntity } = useWorld();
  const { timelineState, setTimelineState } = useView(); // View Context

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  
  // Initialize from Context
  const [timeScale, setTimeScale] = useState(timelineState.scale); 
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>(timelineState.viewMode);
  const [stickyLabels, setStickyLabels] = useState(timelineState.stickyLabels); 
  
  const [showStickyConfig, setShowStickyConfig] = useState(false);
  const [stickyConfig, setStickyConfig] = useState<StickyConfig>({
      showDates: true,
      showDescription: false,
      showJumpControls: true,
      maxLines: 3, 
  });

  // Viewport State
  const [viewport, setViewport] = useState({ start: 0, size: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null); 
  const requestRef = useRef<number | null>(null);
  
  // Ref to track if we have restored scroll position for this mount lifecycle
  const hasRestoredScroll = useRef(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize viewport size
  useEffect(() => {
      if (scrollContainerRef.current) {
          setViewport({
              start: 0,
              size: viewMode === 'vertical' ? scrollContainerRef.current.clientHeight : scrollContainerRef.current.clientWidth
          });
      }
  }, [viewMode]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const start = viewMode === 'vertical' ? target.scrollTop : target.scrollLeft;
      const size = viewMode === 'vertical' ? target.clientHeight : target.clientWidth;

      if (!requestRef.current) {
          requestRef.current = requestAnimationFrame(() => {
              setViewport({ start, size });
              requestRef.current = null;
          });
      }
  };

  const scrollToPosition = (pixels: number) => {
      if (!scrollContainerRef.current) return;
      const target = Math.max(0, pixels - 100); 
      scrollContainerRef.current.scrollTo({
          [viewMode === 'vertical' ? 'top' : 'left']: target,
          behavior: 'smooth'
      });
  };

  const uniqueTags = useMemo(() => Array.from(new Set(data.entities.flatMap(e => e.tags))).sort(), [data.entities]);
  
  const processedData = useMemo(() => {
      let items = data.entities
        .map(e => processEntity(e, data.calendarConfig || { eras: [], months: [], daysInYear: 365, useEras: true }, data.categories))
        .filter((i): i is TimelineItem => i !== null);

      items = items.filter(i => {
          const matchSearch = i.entity.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.entity.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchCat = selectedCategory === 'all' || i.entity.categoryId === selectedCategory;
          const matchTag = selectedTag === 'all' || i.entity.tags.includes(selectedTag);
          return matchSearch && matchCat && matchTag;
      });

      items.sort((a, b) => a.startYear - b.startYear);
      return items;
  }, [data.entities, searchQuery, selectedCategory, selectedTag, data.calendarConfig]);

  const { minYear, maxYear, totalHeight } = useMemo(() => {
      if (processedData.length === 0) return { minYear: 0, maxYear: 100, totalHeight: 500 };
      const min = Math.min(...processedData.map(i => i.startYear)) - 20; 
      const max = Math.max(...processedData.map(i => i.endYear || i.startYear)) + 20;
      const span = max - min;
      return { minYear: min, maxYear: max, totalHeight: Math.max(span * timeScale, 800) };
  }, [processedData, timeScale]);

  // --- Track / Lane Packing Algorithm ---
  const layoutItems = useMemo(() => {
      const lanes: number[] = []; 
      const laneGap = 20;
      const baseOffset = viewMode === 'vertical' ? 120 : 100; 
      const laneStep = viewMode === 'vertical' ? 220 : 100; 

      return processedData.map(item => {
          const timePos = (item.startYear - minYear) * timeScale;
          const timeSpan = Math.max(item.duration * timeScale, 0); 
          const itemEndPos = timePos + (item.isRange ? timeSpan : 50); 
          
          let laneIndex = -1;
          for (let i = 0; i < lanes.length; i++) {
              if (lanes[i] + laneGap < timePos) {
                  laneIndex = i;
                  break;
              }
          }

          if (laneIndex === -1) {
              laneIndex = lanes.length;
              lanes.push(0);
          }
          lanes[laneIndex] = itemEndPos;
          const visualOffset = baseOffset + (laneIndex * laneStep);
          return { ...item, timePos, timeSpan, visualOffset, laneIndex };
      });
  }, [processedData, minYear, timeScale, viewMode]);

  // SCROLL RESTORATION LOGIC
  // We use useLayoutEffect and track 'layoutItems' to make sure content is calculated
  useLayoutEffect(() => {
      if (!scrollContainerRef.current) return;
      
      // If we haven't restored yet, and we have items (or even if empty, restore once), and context has a value
      if (!hasRestoredScroll.current && timelineState.scrollPosition > 0) {
           const target = scrollContainerRef.current;
           if (viewMode === 'vertical') {
              target.scrollTop = timelineState.scrollPosition;
           } else {
              target.scrollLeft = timelineState.scrollPosition;
           }
           // Verify if scroll actually happened (content must be large enough)
           // If we successfully set it, mark as done.
           hasRestoredScroll.current = true;
      }
  }, [layoutItems, timelineState.scrollPosition, viewMode]);

  // Save State on Unmount
  useEffect(() => {
      return () => {
          if (scrollContainerRef.current) {
              const pos = viewMode === 'vertical' ? scrollContainerRef.current.scrollTop : scrollContainerRef.current.scrollLeft;
              setTimelineState({
                  scrollPosition: pos,
                  scale: timeScale,
                  viewMode: viewMode,
                  stickyLabels: stickyLabels
              });
          }
      }
  }, [timeScale, viewMode, stickyLabels]);

  const maxVisualOffset = layoutItems.reduce((max, item) => Math.max(max, item.visualOffset), 0) + 320;
  const containerStyle = viewMode === 'vertical' 
      ? { height: totalHeight, width: Math.max(800, maxVisualOffset), minHeight: '100%' } 
      : { width: totalHeight, height: Math.max(600, maxVisualOffset), minWidth: '100%' };

  const handleEdit = (e: Entity) => { setEditingEntity(e); setIsEditorOpen(true); };
  const handleSave = (d: any) => { 
      if (editingEntity) updateEntity(editingEntity.id, d); else addEntity(d); 
      setIsEditorOpen(false); 
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in bg-gray-50/50">
      
      {/* --- Top Controls --- */}
      <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-center">
              <h1 className="text-3xl font-light text-gray-900 flex items-center">
                  <History className="w-8 h-8 mr-3 text-primary-600" />
                  {I18N.timeline_view[language]}
              </h1>
              <div className="flex gap-2">
                 <button onClick={() => setIsSettingsOpen(true)} className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 shadow-sm flex items-center gap-2 text-sm font-medium transition-colors">
                     <Settings className="w-4 h-4" /><span>{I18N.calendar_settings[language]}</span>
                 </button>
                 <button onClick={() => setIsEditorOpen(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm font-medium flex items-center">
                    <Plus className="w-4 h-4 mr-2" /> {I18N.create_event[language]}
                 </button>
              </div>
          </div>

          <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm items-center z-20">
              <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-gray-50 outline-none">
                      <option value="all">{I18N.all[language]}</option>
                      {data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
              <div className="w-40"><TagFilter tags={uniqueTags} selectedTag={selectedTag} onChange={setSelectedTag} language={language} /></div>
              <div className="relative flex-1 min-w-[200px]">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none" placeholder={I18N.search_placeholder[language]} />
              </div>
              
              <div className="h-6 w-px bg-gray-200 mx-2"></div>

              <div className="flex bg-gray-100 p-1 rounded-lg">
                 <button onClick={() => setViewMode('vertical')} className={`p-1.5 rounded ${viewMode === 'vertical' ? 'bg-white shadow text-primary-600' : 'text-gray-400'}`} title="Vertical"><AlignLeft className="w-4 h-4" /></button>
                 <button onClick={() => setViewMode('horizontal')} className={`p-1.5 rounded ${viewMode === 'horizontal' ? 'bg-white shadow text-primary-600' : 'text-gray-400'}`} title="Horizontal"><MoveHorizontal className="w-4 h-4" /></button>
              </div>

              {/* Sticky Label Toggle & Config */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg relative">
                  <button 
                      onClick={() => setStickyLabels(!stickyLabels)}
                      className={`p-1.5 rounded transition-colors ${stickyLabels ? 'bg-white shadow text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Toggle Sticky Labels"
                  >
                      <Pin className={`w-4 h-4 ${stickyLabels ? 'fill-current' : ''}`} />
                  </button>
                  {stickyLabels && (
                      <button 
                          onClick={() => setShowStickyConfig(!showStickyConfig)}
                          className={`p-1.5 rounded hover:bg-gray-200 text-gray-500 ${showStickyConfig ? 'bg-gray-200' : ''}`}
                      >
                          <MoreHorizontal className="w-4 h-4" />
                      </button>
                  )}
                  
                  {showStickyConfig && stickyLabels && (
                      <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 w-56 space-y-2 animate-in slide-in-from-top-2">
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input type="checkbox" checked={stickyConfig.showDates} onChange={e => setStickyConfig({...stickyConfig, showDates: e.target.checked})} className="rounded text-primary-600" /> {I18N.show_dates[language]}
                          </label>
                          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                              <input type="checkbox" checked={stickyConfig.showJumpControls} onChange={e => setStickyConfig({...stickyConfig, showJumpControls: e.target.checked})} className="rounded text-primary-600" /> {I18N.show_jump_controls[language]}
                          </label>
                          <div className="border-t border-gray-100 pt-2">
                             <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer mb-1">
                                  <input type="checkbox" checked={stickyConfig.showDescription} onChange={e => setStickyConfig({...stickyConfig, showDescription: e.target.checked})} className="rounded text-primary-600" /> {I18N.show_description[language]}
                              </label>
                              {stickyConfig.showDescription && (
                                  <div className="pl-5 pr-1">
                                      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                          <span>{I18N.max_lines[language]}</span>
                                          <span>{stickyConfig.maxLines}</span>
                                      </div>
                                      <input 
                                        type="range" min="1" max="10" step="1" 
                                        value={stickyConfig.maxLines} 
                                        onChange={e => setStickyConfig({...stickyConfig, maxLines: parseInt(e.target.value)})}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                      />
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
              </div>

              <div className="flex items-center gap-2 px-2 border-l border-gray-200 ml-2">
                  <ZoomOut className="w-4 h-4 text-gray-400" />
                  <input type="range" min="1" max="100" step="1" value={timeScale} onChange={(e) => setTimeScale(parseInt(e.target.value))} className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                  <ZoomIn className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400 w-12 text-right">{timeScale}px/y</span>
              </div>
          </div>
      </div>

      {/* --- Main Visualization Area --- */}
      <div 
        className="flex-1 relative overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-inner" 
        ref={containerRef}
      >
          {/* SCROLL CONTAINER: Attach Ref Here for scrollToPosition */}
          <div 
            className="absolute inset-0 overflow-auto custom-scrollbar" 
            onScroll={handleScroll}
            ref={scrollContainerRef}
          >
              
            {layoutItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p>{I18N.timeline_empty[language]}</p>
                </div>
            ) : (
                <div className="relative" style={containerStyle}>
                    {/* Ruler */}
                    <div className={viewMode === 'vertical' ? "absolute left-[60px] top-0 bottom-0 w-px bg-gray-300 z-10" : "absolute top-[60px] left-0 right-0 h-px bg-gray-300 z-10"}></div>
                    <TimeRuler min={minYear} max={maxYear} scale={timeScale} mode={viewMode} viewportStart={viewport.start} viewportSize={viewport.size} />

                    {/* Items */}
                    {layoutItems.map((item) => {
                        const { timePos, timeSpan, visualOffset, color } = item;
                        
                        // Positioning Styles
                        const groupStyle: React.CSSProperties = viewMode === 'vertical' 
                            ? { top: timePos, left: visualOffset } 
                            : { left: timePos, top: visualOffset };

                        // --- Sticky Logic ---
                        let labelOffset = 0;
                        let isStickyActive = false;
                        
                        if (stickyLabels && item.isRange && item.timeSpan > 100) {
                            const itemStart = timePos;
                            const itemEnd = timePos + timeSpan;
                            const viewStart = viewport.start;
                            // Add padding to calculation to make label appear earlier/disappear later
                            const viewEnd = viewport.start + viewport.size;

                            // If item is partially in view (Specifically, start is above/left of view)
                            if (itemEnd > viewStart && itemStart < viewStart + 100) { 
                                const scrolledPastStart = viewStart - itemStart;
                                if (scrolledPastStart > 0) {
                                    const padding = 20;
                                    const desiredOffset = scrolledPastStart + padding;
                                    // Stop before the end of the bar (minus label height approx 80-120px depending on content)
                                    const maxOffset = item.timeSpan - 120; 
                                    labelOffset = Math.min(desiredOffset, maxOffset);
                                    if (labelOffset > 0 && labelOffset < maxOffset) isStickyActive = true;
                                }
                            }
                        }

                        return (
                            <React.Fragment key={item.entity.id}>
                                <div className="absolute z-20 group transition-opacity" style={groupStyle}>
                                    
                                    {item.isRange ? (
                                        <>
                                            {/* --- The Range Bar --- */}
                                            <div 
                                                className={`absolute bg-gray-300 opacity-60 hover:opacity-100 transition-opacity rounded-full ${viewMode === 'vertical' ? 'w-2 -translate-x-1/2' : 'h-2 -translate-y-1/2'}`} 
                                                style={{ backgroundColor: color, [viewMode === 'vertical' ? 'height' : 'width']: Math.max(timeSpan, 4) }} 
                                            />
                                            
                                            {/* --- Endpoints --- */}
                                            <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 z-10" style={{backgroundColor: color}}></div>
                                            <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 z-10" style={{ backgroundColor: color, [viewMode === 'vertical' ? 'top' : 'left']: timeSpan }}></div>

                                            {/* --- Floating / Sticky Label --- */}
                                            <div 
                                                className={`absolute z-30 transition-transform duration-75 ease-out
                                                    ${viewMode === 'vertical' ? 'left-4' : 'top-4'}
                                                `}
                                                style={{
                                                    transform: viewMode === 'vertical' 
                                                        ? `translateY(${labelOffset}px)` 
                                                        : `translateX(${labelOffset}px)`
                                                }}
                                            >
                                                <div className={`
                                                    bg-white/95 backdrop-blur-md shadow-sm border border-gray-200 rounded-lg p-2 
                                                    flex flex-col gap-1 min-w-[140px] max-w-[240px]
                                                    ${isStickyActive ? 'border-l-4 shadow-md' : ''}
                                                `}
                                                style={isStickyActive ? { borderLeftColor: color } : {}}
                                                >
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div onClick={() => handleEdit(item.entity)} className="cursor-pointer hover:text-primary-600">
                                                            <h4 className="text-xs font-bold text-gray-800 leading-tight">{item.entity.title}</h4>
                                                            {stickyConfig.showDates && <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.displayInfo.main}</p>}
                                                        </div>
                                                        
                                                        {isStickyActive && stickyConfig.showJumpControls && (
                                                            <div className="flex flex-col gap-1 bg-gray-50 rounded border border-gray-100 p-0.5 shadow-sm">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); scrollToPosition(item.timePos); }} 
                                                                    className="p-1 hover:bg-white hover:text-primary-600 rounded text-gray-400 transition-colors" 
                                                                    title={I18N.go_to_start[language]}
                                                                >
                                                                    {viewMode === 'vertical' ? <ArrowUp className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); scrollToPosition(item.timePos + item.timeSpan); }} 
                                                                    className="p-1 hover:bg-white hover:text-primary-600 rounded text-gray-400 transition-colors" 
                                                                    title={I18N.go_to_end[language]}
                                                                >
                                                                    {viewMode === 'vertical' ? <ArrowDown className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {stickyConfig.showDescription && item.entity.description && (
                                                        <div 
                                                            className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 mt-1"
                                                            style={{
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: stickyConfig.maxLines,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            {item.entity.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Single Point Event */}
                                            <div className={`absolute text-[10px] font-bold text-gray-500 bg-white/80 px-1 rounded backdrop-blur-sm whitespace-nowrap ${viewMode === 'vertical' ? 'left-4 -translate-y-1/2' : 'top-4 -translate-x-1/2'}`}>
                                                {item.startYear}
                                            </div>
                                            <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm -translate-x-1/2 -translate-y-1/2 hover:scale-150 transition-transform cursor-crosshair" style={{ backgroundColor: color }} />
                                            
                                            {/* Simple Card for Point */}
                                            <div 
                                                onClick={() => handleEdit(item.entity)}
                                                className={`absolute bg-white p-2 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-primary-300 w-48 ${viewMode === 'vertical' ? 'left-12 -top-4' : 'top-10 -left-4'}`}
                                            >
                                                <h4 className="text-xs font-bold text-gray-800 truncate">{item.entity.title}</h4>
                                                <p className="text-[10px] text-gray-500 line-clamp-1">{item.entity.description}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                {/* Connector Line (Visual Guide) */}
                                <svg className="absolute inset-0 pointer-events-none z-0 overflow-visible opacity-20">
                                    {viewMode === 'vertical' ? (
                                        <path d={`M 60 ${timePos + labelOffset} L ${visualOffset} ${timePos + labelOffset}`} fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 2" />
                                    ) : (
                                        <path d={`M ${timePos + labelOffset} 60 L ${timePos + labelOffset} ${visualOffset}`} fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 2" />
                                    )}
                                </svg>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
          </div>
      </div>

      {isEditorOpen && ( <EntityEditor entity={editingEntity} categories={data.categories} onClose={() => setIsEditorOpen(false)} onSave={handleSave} onDelete={editingEntity ? (() => deleteEntity(editingEntity.id)) : undefined} initialHasChronology={true} /> )}
      {isSettingsOpen && <CalendarSettingsModal onClose={() => setIsSettingsOpen(false)} language={language} />}
    </div>
  );
};

export default Timeline;
