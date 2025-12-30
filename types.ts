
// Core Types for Extensibility

export type Language = 'zh' | 'en';

export interface Translation {
  [key: string]: {
    zh: string;
    en: string;
  };
}

// A flexible Attribute system allows for RPG stats, dates, or metadata
export interface Attribute {
  key: string;
  value: string;
}

// Categories allow the user to define "Types" (e.g., Character, Location, Spell)
// Templates allow enforcing specific attributes for entities of this category.
export interface Category {
  id: string;
  name: string;
  color: string; // Hex code for UI identification
  icon?: string; // Icon name from Lucide
  template?: Attribute[]; // New: Default attributes for new entities
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface Relationship {
  id: string;
  targetId: string;
  type: string; // e.g. "Friend of", "Located in"
  style?: LineStyle; // Visual style of the link
  customColor?: string; // Specific color for this link
  width?: number; // New: Line thickness (1-5)
}

export type NodeShape = 'circle' | 'square' | 'diamond' | 'hexagon';

// The core unit of the world
export interface Entity {
  id: string;
  categoryId: string;
  title: string;
  description: string; // Main content (Markdown-lite)
  tags: string[];
  attributes: Attribute[];
  relationships?: Relationship[]; // New: Graph connections
  parentId?: string; // For hierarchical structures (e.g., City inside a Country)
  customColor?: string; // Overrides category color
  customScale?: number; // Multiplier for node radius (0.5 - 2.0)
  customShape?: NodeShape; // New: Visual shape
  createdAt: number;
  updatedAt: number;
}

// Custom Calendar System for World Building
export interface Era {
    id: string;
    name: string;
    startYear?: number;
    endYear?: number;
    description?: string;
}

export interface CalendarConfig {
  eras: Era[]; // Changed from string[] to Era objects
  months: { name: string; days: number }[]; 
  daysInYear: number; 
  useEras: boolean;
  currentYear?: number; // The "Now" of the world
}

export interface WorldData {
  name: string;
  categories: Category[];
  entities: Entity[];
  lastModified: number;
  calendarConfig?: CalendarConfig; // New: Calendar settings
}

// For state management context
export interface WorldContextType {
  data: WorldData;
  language: Language;
  setLanguage: (lang: Language) => void;
  addEntity: (entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>, actionMsg?: string) => void;
  updateEntity: (id: string, updates: Partial<Entity>, actionMsg?: string) => void;
  deleteEntity: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void; // New: Needed for editing templates
  deleteCategory: (id: string) => void;
  updateCalendar: (config: CalendarConfig) => void; // New
  renameEra: (eraId: string, newName: string) => void; // Updated signature
  exportData: () => string;
  importData: (json: string) => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
