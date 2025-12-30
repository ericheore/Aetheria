
import { useState, useCallback, useRef } from 'react';
import { I18N } from '../constants';
import { useToast } from '../context/ToastContext';
import { Language } from '../types';

interface HistoryItem<T> {
  data: T;
  action: string;
}

export function useHistory<T>(initialData: T, language: Language) {
  const [history, setHistory] = useState<HistoryItem<T>[]>([{ data: initialData, action: 'Initial' }]);
  const [index, setIndex] = useState(0);
  const { showToast } = useToast();
  
  // Ref to track if the current update is caused by undo/redo to avoid pushing to history
  const isUndoRedoAction = useRef(false);

  const push = useCallback((newData: T, action: string) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, index + 1);
      // Limit history stack size to 50
      if (newHistory.length > 50) newHistory.shift(); 
      return [...newHistory, { data: newData, action }];
    });
    setIndex(prev => Math.min(prev + 1, 50));
  }, [index]);

  const undo = useCallback(() => {
    if (index > 0) {
      isUndoRedoAction.current = true;
      const prevItem = history[index - 1];
      const currentItem = history[index];
      
      setIndex(prev => prev - 1);
      
      // Feedback
      const actionKey = currentItem.action;
      // Check if the key exists in I18N, otherwise show raw text
      const actionText = (actionKey.startsWith('act_') && I18N[actionKey]) 
        ? I18N[actionKey][language] 
        : actionKey;
        
      showToast(`${I18N.action_undone[language]}: ${actionText}`, 'info');
      
      return prevItem.data;
    }
    return null;
  }, [history, index, language, showToast]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextItem = history[index + 1];
      
      setIndex(prev => prev + 1);

      // Feedback
      const actionKey = nextItem.action;
      const actionText = (actionKey.startsWith('act_') && I18N[actionKey]) 
        ? I18N[actionKey][language] 
        : actionKey;

      showToast(`${I18N.action_redone[language]}: ${actionText}`, 'info');
      
      return nextItem.data;
    }
    return null;
  }, [history, index, language, showToast]);

  const reset = useCallback((data: T) => {
      setHistory([{ data, action: 'Reset' }]);
      setIndex(0);
  }, []);

  return {
    state: history[index].data,
    push,
    undo,
    redo,
    reset,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    isUndoRedoAction
  };
}
