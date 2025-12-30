
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { useView } from '../context/ViewContext';
import { I18N } from '../constants';
import { Entity, LineStyle } from '../types';
import EntityEditor from '../components/EntityEditor';
import { useGraphPhysics } from '../hooks/useGraphPhysics';
import { GraphToolbar, GraphBottomControls, GraphSettingsPanel } from '../components/GraphControls'; // Import new controls
import { Edit3, Trash2, Palette, ArrowRight, Focus, Target, Check, Edit2, AlertTriangle, X } from 'lucide-react';

const COLORS = ['#94a3b8', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

const GraphView = () => {
    const { data, language, updateEntity, deleteEntity, addEntity, undo, redo, canUndo, canRedo } = useWorld();
    const { graphState, setGraphState } = useView(); 

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const transformRef = useRef({ x: graphState.x, y: graphState.y, k: graphState.k }); 
    
    // Interaction State
    const isDraggingRef = useRef(false);
    const dragNodeRef = useRef<string | null>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const mouseWorldPosRef = useRef({ x: 0, y: 0 }); 
    const requestRef = useRef<number>(0);
    const lastFrameTime = useRef<number>(0);

    // Settings State
    const [repulsion, setRepulsion] = useState(800);
    const [linkDist, setLinkDist] = useState(150);
    const [adaptiveText, setAdaptiveText] = useState(true);
    const [showNodeNotes, setShowNodeNotes] = useState(true); 
    const [doubleClickToFocus, setDoubleClickToFocus] = useState(true);
    const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

    // UI State
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [isConnectMode, setIsConnectMode] = useState(false);
    const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
    const [defaultRelLabel, setDefaultRelLabel] = useState('Connected'); 
    const [showRelSuggestions, setShowRelSuggestions] = useState(false);
    
    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('all');
    const [showSettings, setShowSettings] = useState(false);

    // Editor State
    const [editingRelId, setEditingRelId] = useState<string | null>(null);
    const [editingRelType, setEditingRelType] = useState('');
    const [editingRelStyle, setEditingRelStyle] = useState<LineStyle>('solid');
    const [isSidebarDeleteConfirming, setIsSidebarDeleteConfirming] = useState(false);
    const [activeRelColorId, setActiveRelColorId] = useState<string | null>(null); 
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const selectedEntity = useMemo(() => data.entities.find(e => e.id === selectedEntityId), [data.entities, selectedEntityId]);
    const uniqueTags = useMemo(() => Array.from(new Set(data.entities.flatMap(e => e.tags))).sort(), [data.entities]);

    // --- Physics Engine Hook ---
    const { activeNodesRef, activeEdgesRef, allNodesRef, tick } = useGraphPhysics({
        data,
        graphState,
        containerRef,
        focusNodeId,
        repulsion,
        linkDist,
        dragNodeId: dragNodeRef.current
    });

    // Save state to context when unmounting
    useEffect(() => {
        return () => {
            const positions: Record<string, {x: number, y: number}> = {};
            allNodesRef.current.forEach(n => {
                positions[n.id] = { x: n.x, y: n.y };
            });
            
            setGraphState({ 
                x: transformRef.current.x,
                y: transformRef.current.y,
                k: transformRef.current.k,
                nodePositions: positions
            });
        };
    }, []); 

    // Reset delete confirmation
    useEffect(() => { setIsSidebarDeleteConfirming(false); }, [selectedEntityId]);

    // Rel Types Autocomplete
    const existingRelTypes = useMemo(() => {
        const types = new Set<string>(['Connected', 'Friend', 'Enemy', 'Family', 'Located in', 'Owner']);
        data.entities.forEach(e => e.relationships?.forEach(r => { if(r.type) types.add(r.type); }));
        return Array.from(types).sort();
    }, [data.entities]);

    const filteredRelTypes = useMemo(() => existingRelTypes.filter(t => t.toLowerCase().includes(defaultRelLabel.toLowerCase())), [existingRelTypes, defaultRelLabel]);

    // Handlers
    const handleEnterFocus = (id: string) => {
        const node = allNodesRef.current.find(n => n.id === id);
        if (!node || !containerRef.current) return;
        setFocusNodeId(id);
        setSelectedEntityId(id);
        node.vx = 0; node.vy = 0;
        const targetScale = 1.0; 
        transformRef.current = { x: -(node.x * targetScale), y: -(node.y * targetScale), k: targetScale };
    };

    const handleExitFocus = () => { setFocusNodeId(null); };

    const createConnection = (sourceId: string, targetId: string) => {
        const sourceEnt = data.entities.find(ent => ent.id === sourceId);
        if (sourceEnt) {
            const label = defaultRelLabel.trim() || 'Connected';
            const newRel = { id: crypto.randomUUID(), targetId: targetId, type: label, style: 'solid' as LineStyle };
            updateEntity(sourceId, { relationships: [...(sourceEnt.relationships || []), newRel] }, 'act_update_rel');
        }
    };

    // --- Render Loop ---
    const draw = (time: number) => {
        lastFrameTime.current = time;
        const canvas = canvasRef.current;
        if (!canvas || !containerRef.current) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
        }
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, rect.width, rect.height);

        tick();

        const t = transformRef.current;
        const w = rect.width;
        const h = rect.height;

        ctx.save();
        ctx.translate(w/2 + t.x, h/2 + t.y);
        ctx.scale(t.k, t.k);

        const nodes = activeNodesRef.current;
        const edges = activeEdgesRef.current;

        // Draw Edges
        ctx.strokeStyle = '#94a3b8';
        edges.forEach(e => {
            const s = nodes.find(n => n.id === e.source);
            const target = nodes.find(n => n.id === e.target);
            if (!s || !target) return;

            ctx.beginPath();
            ctx.strokeStyle = e.customColor || '#cbd5e1';
            ctx.lineWidth = (e.width || 1.5) / t.k;
            if (e.style === 'dashed') ctx.setLineDash([10, 10]);
            if (e.style === 'dotted') ctx.setLineDash([3, 3]);

            let angle;

            if (e.isSelf) {
                const r = s.radius;
                ctx.beginPath();
                ctx.arc(s.x + r, s.y - r, r * 1.5, 0, Math.PI * 2);
                ctx.stroke();
                return; 
            } else {
                const dx = target.x - s.x;
                const dy = target.y - s.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (e.total === 1 && !e.inverseExists) {
                    ctx.moveTo(s.x, s.y);
                    ctx.lineTo(target.x, target.y);
                    angle = Math.atan2(dy, dx);
                } else {
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    let curveFactor = 0;
                    if (e.total > 1) {
                         const spread = 40;
                         const centeredIdx = e.index - (e.total - 1) / 2;
                         curveFactor = centeredIdx * spread;
                    } else if (e.inverseExists) {
                        curveFactor = 30; 
                    }
                    const cpX = (s.x + target.x) / 2 + nx * curveFactor;
                    const cpY = (s.y + target.y) / 2 + ny * curveFactor;
                    ctx.moveTo(s.x, s.y);
                    ctx.quadraticCurveTo(cpX, cpY, target.x, target.y);
                    const tangX = target.x - cpX;
                    const tangY = target.y - cpY;
                    angle = Math.atan2(tangY, tangX);
                }
                ctx.stroke();
                
                // Arrow
                const arrowSize = 6 / t.k;
                const nodeRadius = target.radius + arrowSize;
                const arrowX = target.x - Math.cos(angle) * nodeRadius;
                const arrowY = target.y - Math.sin(angle) * nodeRadius;

                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(angle);
                ctx.fillStyle = e.customColor || '#cbd5e1';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-arrowSize * 1.5, -arrowSize * 0.8);
                ctx.lineTo(-arrowSize * 1.5, arrowSize * 0.8);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.setLineDash([]);
        });

        // Draw Temp Line
        if (isConnectMode && connectSourceId) {
            const s = nodes.find(n => n.id === connectSourceId);
            const target = hoveredNodeId ? nodes.find(n => n.id === hoveredNodeId) : null;
            const destX = target ? target.x : mouseWorldPosRef.current.x;
            const destY = target ? target.y : mouseWorldPosRef.current.y;

            if (s) {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(destX, destY);
                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 2 / t.k;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                
                const midX = (s.x + destX) / 2;
                const midY = (s.y + destY) / 2;
                ctx.fillStyle = '#6366f1';
                ctx.font = `italic ${10/t.k}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(defaultRelLabel, midX, midY - 10/t.k);
                ctx.setLineDash([]);
            }
        }

        // Draw Nodes
        nodes.forEach(n => {
            const isHovered = n.id === hoveredNodeId;
            const isSelected = n.id === selectedEntityId;
            const isSource = n.id === connectSourceId;
            
            let opacity = 1;
            if (searchQuery || selectedTag !== 'all') {
                const matchSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase());
                const matchTag = selectedTag === 'all' || n.tags.includes(selectedTag);
                if (!matchSearch || !matchTag) opacity = 0.2;
            }
            ctx.globalAlpha = opacity;
            
            ctx.beginPath();
            const r = n.radius;
            // Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 4;

            if (n.customShape === 'square') ctx.rect(n.x - r, n.y - r, r*2, r*2);
            else if (n.customShape === 'diamond') { ctx.moveTo(n.x, n.y-r*1.2); ctx.lineTo(n.x+r*1.2, n.y); ctx.lineTo(n.x, n.y+r*1.2); ctx.lineTo(n.x-r*1.2, n.y); }
            else if (n.customShape === 'hexagon') { for(let i=0; i<6; i++) { const a = Math.PI/3 * i; ctx.lineTo(n.x + r*Math.cos(a), n.y + r*Math.sin(a)); } }
            else ctx.arc(n.x, n.y, r, 0, Math.PI*2);
            ctx.closePath();
            
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.lineWidth = (isSelected || isSource ? 4 : 2) / t.k;
            ctx.strokeStyle = isSource ? '#6366f1' : (isHovered ? '#64748b' : n.color);
            ctx.stroke();

            if (focusNodeId === n.id) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 1.5, 0, Math.PI * 2);
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2 / t.k;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.restore();
            }

            const shouldShowText = !adaptiveText || (t.k > 0.8 || isHovered || isSelected || focusNodeId === n.id);
            if (shouldShowText) {
                ctx.font = `600 ${12/t.k}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#334155';
                const titleY = n.y + r + (14/t.k);
                ctx.fillText(n.title, n.x, titleY);

                if (showNodeNotes && n.nodeNote && (t.k > 0.6 || isHovered || isSelected)) {
                    ctx.font = `italic 400 ${10/t.k}px Inter`;
                    ctx.fillStyle = '#64748b';
                    const noteY = titleY + (14/t.k);
                    let noteText = n.nodeNote;
                    if (noteText.length > 20) noteText = noteText.substring(0, 18) + '...';
                    ctx.fillText(noteText, n.x, noteY);
                }
            }
            ctx.globalAlpha = 1;
        });

        ctx.restore();
        requestRef.current = requestAnimationFrame(draw);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isConnectMode, connectSourceId, hoveredNodeId, selectedEntityId, repulsion, linkDist, searchQuery, selectedTag, adaptiveText, focusNodeId, defaultRelLabel, showNodeNotes]);

    // --- Interaction Handlers ---
    const getMouseWorldPos = (e: React.MouseEvent) => {
        if (!containerRef.current) return {x:0, y:0};
        const rect = containerRef.current.getBoundingClientRect();
        const t = transformRef.current;
        return { x: (e.clientX - rect.left - rect.width/2 - t.x) / t.k, y: (e.clientY - rect.top - rect.height/2 - t.y) / t.k };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const pos = getMouseWorldPos(e);
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        const nodes = activeNodesRef.current;
        let clickedNodeId: string | null = null;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = pos.x - n.x;
            const dy = pos.y - n.y;
            if (dx*dx + dy*dy < n.radius * n.radius) { clickedNodeId = n.id; break; }
        }

        if (clickedNodeId) {
             if (e.ctrlKey) {
                 setIsConnectMode(true);
                 setConnectSourceId(clickedNodeId);
                 return;
             }
             if (isConnectMode) {
                if (!connectSourceId) setConnectSourceId(clickedNodeId);
                else if (connectSourceId !== clickedNodeId) {
                    createConnection(connectSourceId, clickedNodeId);
                    setConnectSourceId(null);
                    setIsConnectMode(false);
                }
            } else {
                dragNodeRef.current = clickedNodeId;
                setSelectedEntityId(clickedNodeId);
            }
        } else {
            isDraggingRef.current = true;
            if (!isConnectMode) setSelectedEntityId(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const pos = getMouseWorldPos(e);
        mouseWorldPosRef.current = pos;
        let hitId = null;
        const nodes = activeNodesRef.current;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if ((pos.x - n.x)**2 + (pos.y - n.y)**2 < n.radius**2) { hitId = n.id; break; }
        }
        setHoveredNodeId(hitId);

        if (dragNodeRef.current) {
            const n = nodes.find(node => node.id === dragNodeRef.current);
            if (n) { n.x = pos.x; n.y = pos.y; n.vx = 0; n.vy = 0; }
        } else if (isDraggingRef.current) {
            transformRef.current.x += e.clientX - lastMousePosRef.current.x;
            transformRef.current.y += e.clientY - lastMousePosRef.current.y;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => { 
        if (isConnectMode && connectSourceId && hoveredNodeId && connectSourceId !== hoveredNodeId) {
             createConnection(connectSourceId, hoveredNodeId);
             setConnectSourceId(null);
             setIsConnectMode(false);
        }
        isDraggingRef.current = false; 
        dragNodeRef.current = null; 
    };
    
    const handleWheel = (e: React.WheelEvent) => { transformRef.current.k = Math.max(0.1, Math.min(5, transformRef.current.k - e.deltaY * 0.001)); };
    const handleReset = () => { transformRef.current = { x: 0, y: 0, k: 0.8 }; };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (!doubleClickToFocus) return;
        const pos = getMouseWorldPos(e);
        const nodes = activeNodesRef.current;
        let clickedNodeId: string | null = null;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = pos.x - n.x;
            const dy = pos.y - n.y;
            if (dx*dx + dy*dy < n.radius * n.radius) { clickedNodeId = n.id; break; }
        }
        if (clickedNodeId) handleEnterFocus(clickedNodeId);
    };

    // Sidebar Helpers
    const changeRelStyle = (relId: string, newStyle: LineStyle) => {
        if (!selectedEntity) return;
        const updatedRels = selectedEntity.relationships?.map(r => r.id === relId ? { ...r, style: newStyle } : r);
        updateEntity(selectedEntity.id, { relationships: updatedRels }, 'act_change_rel_style');
    };
    
    const changeRelColor = (relId: string, newColor: string) => {
        if (!selectedEntity) return;
        const updatedRels = selectedEntity.relationships?.map(r => r.id === relId ? { ...r, customColor: newColor } : r);
        updateEntity(selectedEntity.id, { relationships: updatedRels }, 'act_change_color');
    };

    const deleteRel = (relId: string) => {
         if (!selectedEntity) return;
         const updatedRels = selectedEntity.relationships?.filter(r => r.id !== relId);
         updateEntity(selectedEntity.id, { relationships: updatedRels }, 'act_update_rel');
    };

    // Edit Logic
    const startEditingRel = (relId: string, type: string, style: LineStyle) => { setEditingRelId(relId); setEditingRelType(type); setEditingRelStyle(style || 'solid'); };
    const cancelEditingRel = () => { setEditingRelId(null); setEditingRelType(''); };
    const saveEditingRel = () => {
        if (selectedEntity && editingRelId && editingRelType.trim()) {
            const updatedRels = selectedEntity.relationships?.map(r => r.id === editingRelId ? { ...r, type: editingRelType, style: editingRelStyle } : r);
            updateEntity(selectedEntity.id, { relationships: updatedRels }, 'act_update_rel');
            cancelEditingRel();
        }
    };
    const handleSaveEdit = (entityData: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => { if (selectedEntityId) { updateEntity(selectedEntityId, entityData); setIsEditing(false); } };
    
    // Delete Logic
    const performDelete = (id: string) => { deleteEntity(id); setSelectedEntityId(null); setIsEditing(false); setFocusNodeId(null); };
    const handleSidebarDelete = () => {
        if (!selectedEntityId) return;
        if (isSidebarDeleteConfirming) { performDelete(selectedEntityId); setIsSidebarDeleteConfirming(false); } 
        else { setIsSidebarDeleteConfirming(true); setTimeout(() => setIsSidebarDeleteConfirming(false), 3000); }
    };
    const handleEditorDelete = () => { if (selectedEntityId) performDelete(selectedEntityId); };

    return (
        <div className="h-full flex flex-col relative bg-slate-50 overflow-hidden" ref={containerRef}>
            
            <GraphToolbar 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedTag={selectedTag}
                setSelectedTag={setSelectedTag}
                uniqueTags={uniqueTags}
                language={language}
                focusNodeId={focusNodeId}
                handleExitFocus={handleExitFocus}
                setIsCreating={setIsCreating}
                isConnectMode={isConnectMode}
                setIsConnectMode={setIsConnectMode}
                setConnectSourceId={setConnectSourceId}
                defaultRelLabel={defaultRelLabel}
                setDefaultRelLabel={setDefaultRelLabel}
                showRelSuggestions={showRelSuggestions}
                setShowRelSuggestions={setShowRelSuggestions}
                filteredRelTypes={filteredRelTypes}
                showSettings={showSettings}
                setShowSettings={setShowSettings}
                undo={undo}
                redo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
            />

            <GraphBottomControls 
                onZoomIn={() => transformRef.current.k *= 1.2}
                onZoomOut={() => transformRef.current.k /= 1.2}
                onReset={handleReset}
                language={language}
            />

            <GraphSettingsPanel 
                show={showSettings}
                onClose={() => setShowSettings(false)}
                repulsion={repulsion}
                setRepulsion={setRepulsion}
                linkDist={linkDist}
                setLinkDist={setLinkDist}
                adaptiveText={adaptiveText}
                setAdaptiveText={setAdaptiveText}
                showNodeNotes={showNodeNotes}
                setShowNodeNotes={setShowNodeNotes}
                doubleClickToFocus={doubleClickToFocus}
                setDoubleClickToFocus={setDoubleClickToFocus}
                language={language}
            />

            {/* Canvas */}
            <canvas 
                ref={canvasRef}
                className={`flex-1 w-full h-full block touch-none ${isConnectMode ? 'cursor-crosshair' : (dragNodeRef.current ? 'cursor-grabbing' : 'cursor-grab')}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} onDoubleClick={handleDoubleClick}
            />

            {/* Selection Panel (Could also be extracted, but keeping logic local for now as it handles edits) */}
            {selectedEntity && !isEditing && (
                <div className="absolute top-20 right-4 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-0 overflow-hidden animate-slide-up pointer-events-auto z-10 flex flex-col max-h-[calc(100vh-120px)]">
                    <div className="h-2 w-full flex-shrink-0" style={{backgroundColor: selectedEntity.customColor || data.categories.find(c=>c.id===selectedEntity.categoryId)?.color}}></div>
                    <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="flex justify-between items-start mb-1">
                             <h2 className="font-bold text-xl text-slate-800 leading-tight">{selectedEntity.title}</h2>
                             <button onClick={() => setSelectedEntityId(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        {selectedEntity.nodeNote && <div className="mb-2 text-xs font-medium text-slate-500 italic bg-slate-50 px-2 py-1 rounded inline-block border border-slate-100">{selectedEntity.nodeNote}</div>}
                        <div className="mb-4"><span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{data.categories.find(c=>c.id===selectedEntity.categoryId)?.name}</span></div>
                        <p className="text-sm text-slate-600 leading-relaxed mb-6">{selectedEntity.description || <span className="italic text-slate-400">{I18N.no_desc[language]}</span>}</p>
                        
                        {/* Focus Action */}
                        <div className="mb-6">
                            {focusNodeId === selectedEntity.id ? (
                                <button onClick={handleExitFocus} className="w-full py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-amber-100 transition-colors shadow-sm"><Target className="w-4 h-4 mr-2" /> {I18N.exit_focus[language]}</button>
                            ) : (
                                <button onClick={() => handleEnterFocus(selectedEntity.id)} className="w-full py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"><Focus className="w-4 h-4 mr-2" /> {I18N.focus_neighborhood[language]}</button>
                            )}
                        </div>

                        {/* Outgoing */}
                        <div className="mb-6">
                             <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b border-slate-100 pb-2 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> {I18N.outgoing_connections[language]}</h3>
                             <div className="space-y-2">
                                 {selectedEntity.relationships && selectedEntity.relationships.length > 0 ? (
                                     selectedEntity.relationships.map(rel => {
                                         const target = data.entities.find(e => e.id === rel.targetId);
                                         const isRelEditing = editingRelId === rel.id;
                                         if (isRelEditing) {
                                            return (
                                                <div key={rel.id} className="bg-indigo-50 rounded-lg p-2 border border-indigo-200 animate-in fade-in flex flex-col gap-2">
                                                    <div className="flex gap-2 items-center">
                                                        <input value={editingRelType} onChange={(e) => setEditingRelType(e.target.value)} className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded focus:border-indigo-500 outline-none" placeholder={I18N.ph_type[language]} autoFocus />
                                                        <select value={editingRelStyle} onChange={(e) => setEditingRelStyle(e.target.value as LineStyle)} className="w-20 px-1 py-1 text-xs border border-indigo-300 rounded bg-white outline-none">
                                                            <option value="solid">{I18N.style_solid[language]}</option><option value="dashed">{I18N.style_dashed[language]}</option><option value="dotted">{I18N.style_dotted[language]}</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex justify-end gap-2"><button onClick={saveEditingRel} className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center"><Check className="w-3 h-3 mr-1" /> {I18N.save[language]}</button><button onClick={cancelEditingRel} className="px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 flex items-center"><X className="w-3 h-3 mr-1" /> {I18N.cancel[language]}</button></div>
                                                </div>
                                            );
                                         }
                                         return (
                                             <div key={rel.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-indigo-200 transition-colors group">
                                                 <div className="flex justify-between items-center mb-2">
                                                     <button onClick={() => setSelectedEntityId(rel.targetId)} className="text-sm font-semibold text-slate-700 truncate max-w-[150px] hover:text-indigo-600 text-left transition-colors">{target?.title || I18N.unknown_entity[language]}</button>
                                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEditingRel(rel.id, rel.type, rel.style || 'solid')} className="text-slate-300 hover:text-indigo-500 p-0.5" title={I18N.edit[language]}><Edit2 className="w-3 h-3" /></button><button onClick={() => deleteRel(rel.id)} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button></div>
                                                 </div>
                                                 <div className="flex justify-between items-center">
                                                     <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">{rel.type}</span>
                                                     <div className="flex gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <div className="flex bg-white rounded border border-slate-200 p-0.5 shadow-sm">
                                                            {['solid', 'dashed', 'dotted'].map(s => (
                                                                <button key={s} onClick={() => changeRelStyle(rel.id, s as LineStyle)} className={`w-4 h-4 rounded-sm flex items-center justify-center ${rel.style === s || (!rel.style && s==='solid') ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-400'}`}><div className={`w-3 h-px bg-current ${s === 'dashed' ? 'border-t border-dashed' : s === 'dotted' ? 'border-t border-dotted' : ''}`}></div></button>
                                                            ))}
                                                         </div>
                                                         <div className="relative">
                                                             <button onClick={(e) => { e.stopPropagation(); setActiveRelColorId(activeRelColorId === rel.id ? null : rel.id); }} className="w-5 h-5 rounded border border-slate-200 flex items-center justify-center transition-colors hover:border-indigo-300 shadow-sm" style={{backgroundColor: rel.customColor || '#fff'}} title="Change Color"><Palette className="w-3 h-3 text-slate-500 mix-blend-difference" /></button>
                                                             {activeRelColorId === rel.id && (
                                                                 <div className="absolute right-0 bottom-full mb-2 flex flex-wrap bg-white shadow-xl border border-gray-200 p-2 rounded-lg gap-1 z-50 w-32 animate-in fade-in zoom-in-95 origin-bottom-right">
                                                                     {COLORS.map(c => (<button key={c} onClick={(e) => { e.stopPropagation(); changeRelColor(rel.id, c); setActiveRelColorId(null); }} className="w-5 h-5 rounded-full border border-gray-100 hover:scale-110 transition-transform shadow-sm" style={{backgroundColor: c}}></button>))}
                                                                     <button onClick={(e) => { e.stopPropagation(); changeRelColor(rel.id, ''); setActiveRelColorId(null); }} className="w-5 h-5 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-100" title="Reset Color"><X className="w-3 h-3 text-gray-400" /></button>
                                                                 </div>
                                                             )}
                                                         </div>
                                                     </div>
                                                 </div>
                                             </div>
                                         );
                                     })
                                 ) : <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">{I18N.no_relationships[language]}</div>}
                             </div>
                        </div>

                        <div className="flex gap-3 mt-auto pt-4 border-t border-slate-100">
                            <button onClick={() => setIsEditing(true)} className="flex-1 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-sm font-semibold text-slate-700 flex justify-center items-center transition-all shadow-sm"><Edit3 className="w-4 h-4 mr-2" /> {I18N.edit[language]}</button>
                            <button onClick={handleSidebarDelete} className={`p-2.5 bg-white border rounded-xl transition-all shadow-sm flex items-center justify-center ${isSidebarDeleteConfirming ? 'border-red-500 bg-red-50 text-red-600 animate-pulse ring-1 ring-red-200' : 'border-red-100 hover:bg-red-50 text-red-500'}`} title={isSidebarDeleteConfirming ? I18N.confirm_action[language] : I18N.delete[language]}>{isSidebarDeleteConfirming ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}</button>
                        </div>
                    </div>
                </div>
            )}

            {isEditing && selectedEntity && <EntityEditor entity={selectedEntity} categories={data.categories} onClose={() => setIsEditing(false)} onSave={handleSaveEdit} onDelete={handleEditorDelete} />}
            {isCreating && <EntityEditor categories={data.categories} onClose={() => setIsCreating(false)} onSave={(d) => { addEntity(d); setIsCreating(false); }} />}
        </div>
    );
};

export default GraphView;
