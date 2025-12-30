
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WorldData, Entity, Category, WorldContextType, Language, CalendarConfig } from '../types';
import { loadWorld, saveWorld } from '../services/storage';
import { I18N } from '../constants';
import { useToast } from './ToastContext';
import { useHistory } from '../hooks/useHistory';

// Extend context type for the new feature
interface ExtendedWorldContextType extends WorldContextType {
    renameEra: (eraId: string, newName: string) => void;
}

const WorldContext = createContext<ExtendedWorldContextType | undefined>(undefined);

export const WorldProvider = ({ children }: { children: ReactNode }) => {
  // 1. Core State
  const [language, setLanguage] = useState<Language>('zh');
  const { showToast } = useToast();

  // 2. History & Data Management Hook
  // We initialize the hook with loaded data.
  const history = useHistory<WorldData>(loadWorld(), language);
  const data = history.state;

  // 3. Persistence Effect
  useEffect(() => {
    saveWorld(data);
    if (history.isUndoRedoAction.current) {
       history.isUndoRedoAction.current = false;
    }
  }, [data, history.isUndoRedoAction]);

  // 4. Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              e.shiftKey ? history.redo() : history.undo();
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              history.redo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  // --- CRUD Operations (Proxies to History Push) ---

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
    history.push(newData, actionMsg || 'act_create_entity');
  };

  const updateEntity = (id: string, updates: Partial<Entity>, actionMsg?: string) => {
    const newData = {
      ...data,
      entities: data.entities.map(e => (e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e)),
      lastModified: Date.now(),
    };
    let action = actionMsg || 'act_update_entity';
    if (!actionMsg && updates.relationships) action = 'act_update_rel';
    
    history.push(newData, action);
  };

  const deleteEntity = (id: string) => {
    const newData = {
      ...data,
      entities: data.entities.filter(e => e.id !== id),
      lastModified: Date.now(),
    };
    history.push(newData, 'act_delete_entity');
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
    history.push(newData, 'act_create_cat');
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    const newData = {
      ...data,
      categories: data.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
      lastModified: Date.now(),
    };
    history.push(newData, 'act_update_cat');
  };

  const deleteCategory = (id: string) => {
    const newData = {
      ...data,
      categories: data.categories.filter(c => c.id !== id),
      lastModified: Date.now(),
    };
    history.push(newData, 'act_delete_cat');
  };

  const updateCalendar = (config: CalendarConfig) => {
      const newData = {
          ...data,
          calendarConfig: config,
          lastModified: Date.now()
      };
      history.push(newData, 'act_update_calendar');
  };

  const renameEra = (eraId: string, newName: string) => {
      const config = data.calendarConfig || { eras: [], months: [], daysInYear: 365, useEras: true };
      const targetEra = config.eras.find(e => e.id === eraId);
      if (!targetEra) return;
      
      const oldName = targetEra.name;
      const newConfig = {
          ...config,
          eras: config.eras.map(e => e.id === eraId ? { ...e, name: newName } : e)
      };

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
          if (hasChanges) return { ...e, attributes: newAttributes, updatedAt: Date.now() };
          return e;
      });

      const newData = {
          ...data,
          calendarConfig: newConfig,
          entities: newEntities,
          lastModified: Date.now()
      };
      
      history.push(newData, 'act_update_calendar');
      showToast(`${I18N.act_update_calendar[language]}: Renamed ${oldName} to ${newName}`, 'success');
  };

  const exportData = () => JSON.stringify(data, null, 2);

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.entities && Array.isArray(parsed.categories)) {
        history.reset(parsed);
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
        undo: history.undo,
        redo: history.redo,
        canUndo: history.canUndo,
        canRedo: history.canRedo
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
