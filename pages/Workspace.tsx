
import React, { useState, useRef, useEffect } from 'react';
import { Network, History, Book, LayoutGrid, ChevronDown, Split, X, Plus, GripVertical } from 'lucide-react';
import GraphView from './GraphView';
import Timeline from './Timeline';
import EntityManager from './EntityManager';
import CategoryManager from './Categories';

type ViewType = 'Graph' | 'Timeline' | 'Entities' | 'Categories' | 'Empty';

interface Pane {
    id: string;
    type: ViewType;
    flex: number; // For resizing
}

const Workspace = () => {
    // Initial State: 2 Panes
    const [panes, setPanes] = useState<Pane[]>([
        { id: '1', type: 'Graph', flex: 1 },
        { id: '2', type: 'Timeline', flex: 1 }
    ]);
    
    // Resizing State
    const [isDragging, setIsDragging] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null); // Index of the pane to the LEFT of the resizer
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Drag Logic ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || dragIndex === null || !containerRef.current) return;
            
            e.preventDefault();
            
            // Get the total width of the container
            const containerRect = containerRef.current.getBoundingClientRect();
            const totalWidth = containerRect.width;
            
            // Calculate cursor position relative to container
            const relativeX = e.clientX - containerRect.left;
            
            // We are resizing panes[dragIndex] and panes[dragIndex + 1]
            // We need to figure out what their combined flex "share" is currently.
            // But simpler logic for Flexbox resizing:
            // Calculate percent position of the cursor within the combined width of the two panes? 
            // Too complex. Simpler heuristic:
            
            // Let's just adjust flex values directly based on mouse movement delta?
            // A bit hard.
            // Alternative: Fixed width calculation? 
            // Let's stick to Flex. We need to find the specific DOM elements to get their current widths.
            
            // Get all pane elements
            const paneElements = Array.from(containerRef.current.children).filter(c => c.classList.contains('workspace-pane')) as HTMLElement[];
            const leftEl = paneElements[dragIndex];
            const rightEl = paneElements[dragIndex + 1];
            
            if (!leftEl || !rightEl) return;
            
            // Current widths
            const leftRect = leftEl.getBoundingClientRect();
            const rightRect = rightEl.getBoundingClientRect();
            const combinedWidth = leftRect.width + rightRect.width;
            
            // Cursor X relative to the start of the left element
            const cursorInPair = e.clientX - leftRect.left;
            
            // New widths (clamped)
            const newLeftWidth = Math.max(100, Math.min(combinedWidth - 100, cursorInPair));
            const newRightWidth = combinedWidth - newLeftWidth;
            
            // Convert to Flex Ratio (proportional to pixel width)
            // We update the flex values to match the new pixel widths
            const newPanes = [...panes];
            
            // Normalize so total flex remains roughly same? 
            // Actually, we can just set flex to the pixel width temporarily or ratio.
            newPanes[dragIndex].flex = newLeftWidth;
            newPanes[dragIndex + 1].flex = newRightWidth;
            
            setPanes(newPanes);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setDragIndex(null);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isDragging, dragIndex, panes]);


    // --- Pane Management ---

    const addPane = () => {
        setPanes([...panes, { id: crypto.randomUUID(), type: 'Entities', flex: 1 }]);
    };

    const removePane = (index: number) => {
        if (panes.length <= 1) return; // Prevent deleting last pane
        const newPanes = panes.filter((_, i) => i !== index);
        setPanes(newPanes);
    };

    const updatePaneType = (index: number, type: ViewType) => {
        const newPanes = [...panes];
        newPanes[index].type = type;
        setPanes(newPanes);
    };

    const renderView = (type: ViewType) => {
        switch (type) {
            case 'Graph': return <div className="h-full w-full overflow-hidden relative"><GraphView /></div>;
            case 'Timeline': return <div className="h-full w-full overflow-hidden relative"><Timeline /></div>;
            case 'Entities': return <div className="h-full w-full overflow-hidden relative"><EntityManager /></div>;
            case 'Categories': return <div className="h-full w-full overflow-hidden relative"><CategoryManager /></div>;
            default: return <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-400 select-none">Select a tool from the menu</div>;
        }
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in bg-white">
            {/* Header */}
            <div className="h-10 border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Split className="w-4 h-4 text-primary-600" />
                    Workspace
                </div>
                <button 
                    onClick={addPane}
                    className="flex items-center gap-1 text-xs font-medium bg-primary-50 text-primary-700 px-2 py-1 rounded border border-primary-200 hover:bg-primary-100 transition-colors"
                >
                    <Plus className="w-3 h-3" /> Add Pane
                </button>
            </div>

            {/* Workspace Container */}
            <div className="flex-1 flex overflow-hidden" ref={containerRef}>
                {panes.map((pane, index) => (
                    <React.Fragment key={pane.id}>
                        {/* Pane Component */}
                        <div 
                            className="workspace-pane flex flex-col min-w-[200px]"
                            style={{ flex: pane.flex }}
                        >
                            {/* Pane Toolbar */}
                            <div className="h-10 bg-gray-50 border-b border-gray-200 flex items-center px-3 justify-between shrink-0 group">
                                <ViewSelector 
                                    value={pane.type} 
                                    onChange={(t) => updatePaneType(index, t)} 
                                />
                                {panes.length > 1 && (
                                    <button 
                                        onClick={() => removePane(index)}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                        title="Close Pane"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            
                            {/* Pane Content */}
                            <div className="flex-1 relative min-h-0 bg-white">
                                {renderView(pane.type)}
                            </div>
                        </div>

                        {/* Resizer Handle (if not last pane) */}
                        {index < panes.length - 1 && (
                            <div
                                className="w-1 hover:w-2 bg-gray-200 hover:bg-primary-400 cursor-col-resize flex items-center justify-center transition-all z-20 flex-shrink-0"
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent text selection
                                    setDragIndex(index);
                                    setIsDragging(true);
                                }}
                            >
                                <GripVertical className="w-3 h-3 text-gray-400 opacity-50" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

// --- Helper: Robust Dropdown Selector ---
const ViewSelector = ({ value, onChange }: { value: ViewType, onChange: (v: ViewType) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-2 py-1 bg-white border rounded text-xs font-medium shadow-sm transition-colors ${isOpen ? 'border-primary-500 ring-2 ring-primary-100 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}
            >
                {value === 'Graph' && <Network className="w-3 h-3 text-blue-500" />}
                {value === 'Timeline' && <History className="w-3 h-3 text-purple-500" />}
                {value === 'Entities' && <Book className="w-3 h-3 text-emerald-500" />}
                {value === 'Categories' && <LayoutGrid className="w-3 h-3 text-orange-500" />}
                {value === 'Empty' && <span className="w-3 h-3 block bg-gray-200 rounded-full" />}
                {value}
                <ChevronDown className={`w-3 h-3 text-gray-400 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 origin-top-left">
                    {['Graph', 'Timeline', 'Entities', 'Categories'].map((v) => (
                        <button 
                            key={v}
                            onClick={() => { onChange(v as ViewType); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${value === v ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                        >
                            {v === 'Graph' && <Network className="w-3 h-3" />}
                            {v === 'Timeline' && <History className="w-3 h-3" />}
                            {v === 'Entities' && <Book className="w-3 h-3" />}
                            {v === 'Categories' && <LayoutGrid className="w-3 h-3" />}
                            {v}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Workspace;
