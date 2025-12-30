
import React, { useRef, useEffect } from 'react';
import { I18N } from '../constants';
import { Search, ZoomIn, ZoomOut, Maximize, Link as LinkIcon, Sliders, Plus, RotateCcw, RotateCw, X, ChevronDown, Check } from 'lucide-react';
import TagFilter from './TagFilter';

// --- Types ---
interface ToolbarProps {
    searchQuery: string;
    setSearchQuery: (s: string) => void;
    selectedTag: string;
    setSelectedTag: (t: string) => void;
    uniqueTags: string[];
    language: string;
    focusNodeId: string | null;
    handleExitFocus: () => void;
    setIsCreating: (b: boolean) => void;
    isConnectMode: boolean;
    setIsConnectMode: (b: boolean) => void;
    setConnectSourceId: (id: string | null) => void;
    defaultRelLabel: string;
    setDefaultRelLabel: (s: string) => void;
    showRelSuggestions: boolean;
    setShowRelSuggestions: (b: boolean) => void;
    filteredRelTypes: string[];
    showSettings: boolean;
    setShowSettings: (b: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

interface BottomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    language: string;
}

interface SettingsPanelProps {
    show: boolean;
    onClose: () => void;
    repulsion: number;
    setRepulsion: (n: number) => void;
    linkDist: number;
    setLinkDist: (n: number) => void;
    adaptiveText: boolean;
    setAdaptiveText: (b: boolean) => void;
    showNodeNotes: boolean;
    setShowNodeNotes: (b: boolean) => void;
    doubleClickToFocus: boolean;
    setDoubleClickToFocus: (b: boolean) => void;
    language: string;
}

// --- Components ---

export const GraphToolbar: React.FC<ToolbarProps> = ({
    searchQuery, setSearchQuery, selectedTag, setSelectedTag, uniqueTags, language,
    focusNodeId, handleExitFocus, setIsCreating, isConnectMode, setIsConnectMode,
    setConnectSourceId, defaultRelLabel, setDefaultRelLabel, showRelSuggestions,
    setShowRelSuggestions, filteredRelTypes, showSettings, setShowSettings,
    undo, redo, canUndo, canRedo
}) => {
    const relInputContainerRef = useRef<HTMLDivElement>(null);

    // Close suggestions logic specific to this component
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (relInputContainerRef.current && !relInputContainerRef.current.contains(event.target as Node)) {
                setShowRelSuggestions(false);
            }
        };
        if (showRelSuggestions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showRelSuggestions, setShowRelSuggestions]);

    return (
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
                {/* Search & Filter */}
                <div className="bg-white/90 backdrop-blur p-1.5 rounded-xl border border-gray-200 shadow-sm flex gap-2 items-center">
                    <Search className="w-4 h-4 text-slate-400 ml-2" />
                    <input 
                        className="bg-transparent text-sm outline-none w-32 focus:w-48 transition-all placeholder:text-slate-400 text-slate-700" 
                        placeholder={I18N.search_node[language]} 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                    />
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <div className="w-32">
                        <TagFilter tags={uniqueTags} selectedTag={selectedTag} onChange={setSelectedTag} language={language} className="w-full" />
                    </div>
                </div>

                {/* Focus Mode Indicator */}
                {focusNodeId && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 animate-fade-in">
                        <span className="text-xs font-bold uppercase tracking-wider">{I18N.focus_mode_active[language]}</span>
                        <button onClick={handleExitFocus} className="ml-2 hover:bg-amber-100 p-1 rounded-full"><X className="w-3 h-3" /></button>
                    </div>
                )}
            </div>

            <div className="flex gap-2 pointer-events-auto">
                <div className="bg-white/90 backdrop-blur p-1.5 rounded-xl border border-gray-200 shadow-sm flex gap-1 text-slate-600">
                    <button onClick={() => setIsCreating(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title={I18N.create_new[language]}><Plus className="w-5 h-5" /></button>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => { setIsConnectMode(!isConnectMode); setConnectSourceId(null); }} 
                            className={`p-2 rounded-lg transition-colors ${isConnectMode ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'hover:bg-slate-100'}`} 
                            title={`${I18N.connect_mode[language]} (or Ctrl+Drag)`}
                        >
                            <LinkIcon className="w-5 h-5" />
                        </button>
                        
                        <div ref={relInputContainerRef} className={`relative transition-all duration-300 ease-in-out ${isConnectMode ? 'w-48 opacity-100 ml-1' : 'w-0 opacity-0 overflow-hidden'}`}>
                            <div className="relative flex items-center">
                                <input 
                                    type="text" 
                                    value={defaultRelLabel} 
                                    onChange={(e) => { setDefaultRelLabel(e.target.value); setShowRelSuggestions(true); }} 
                                    onFocus={() => setShowRelSuggestions(true)} 
                                    placeholder={I18N.ph_type[language]} 
                                    className="w-full pl-2 pr-6 py-1 text-xs border border-indigo-200 rounded bg-indigo-50/50 focus:bg-white focus:border-indigo-400 outline-none text-indigo-800 placeholder:text-indigo-300" 
                                />
                                <button onClick={() => setShowRelSuggestions(!showRelSuggestions)} className="absolute right-1 text-indigo-400 hover:text-indigo-600"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                            {showRelSuggestions && isConnectMode && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 origin-top-left">
                                    {filteredRelTypes.length > 0 ? (
                                        filteredRelTypes.map((type) => (
                                            <button key={type} onMouseDown={(e) => { e.preventDefault(); setDefaultRelLabel(type); setShowRelSuggestions(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 flex items-center justify-between group">
                                                {type}{defaultRelLabel === type && <Check className="w-3 h-3 text-indigo-500" />}
                                            </button>
                                        ))
                                    ) : <div className="px-3 py-2 text-xs text-gray-400 italic">{I18N.no_matches[language]}</div>}
                                    {defaultRelLabel && !filteredRelTypes.includes(defaultRelLabel) && <div className="px-3 py-2 text-xs text-indigo-600 bg-indigo-50/50 border-t border-indigo-100 italic">{I18N.new_label[language]}: "{defaultRelLabel}"</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-100'}`} title={I18N.graph_settings[language]}><Sliders className="w-5 h-5" /></button>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <button onClick={undo} disabled={!canUndo} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><RotateCcw className="w-5 h-5" /></button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><RotateCw className="w-5 h-5" /></button>
                </div>
            </div>
        </div>
    );
};

export const GraphBottomControls: React.FC<BottomControlsProps> = ({ onZoomIn, onZoomOut, onReset, language }) => {
    return (
        <div className="absolute bottom-6 left-6 z-10 flex gap-2 pointer-events-auto">
            <div className="bg-white/90 backdrop-blur p-1 rounded-xl border border-gray-200 shadow-sm flex flex-col text-slate-600">
                <button onClick={onZoomIn} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title={I18N.zoom_in[language]}><ZoomIn className="w-5 h-5" /></button>
                <button onClick={onZoomOut} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title={I18N.zoom_out[language]}><ZoomOut className="w-5 h-5" /></button>
                <div className="h-px w-6 bg-slate-200 mx-auto my-1"></div>
                <button onClick={onReset} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title={I18N.reset_view[language]}><Maximize className="w-5 h-5" /></button>
            </div>
        </div>
    );
};

export const GraphSettingsPanel: React.FC<SettingsPanelProps> = ({ 
    show, onClose, repulsion, setRepulsion, linkDist, setLinkDist, 
    adaptiveText, setAdaptiveText, showNodeNotes, setShowNodeNotes, 
    doubleClickToFocus, setDoubleClickToFocus, language 
}) => {
    if (!show) return null;
    return (
        <div className="absolute top-20 right-4 z-50 w-64 bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-5 animate-slide-up pointer-events-auto">
            <div className="flex justify-between items-center mb-5">
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{I18N.graph_settings[language]}</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-5">
                <div>
                    <label className="text-xs font-semibold text-slate-500 mb-2 block flex justify-between">{I18N.repulsion_strength[language]} <span className="text-slate-400">{repulsion}</span></label>
                    <input type="range" min="100" max="2000" value={repulsion} onChange={e => setRepulsion(Number(e.target.value))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 mb-2 block flex justify-between">{I18N.link_distance[language]} <span className="text-slate-400">{linkDist}</span></label>
                    <input type="range" min="50" max="400" value={linkDist} onChange={e => setLinkDist(Number(e.target.value))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-3"><input type="checkbox" checked={adaptiveText} onChange={e => setAdaptiveText(e.target.checked)} id="adaptiveText" className="rounded text-indigo-600 focus:ring-indigo-500" /><label htmlFor="adaptiveText" className="text-sm text-slate-700 font-medium">{I18N.adaptive_text[language]}</label></div>
                    <div className="flex items-center gap-3"><input type="checkbox" checked={showNodeNotes} onChange={e => setShowNodeNotes(e.target.checked)} id="showNodeNotes" className="rounded text-indigo-600 focus:ring-indigo-500" /><label htmlFor="showNodeNotes" className="text-sm text-slate-700 font-medium">{I18N.show_notes[language]}</label></div>
                    <div className="flex items-center gap-3"><input type="checkbox" checked={doubleClickToFocus} onChange={e => setDoubleClickToFocus(e.target.checked)} id="doubleClickFocus" className="rounded text-indigo-600 focus:ring-indigo-500" /><label htmlFor="doubleClickFocus" className="text-sm text-slate-700 font-medium">{I18N.double_click_focus[language]}</label></div>
                </div>
            </div>
        </div>
    );
};
