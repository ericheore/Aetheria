
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { WorldData, Entity, Category, WorldContextType, Language, CalendarConfig } from '../types';
import { loadWorld, saveWorld } from '../services/storage';
import { I18N } from '../constants';
import { useToast } from './ToastContext';

interface HistoryItem {
  data: WorldData;
  action: string;
}

// Extend context type for the new feature
interface ExtendedWorldContextType extends WorldContextType {
    renameEra: (eraId: string, newName: string) => void;
}

const WorldContext = createContext<ExtendedWorldContextType | undefined>(undefined);

export const WorldProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<WorldData>(loadWorld());
  const [language, setLanguage] = useState<Language>('zh');
  const { showToast } = useToast();

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Initialize history on load
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ data, action: 'Initial' }]);
      setHistoryIndex(0);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    saveWorld(data);
    if (isUndoRedoAction.current) {
       isUndoRedoAction.current = false;
    }
  }, [data]);

  // Helper to push history
  const pushHistory = (newData: WorldData, action: string) => {
      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          if (newHistory.length > 50) newHistory.shift(); // Limit history size
          return [...newHistory, { data: newData, action }];
      });
      setHistoryIndex(prev => Math.min(prev + 1, 50));
  };

  const undo = useCallback(() => {
      if (historyIndex > 0) {
          isUndoRedoAction.current = true;
          const prevItem = history[historyIndex - 1];
          const currentItem = history[historyIndex]; // The action we are undoing
          
          setHistoryIndex(prev => prev - 1);
          setData(prevItem.data);
          
          // Feedback
          const actionText = currentItem.action.startsWith('act_') ? I18N[currentItem.action][language] : currentItem.action;
          showToast(`${I18N.action_undone[language]}: ${actionText}`, 'info');
      }
  }, [history, historyIndex, language, showToast]);

  const redo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          isUndoRedoAction.current = true;
          const nextItem = history[historyIndex + 1];
          
          setHistoryIndex(prev => prev + 1);
          setData(nextItem.data);

          // Feedback
          const actionText = nextItem.action.startsWith('act_') ? I18N[nextItem.action][language] : nextItem.action;
          showToast(`${I18N.action_redone[language]}: ${actionText}`, 'info');
      }
  }, [history, historyIndex, language, showToast]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  redo();
              } else {
                  undo();
              }
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              redo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);


  const modifyData = (newData: WorldData, actionKey: string) => {
      pushHistory(newData, actionKey);
      setData(newData);
  };

  const addEntity = (entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>, actionMsg?: string) => {
    const newEntity: Entity = {
      ...entity,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const newData = {
      ...data,
      entities: [newEntity, ...data.entities],
      lastModified: Date.now(),
    };
    modifyData(newData, actionMsg || 'act_create_entity');
  };

  const updateEntity = (id: string, updates: Partial<Entity>, actionMsg?: string) => {
    const newData = {
      ...data,
      entities: data.entities.map(e => (e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e)),
      lastModified: Date.now(),
    };
    
    // Determine action description if not provided
    let action = 'act_update_entity';
    if (!actionMsg) {
        if (updates.relationships) action = 'act_update_rel';
    } else {
        action = actionMsg;
    }
    
    modifyData(newData, action);
  };

  const deleteEntity = (id: string) => {
    const newData = {
      ...data,
      entities: data.entities.filter(e => e.id !== id),
      lastModified: Date.now(),
    };
    modifyData(newData, 'act_delete_entity');
  };

  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...category,
      id: crypto.randomUUID(),
    };
    const newData = {
      ...data,
      categories: [...data.categories, newCategory],
    };
    modifyData(newData, 'act_create_cat');
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    const newData = {
      ...data,
      categories: data.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
      lastModified: Date.now(),
    };
    modifyData(newData, 'act_update_cat');
  };

  const deleteCategory = (id: string) => {
    const newData = {
      ...data,
      categories: data.categories.filter(c => c.id !== id),
      lastModified: Date.now(),
    };
    modifyData(newData, 'act_delete_cat');
  };

  const updateCalendar = (config: CalendarConfig) => {
      const newData = {
          ...data,
          calendarConfig: config,
          lastModified: Date.now()
      };
      modifyData(newData, 'act_update_calendar');
  };

  // Renames an era and updates all entities using it
  const renameEra = (eraId: string, newName: string) => {
      const config = data.calendarConfig || { eras: [], months: [], daysInYear: 365, useEras: true };
      
      const targetEra = config.eras.find(e => e.id === eraId);
      if (!targetEra) return;
      const oldName = targetEra.name;

      // 1. Update Config
      const newConfig = {
          ...config,
          eras: config.eras.map(e => e.id === eraId ? { ...e, name: newName } : e)
      };

      // 2. Update all Entities that used this Era (Text match based on old name)
      const eraKeys = ['era', 'epoch', 'age', '纪元', '时代'];
      const endEraKeys = ['end era', 'end epoch'];
      
      const newEntities = data.entities.map(e => {
          let hasChanges = false;
          const newAttributes = e.attributes.map(a => {
             const k = a.key.toLowerCase();
             if ((eraKeys.includes(k) || endEraKeys.includes(k)) && a.value === oldName) {
                 hasChanges = true;
                 return { ...a, value: newName };
             }
             return a;
          });

          if (hasChanges) {
              return { ...e, attributes: newAttributes, updatedAt: Date.now() };
          }
          return e;
      });

      const newData = {
          ...data,
          calendarConfig: newConfig,
          entities: newEntities,
          lastModified: Date.now()
      };
      
      modifyData(newData, 'act_update_calendar');
      showToast(`${I18N.act_update_calendar[language]}: Renamed ${oldName} to ${newName}`, 'success');
  };

  const exportData = () => JSON.stringify(data, null, 2);

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.entities && Array.isArray(parsed.categories)) {
        // Reset history on import
        setHistory([{ data: parsed, action: 'Import' }]);
        setHistoryIndex(0);
        setData(parsed);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  return (
    <WorldContext.Provider
      value={{
        data,
        language,
        setLanguage,
        addEntity,
        updateEntity,
        deleteEntity,
        addCategory,
        updateCategory,
        deleteCategory,
        updateCalendar,
        renameEra,
        exportData,
        importData,
        undo,
        redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1
      }}
    >
      {children}
    </WorldContext.Provider>
  );
};

export const useWorld = () => {
  const context = useContext(WorldContext);
  if (!context) throw new Error('useWorld must be used within a WorldProvider');
  return context as ExtendedWorldContextType;
};
