
import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

// Define the state shape for different views
export interface GraphViewState {
    x: number;
    y: number;
    k: number;
    // Map of Node ID -> Coordinates
    nodePositions: Record<string, { x: number; y: number }>;
}

export interface TimelineViewState {
    scrollPosition: number;
    scale: number;
    viewMode: 'vertical' | 'horizontal';
    stickyLabels: boolean;
}

interface ViewContextType {
    // Graph State
    graphState: GraphViewState;
    setGraphState: (state: GraphViewState) => void;
    
    // Timeline State
    timelineState: TimelineViewState;
    setTimelineState: (state: TimelineViewState) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const ViewProvider = ({ children }: { children: ReactNode }) => {
    // Default States
    const [graphState, setGraphState] = useState<GraphViewState>({ 
        x: 0, 
        y: 0, 
        k: 0.8,
        nodePositions: {} // Initial empty map
    });
    
    const [timelineState, setTimelineState] = useState<TimelineViewState>({ 
        scrollPosition: 0, 
        scale: 4, 
        viewMode: 'vertical',
        stickyLabels: false
    });

    return (
        <ViewContext.Provider value={{
            graphState,
            setGraphState,
            timelineState,
            setTimelineState
        }}>
            {children}
        </ViewContext.Provider>
    );
};

export const useView = () => {
    const context = useContext(ViewContext);
    if (!context) throw new Error('useView must be used within a ViewProvider');
    return context;
};
