
import { useRef, useEffect } from 'react';
import { WorldData, GraphNode, Edge, LineStyle } from '../types';
import { GraphViewState } from '../context/ViewContext';

interface UseGraphPhysicsProps {
    data: WorldData;
    graphState: GraphViewState;
    containerRef: React.RefObject<HTMLDivElement>;
    focusNodeId: string | null;
    repulsion: number;
    linkDist: number;
    dragNodeId: string | null; // For fixing position during drag
}

export const useGraphPhysics = ({
    data,
    graphState,
    containerRef,
    focusNodeId,
    repulsion,
    linkDist,
    dragNodeId
}: UseGraphPhysicsProps) => {
    
    // Mutable references for the simulation loop
    const allNodesRef = useRef<GraphNode[]>([]); 
    const allEdgesRef = useRef<Edge[]>([]);
    const activeNodesRef = useRef<GraphNode[]>([]); 
    const activeEdgesRef = useRef<Edge[]>([]);

    // --- 1. Data Initialization (Positions & Topology) ---
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
        
        // Trigger filter update immediately
        updateActiveSimulationSet();

    }, [data, graphState.nodePositions]); 

    // --- 2. Focus Mode Logic (Filtering) ---
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

    // --- 3. Physics Simulation Step (The Tick) ---
    const tick = () => {
        const nodes = activeNodesRef.current;
        const edges = activeEdgesRef.current;
        
        nodes.forEach(n => { n.fx = 0; n.fy = 0; });

        // Force: Repulsion (Spatial Partitioning or simple loop loop optimization)
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

        // Force: Attraction (Springs)
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

        // Force: Center Gravity
        if (!focusNodeId) {
            nodes.forEach(n => {
                n.fx += (0 - n.x) * 0.01;
                n.fy += (0 - n.y) * 0.01;
            });
        }

        // Integration
        nodes.forEach(n => {
            if (n.id === dragNodeId) return; // Locked by mouse
            if (focusNodeId === n.id) { n.vx = 0; n.vy = 0; return; } // Locked by focus

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

    return {
        allNodesRef, // Exposed for saving positions
        activeNodesRef,
        activeEdgesRef,
        tick
    };
};
