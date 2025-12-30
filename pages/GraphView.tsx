import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { useView } from '../context/ViewContext';
import { I18N } from '../constants';
import { Entity, LineStyle } from '../types';
import EntityEditor from '../components/EntityEditor';
import TagFilter from '../components/TagFilter';
import { Search, ZoomIn, ZoomOut, Maximize, Link as LinkIcon, Sliders, Plus, RotateCcw, RotateCw, X, Edit3, Trash2, Palette, ArrowRight, Focus, Target, Check, Edit2, ChevronDown } from 'lucide-react';

// --- Math Helpers ---
interface GraphNode extends Entity {
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number;
    fy: number;
    radius: number;
    color: string;
    mass: number;
}

interface Edge {
    id: string; // Rel ID
    source: string;
    target: string;
    label: string;
    style?: LineStyle;
    customColor?: string;
    width?: number;
    // For curvature
    index: number; 
    total: number;
    isSelf: boolean;
    inverseExists: boolean;
}

const COLORS = ['#94a3b8', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];

const GraphView = () => {
    const { data, language, updateEntity, deleteEntity, addEntity, undo, redo, canUndo, canRedo } = useWorld();
    const { graphState, setGraphState } = useView(); 

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const allNodesRef = useRef<GraphNode[]>([]); 
    const allEdgesRef = useRef<Edge[]>([]);
    
    // Active simulation set (subset for focus mode)
    const activeNodesRef = useRef<GraphNode[]>([]); 
    const activeEdgesRef = useRef<Edge[]>([]);

    // Initialize transform from Context immediately
    const transformRef = useRef({ x: graphState.x, y: graphState.y, k: graphState.k }); 
    
    const isDraggingRef = useRef(false);
    const dragNodeRef = useRef<string | null>(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const mouseWorldPosRef = useRef({ x: 0, y: 0 }); // Track world pos for drawing line to cursor
    const requestRef = useRef<number>(0);
    const lastFrameTime = useRef<number>(0);

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

    // UI State
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    
    // Connection Mode State
    const [isConnectMode, setIsConnectMode] = useState(false);
    const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
    const [defaultRelLabel, setDefaultRelLabel] = useState('Connected'); 
    
    // Combobox State for Relation Label
    const [showRelSuggestions, setShowRelSuggestions] = useState(false);
    const relInputContainerRef = useRef<HTMLDivElement>(null);

    // Sidebar Edit State
    const [editingRelId, setEditingRelId] = useState<string | null>(null);
    const [editingRelType, setEditingRelType] = useState('');
    const [editingRelStyle, setEditingRelStyle] = useState<LineStyle>('solid');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('all');
    const [showSettings, setShowSettings] = useState(false);
    const [activeRelColorId, setActiveRelColorId] = useState<string | null>(null); 
    
    // Focus Mode
    const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

    // Editors
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Physics Settings
    const [repulsion, setRepulsion] = useState(800);
    const [linkDist, setLinkDist] = useState(150);
    const [adaptiveText, setAdaptiveText] = useState(true);
    const [doubleClickToFocus, setDoubleClickToFocus] = useState(true);

    const selectedEntity = useMemo(() => data.entities.find(e => e.id === selectedEntityId), [data.entities, selectedEntityId]);

    // Extract all unique relationship types for autocomplete
    const existingRelTypes = useMemo(() => {
        const types = new Set<string>();
        // Add some default common types
        ['Connected', 'Friend', 'Enemy', 'Family', 'Located in', 'Owner'].forEach(t => types.add(t));
        data.entities.forEach(e => {
            e.relationships?.forEach(r => {
                if(r.type) types.add(r.type);
            });
        });
        return Array.from(types).sort();
    }, [data.entities]);

    const filteredRelTypes = useMemo(() => {
        return existingRelTypes.filter(t => t.toLowerCase().includes(defaultRelLabel.toLowerCase()));
    }, [existingRelTypes, defaultRelLabel]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (relInputContainerRef.current && !relInputContainerRef.current.contains(event.target as Node)) {
                setShowRelSuggestions(false);
            }
        };
        if (showRelSuggestions) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showRelSuggestions]);


    // --- Data Initialization & Optimization ---
    useEffect(() => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;

        const savedPositions = graphState.nodePositions || {};
        const prevMap = new Map(allNodesRef.current.map(n => [n.id, {x: n.x, y: n.y}]));

        const newNodes: GraphNode[] = data.entities.map(e => {
            const cat = data.categories.find(c => c.id === e.categoryId);
            let startX, startY;
            
            if (savedPositions[e.id]) {
                startX = savedPositions[e.id].x;
                startY = savedPositions[e.id].y;
            } else if (prevMap.has(e.id)) {
                const p = prevMap.get(e.id)!;
                startX = p.x;
                startY = p.y;
            } else {
                startX = w/2 + (Math.random()-0.5)*200;
                startY = h/2 + (Math.random()-0.5)*200;
            }
            
            return {
                ...e,
                x: startX,
                y: startY,
                vx: 0, vy: 0, fx: 0, fy: 0,
                radius: (25 * (e.customScale || 1)),
                color: e.customColor || cat?.color || '#cbd5e1',
                mass: 1
            };
        });

        const rawEdges: any[] = [];
        data.entities.forEach(e => {
            if (e.relationships) {
                e.relationships.forEach(r => {
                    if (data.entities.find(t => t.id === r.targetId)) {
                        rawEdges.push({
                            id: r.id,
                            source: e.id,
                            target: r.targetId,
                            label: r.type,
                            style: r.style,
                            customColor: r.customColor,
                            width: r.width
                        });
                    }
                });
            }
        });

        const pairMap = new Map<string, any[]>();
        rawEdges.forEach(e => {
            const pairKey = [e.source, e.target].sort().join('-');
            if (!pairMap.has(pairKey)) pairMap.set(pairKey, []);
            pairMap.get(pairKey)?.push(e);
        });

        const newEdges: Edge[] = rawEdges.map(e => {
            const pairKey = [e.source, e.target].sort().join('-');
            const siblings = pairMap.get(pairKey) || [];
            const total = siblings.length;
            const index = siblings.findIndex(s => s.id === e.id); 
            const inverseExists = siblings.some(s => s.source === e.target && s.target === e.source);
            
            return {
                ...e,
                index,
                total,
                isSelf: e.source === e.target,
                inverseExists
            };
        });

        allNodesRef.current = newNodes;
        allEdgesRef.current = newEdges;
        
        updateActiveSimulationSet();

    }, [data, graphState.nodePositions]); 

    // --- Focus Mode Logic ---
    const updateActiveSimulationSet = () => {
        if (focusNodeId) {
            const neighborIds = new Set<string>([focusNodeId]);
            const relevantEdges = allEdgesRef.current.filter(e => {
                if (e.source === focusNodeId) { neighborIds.add(e.target); return true; }
                if (e.target === focusNodeId) { neighborIds.add(e.source); return true; }
                return false;
            });
            
            activeNodesRef.current = allNodesRef.current.filter(n => neighborIds.has(n.id));
            activeEdgesRef.current = relevantEdges;
            
            // Stabilization
            activeNodesRef.current.forEach(n => { n.vx = 0; n.vy = 0; });
        } else {
            activeNodesRef.current = allNodesRef.current;
            activeEdgesRef.current = allEdgesRef.current;
        }
    };

    useEffect(() => {
        updateActiveSimulationSet();
    }, [focusNodeId]); 

    const handleEnterFocus = (id: string) => {
        const node = allNodesRef.current.find(n => n.id === id);
        if (!node || !containerRef.current) return;

        setFocusNodeId(id);
        setSelectedEntityId(id);
        node.vx = 0; node.vy = 0;

        const targetScale = 1.0; 
        transformRef.current = { 
            x: -(node.x * targetScale), 
            y: -(node.y * targetScale), 
            k: targetScale 
        };
    };

    const handleExitFocus = () => { setFocusNodeId(null); };

    // --- Helper: Create Relationship ---
    const createConnection = (sourceId: string, targetId: string) => {
        const sourceEnt = data.entities.find(ent => ent.id === sourceId);
        if (sourceEnt) {
            const label = defaultRelLabel.trim() || 'Connected'; // Use user defined label
            const newRel = { id: crypto.randomUUID(), targetId: targetId, type: label, style: 'solid' as LineStyle };
            updateEntity(sourceId, { relationships: [...(sourceEnt.relationships || []), newRel] }, 'act_update_rel');
        }
    };

    // --- Physics Engine ---
    const tick = () => {
        const nodes = activeNodesRef.current;
        const edges = activeEdgesRef.current;
        
        nodes.forEach(n => { n.fx = 0; n.fy = 0; });

        // Optimization: Spatial Partitioning or simple loop loop optimization
        const len = nodes.length;
        for (let i = 0; i < len; i++) {
            const n1 = nodes[i];
            for (let j = i + 1; j < len; j++) {
                const n2 = nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                const dSq = dx*dx + dy*dy;
                if (dSq === 0 || dSq > 250000) continue; // Optimization: Ignore distant nodes > 500px
                const d = Math.sqrt(dSq);
                const force = (repulsion / d) * (focusNodeId ? 0.8 : 1); 
                const fx = (dx/d) * force;
                const fy = (dy/d) * force;
                n1.fx += fx; n1.fy += fy;
                n2.fx -= fx; n2.fy -= fy;
            }
        }

        // Attraction
        edges.forEach(e => {
            const s = nodes.find(n => n.id === e.source);
            const t = nodes.find(n => n.id === e.target);
            if (!s || !t || e.isSelf) return;

            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d === 0) return;

            const force = (d - linkDist) * 0.05;
            const fx = (dx/d) * force;
            const fy = (dy/d) * force;
            s.fx += fx; s.fy += fy;
            t.fx -= fx; t.fy -= fy;
        });

        // Center Gravity
        if (!focusNodeId) {
            nodes.forEach(n => {
                n.fx += (0 - n.x) * 0.01;
                n.fy += (0 - n.y) * 0.01;
            });
        }

        // Integration
        nodes.forEach(n => {
            if (n.id === dragNodeRef.current) return;
            if (focusNodeId === n.id) { n.vx = 0; n.vy = 0; return; }

            const friction = focusNodeId ? 0.85 : 0.9;
            n.vx = (n.vx + n.fx * 0.1) * friction;
            n.vy = (n.vy + n.fy * 0.1) * friction;
            
            const maxV = focusNodeId ? 5 : 10;
            const vMagSq = n.vx*n.vx + n.vy*n.vy;
            if (vMagSq > maxV*maxV) { 
                const vMag = Math.sqrt(vMagSq);
                n.vx = (n.vx/vMag) * maxV; 
                n.vy = (n.vy/vMag) * maxV; 
            }
            if (vMagSq < 0.0025) { n.vx = 0; n.vy = 0; }

            n.x += n.vx; n.y += n.vy;
        });
    };

    // --- Render Loop ---
    const draw = (time: number) => {
        // FPS throttle if needed, but standard RAF is usually good.
        lastFrameTime.current = time;

        const canvas = canvasRef.current;
        if (!canvas || !containerRef.current) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: alpha false if background covers all
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
        
        // Draw background color manually since alpha: false
        ctx.fillStyle = '#f8fafc'; // Slate-50
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
                    
                    // Arrow angle calculation for curve
                    // Derivative of Quadratic Bezier at t=1 (end)
                    // B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
                    // At t=1: 2(P2-P1)
                    const tangX = target.x - cpX;
                    const tangY = target.y - cpY;
                    angle = Math.atan2(tangY, tangX);
                }
                
                ctx.stroke();
                
                // Draw Arrow Head
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

        // Draw Temp Connection Line (Connect Mode or Dragging)
        if (isConnectMode && connectSourceId) {
            const s = nodes.find(n => n.id === connectSourceId);
            const target = hoveredNodeId ? nodes.find(n => n.id === hoveredNodeId) : null;
            
            // Destination point: Either center of hovered node, or current mouse world pos
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
                
                // Draw Label Preview
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
            // Draw Shadow
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
            
            // Reset Shadow for stroke/text
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            ctx.lineWidth = (isSelected || isSource ? 4 : 2) / t.k;
            ctx.strokeStyle = isSource ? '#6366f1' : (isHovered ? '#64748b' : n.color);
            ctx.stroke();

            // Highlight Ring
            if (focusNodeId === n.id) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 1.5, 0, Math.PI * 2);
                ctx.strokeStyle = '#f59e0b'; // Amber
                ctx.lineWidth = 2 / t.k;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.restore();
            }

            const shouldShowText = !adaptiveText || (t.k > 0.8 || isHovered || isSelected || focusNodeId === n.id);
            if (shouldShowText) {
                ctx.fillStyle = '#1e293b';
                ctx.font = `600 ${12/t.k}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.fillStyle = '#334155';
                ctx.fillText(n.title, n.x, n.y + r + (14/t.k));
            }
            ctx.globalAlpha = 1;
        });

        ctx.restore();
        requestRef.current = requestAnimationFrame(draw);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(draw);
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isConnectMode, connectSourceId, hoveredNodeId, selectedEntityId, repulsion, linkDist, searchQuery, selectedTag, adaptiveText, focusNodeId, defaultRelLabel]);

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
             // CTRL+Drag to Connect Logic
             if (e.ctrlKey) {
                 setIsConnectMode(true);
                 setConnectSourceId(clickedNodeId);
                 // Do NOT set dragNodeRef, we are drawing a line instead
                 return;
             }

             if (isConnectMode) {
                if (!connectSourceId) {
                    setConnectSourceId(clickedNodeId);
                } else if (connectSourceId !== clickedNodeId) {
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
        mouseWorldPosRef.current = pos; // Update for rendering line to cursor

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
        // Handle Drag-to-Connect completion
        if (isConnectMode && connectSourceId && hoveredNodeId && connectSourceId !== hoveredNodeId) {
             createConnection(connectSourceId, hoveredNodeId);
             setConnectSourceId(null);
             setIsConnectMode(false);
        } else if (isConnectMode && connectSourceId && !hoveredNodeId) {
            // Drag released in empty space - do nothing
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

    // Helper functions for entity manipulation
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

    // --- Sidebar Editing Logic ---
    const startEditingRel = (relId: string, type: string, style: LineStyle) => {
        setEditingRelId(relId);
        setEditingRelType(type);
        setEditingRelStyle(style || 'solid');
    };

    const cancelEditingRel = () => {
        setEditingRelId(null);
        setEditingRelType('');
    };

    const saveEditingRel = () => {
        if (selectedEntity && editingRelId && editingRelType.trim()) {
            const updatedRels = selectedEntity.relationships?.map(r => 
                r.id === editingRelId 
                ? { ...r, type: editingRelType, style: editingRelStyle }
                : r
            );
            updateEntity(selectedEntity.id, { relationships: updatedRels }, 'act_update_rel');
            cancelEditingRel();
        }
    };
    
    const handleSaveEdit = (entityData: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => {
        if (selectedEntityId) {
            updateEntity(selectedEntityId, entityData);
            setIsEditing(false);
        }
    };

    const handleDelete = () => {
        if (selectedEntityId) {
             if (confirm(I18N.confirm_delete[language])) {
                deleteEntity(selectedEntityId);
                setSelectedEntityId(null);
                setIsEditing(false);
             }
        }
    };

    const uniqueTags = useMemo(() => Array.from(new Set(data.entities.flatMap(e => e.tags))).sort(), [data.entities]);

    return (
        <div className="h-full flex flex-col relative bg-slate-50 overflow-hidden" ref={containerRef}>
            
            {/* Top Toolbar */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
                <div className="flex gap-2 pointer-events-auto">
                    {/* Search & Filter */}
                    <div className="bg-white/90 backdrop-blur p-1.5 rounded-xl border border-gray-200 shadow-sm flex gap-2 items-center">
                         <Search className="w-4 h-4 text-slate-400 ml-2" />
                         <input className="bg-transparent text-sm outline-none w-32 focus:w-48 transition-all placeholder:text-slate-400 text-slate-700" placeholder={I18N.search_node[language]} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                         <div className="w-px h-4 bg-slate-200 mx-1"></div>
                         <div className="w-32"><TagFilter tags={uniqueTags} selectedTag={selectedTag} onChange={setSelectedTag} language={language} className="w-full" /></div>
                    </div>

                    {/* Focus Mode Indicator */}
                    {focusNodeId && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 animate-fade-in">
                            <Focus className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">{I18N.focus_mode_active[language]}</span>
                            <button onClick={handleExitFocus} className="ml-2 hover:bg-amber-100 p-1 rounded-full"><X className="w-3 h-3" /></button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <div className="bg-white/90 backdrop-blur p-1.5 rounded-xl border border-gray-200 shadow-sm flex gap-1 text-slate-600">
                        <button onClick={() => setIsCreating(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title={I18N.create_new[language]}><Plus className="w-5 h-5" /></button>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        
                        {/* Connection Tools */}
                        <div className="flex items-center gap-1">
                             <button onClick={() => { setIsConnectMode(!isConnectMode); setConnectSourceId(null); }} className={`p-2 rounded-lg transition-colors ${isConnectMode ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200' : 'hover:bg-slate-100'}`} title={`${I18N.connect_mode[language]} (or Ctrl+Drag)`}><LinkIcon className="w-5 h-5" /></button>
                             
                             {/* Relation Label Combobox */}
                             <div 
                                ref={relInputContainerRef}
                                className={`relative transition-all duration-300 ease-in-out ${isConnectMode ? 'w-48 opacity-100 ml-1' : 'w-0 opacity-0 overflow-hidden'}`}
                             >
                                <div className="relative flex items-center">
                                    <input 
                                        type="text" 
                                        value={defaultRelLabel}
                                        onChange={(e) => {
                                            setDefaultRelLabel(e.target.value);
                                            setShowRelSuggestions(true);
                                        }}
                                        onFocus={() => setShowRelSuggestions(true)}
                                        placeholder="Type..."
                                        className="w-full pl-2 pr-6 py-1 text-xs border border-indigo-200 rounded bg-indigo-50/50 focus:bg-white focus:border-indigo-400 outline-none text-indigo-800 placeholder:text-indigo-300"
                                    />
                                    <button 
                                        onClick={() => setShowRelSuggestions(!showRelSuggestions)}
                                        className="absolute right-1 text-indigo-400 hover:text-indigo-600"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Suggestions Dropdown */}
                                {showRelSuggestions && isConnectMode && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 origin-top-left">
                                        {filteredRelTypes.length > 0 ? (
                                            filteredRelTypes.map((type) => (
                                                <button
                                                    key={type}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); // Prevent input blur
                                                        setDefaultRelLabel(type);
                                                        setShowRelSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 flex items-center justify-between group"
                                                >
                                                    {type}
                                                    {defaultRelLabel === type && <Check className="w-3 h-3 text-indigo-500" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-gray-400 italic">No existing matches</div>
                                        )}
                                        {defaultRelLabel && !filteredRelTypes.includes(defaultRelLabel) && (
                                             <div className="px-3 py-2 text-xs text-indigo-600 bg-indigo-50/50 border-t border-indigo-100 italic">
                                                New: "{defaultRelLabel}"
                                             </div>
                                        )}
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

            {/* Bottom Controls */}
            <div className="absolute bottom-6 left-6 z-10 flex gap-2 pointer-events-auto">
                 <div className="bg-white/90 backdrop-blur p-1 rounded-xl border border-gray-200 shadow-sm flex flex-col text-slate-600">
                     <button onClick={() => transformRef.current.k *= 1.2} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ZoomIn className="w-5 h-5" /></button>
                     <button onClick={() => transformRef.current.k /= 1.2} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ZoomOut className="w-5 h-5" /></button>
                     <div className="h-px w-6 bg-slate-200 mx-auto my-1"></div>
                     <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><Maximize className="w-5 h-5" /></button>
                 </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="absolute top-20 right-4 z-50 w-64 bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-5 animate-slide-up pointer-events-auto">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">{I18N.graph_settings[language]}</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 mb-2 block flex justify-between">
                                {I18N.repulsion_strength[language]} <span className="text-slate-400">{repulsion}</span>
                            </label>
                            <input type="range" min="100" max="2000" value={repulsion} onChange={e => setRepulsion(Number(e.target.value))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 mb-2 block flex justify-between">
                                {I18N.link_distance[language]} <span className="text-slate-400">{linkDist}</span>
                            </label>
                            <input type="range" min="50" max="400" value={linkDist} onChange={e => setLinkDist(Number(e.target.value))} className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                             <div className="flex items-center gap-3">
                                <input type="checkbox" checked={adaptiveText} onChange={e => setAdaptiveText(e.target.checked)} id="adaptiveText" className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="adaptiveText" className="text-sm text-slate-700 font-medium">{I18N.adaptive_text[language]}</label>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={doubleClickToFocus} onChange={e => setDoubleClickToFocus(e.target.checked)} id="doubleClickFocus" className="rounded text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="doubleClickFocus" className="text-sm text-slate-700 font-medium">{I18N.double_click_focus[language]}</label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas */}
            <canvas 
                ref={canvasRef}
                className={`flex-1 w-full h-full block touch-none ${isConnectMode ? 'cursor-crosshair' : (dragNodeRef.current ? 'cursor-grabbing' : 'cursor-grab')}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
            />

            {/* Selection Panel (Same as before) */}
            {selectedEntity && !isEditing && (
                <div className="absolute top-20 right-4 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-0 overflow-hidden animate-slide-up pointer-events-auto z-10 flex flex-col max-h-[calc(100vh-120px)]">
                    <div className="h-2 w-full flex-shrink-0" style={{backgroundColor: selectedEntity.customColor || data.categories.find(c=>c.id===selectedEntity.categoryId)?.color}}></div>
                    <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                        <div className="flex justify-between items-start mb-1">
                             <h2 className="font-bold text-xl text-slate-800 leading-tight">{selectedEntity.title}</h2>
                             <button onClick={() => setSelectedEntityId(null)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="mb-4">
                             <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{data.categories.find(c=>c.id===selectedEntity.categoryId)?.name}</span>
                        </div>
                        
                        <p className="text-sm text-slate-600 leading-relaxed mb-6">{selectedEntity.description || <span className="italic text-slate-400">{I18N.no_desc[language]}</span>}</p>
                        
                        {/* Focus Action */}
                        <div className="mb-6">
                            {focusNodeId === selectedEntity.id ? (
                                <button onClick={handleExitFocus} className="w-full py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-amber-100 transition-colors shadow-sm">
                                    <Target className="w-4 h-4 mr-2" /> {I18N.exit_focus[language]}
                                </button>
                            ) : (
                                <button onClick={() => handleEnterFocus(selectedEntity.id)} className="w-full py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm">
                                    <Focus className="w-4 h-4 mr-2" /> {I18N.focus_neighborhood[language]}
                                </button>
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
                                                        <input 
                                                            value={editingRelType}
                                                            onChange={(e) => setEditingRelType(e.target.value)}
                                                            className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded focus:border-indigo-500 outline-none"
                                                            placeholder="Type..."
                                                            autoFocus
                                                        />
                                                        <select
                                                            value={editingRelStyle}
                                                            onChange={(e) => setEditingRelStyle(e.target.value as LineStyle)}
                                                            className="w-20 px-1 py-1 text-xs border border-indigo-300 rounded bg-white outline-none"
                                                        >
                                                            <option value="solid">Solid</option>
                                                            <option value="dashed">Dashed</option>
                                                            <option value="dotted">Dotted</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={saveEditingRel} className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center"><Check className="w-3 h-3 mr-1" /> Save</button>
                                                        <button onClick={cancelEditingRel} className="px-2 py-1 bg-white border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 flex items-center"><X className="w-3 h-3 mr-1" /> Cancel</button>
                                                    </div>
                                                </div>
                                            );
                                         }

                                         return (
                                             <div key={rel.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-indigo-200 transition-colors group">
                                                 <div className="flex justify-between items-center mb-2">
                                                     <button onClick={() => setSelectedEntityId(rel.targetId)} className="text-sm font-semibold text-slate-700 truncate max-w-[150px] hover:text-indigo-600 text-left transition-colors">{target?.title || I18N.unknown_entity[language]}</button>
                                                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditingRel(rel.id, rel.type, rel.style || 'solid')} className="text-slate-300 hover:text-indigo-500 p-0.5" title="Rename"><Edit2 className="w-3 h-3" /></button>
                                                        <button onClick={() => deleteRel(rel.id)} className="text-slate-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                                     </div>
                                                 </div>
                                                 <div className="flex justify-between items-center">
                                                     <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">{rel.type}</span>
                                                     {/* Style & Color Toggles */}
                                                     <div className="flex gap-1.5 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <div className="flex bg-white rounded border border-slate-200 p-0.5 shadow-sm">
                                                            {['solid', 'dashed', 'dotted'].map(s => (
                                                                <button key={s} onClick={() => changeRelStyle(rel.id, s as LineStyle)} className={`w-4 h-4 rounded-sm flex items-center justify-center ${rel.style === s || (!rel.style && s==='solid') ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-400'}`}>
                                                                    <div className={`w-3 h-px bg-current ${s === 'dashed' ? 'border-t border-dashed' : s === 'dotted' ? 'border-t border-dotted' : ''}`}></div>
                                                                </button>
                                                            ))}
                                                         </div>
                                                         
                                                         <div className="relative">
                                                             <button 
                                                                onClick={(e) => { e.stopPropagation(); setActiveRelColorId(activeRelColorId === rel.id ? null : rel.id); }}
                                                                className="w-5 h-5 rounded border border-slate-200 flex items-center justify-center transition-colors hover:border-indigo-300 shadow-sm" 
                                                                style={{backgroundColor: rel.customColor || '#fff'}}
                                                                title="Change Color"
                                                             >
                                                                 <Palette className="w-3 h-3 text-slate-500 mix-blend-difference" />
                                                             </button>
                                                             
                                                             {activeRelColorId === rel.id && (
                                                                 <div className="absolute right-0 bottom-full mb-2 flex flex-wrap bg-white shadow-xl border border-gray-200 p-2 rounded-lg gap-1 z-50 w-32 animate-in fade-in zoom-in-95 origin-bottom-right">
                                                                     {COLORS.map(c => (
                                                                         <button 
                                                                            key={c} 
                                                                            onClick={(e) => { e.stopPropagation(); changeRelColor(rel.id, c); setActiveRelColorId(null); }} 
                                                                            className="w-5 h-5 rounded-full border border-gray-100 hover:scale-110 transition-transform shadow-sm" 
                                                                            style={{backgroundColor: c}}
                                                                         ></button>
                                                                     ))}
                                                                     <button 
                                                                        onClick={(e) => { e.stopPropagation(); changeRelColor(rel.id, ''); setActiveRelColorId(null); }} 
                                                                        className="w-5 h-5 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-100"
                                                                        title="Reset Color"
                                                                     >
                                                                        <X className="w-3 h-3 text-gray-400" />
                                                                     </button>
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
                            <button onClick={handleDelete} className="p-2.5 bg-white border border-red-100 hover:bg-red-50 text-red-500 rounded-xl transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}

            {isEditing && selectedEntity && <EntityEditor entity={selectedEntity} categories={data.categories} onClose={() => setIsEditing(false)} onSave={handleSaveEdit} onDelete={handleDelete} />}
            {isCreating && <EntityEditor categories={data.categories} onClose={() => setIsCreating(false)} onSave={(d) => { addEntity(d); setIsCreating(false); }} />}
        </div>
    );
};

export default GraphView;