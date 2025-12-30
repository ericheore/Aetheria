
import React, { memo } from 'react';
import { Entity, Category } from '../types';
import { I18N } from '../constants';
import { useWorld } from '../context/WorldContext';
import { Calendar, Hash, ArrowRight } from 'lucide-react';

interface EntityCardProps {
  entity: Entity;
  category?: Category;
  onClick: () => void;
}

// Optimization: Use memo to prevent re-renders of list items when parent state changes but entity doesn't
const EntityCard: React.FC<EntityCardProps> = memo(({ entity, category, onClick }) => {
  const { language } = useWorld();

  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      {/* Decorative top bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: category?.color || '#cbd5e1' }}></div>
      
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {category && (
              <span 
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-opacity-10 tracking-wider"
                style={{ backgroundColor: `${category.color}15`, color: category.color }}
              >
                {category.name}
              </span>
            )}
          </div>
        </div>
        
        <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-primary-600 transition-colors leading-tight">
          {entity.title}
        </h3>
        
        <p className="text-sm text-slate-500 line-clamp-3 mb-5 flex-1 leading-relaxed">
          {entity.description || <span className="italic opacity-50">{I18N.no_desc[language]}</span>}
        </p>
        
        <div className="flex flex-col gap-3 mt-auto">
             {entity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entity.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className="flex items-center text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-md">
                    <Hash className="w-2.5 h-2.5 mr-0.5 opacity-40" />
                    {tag}
                  </span>
                ))}
                {entity.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400 px-1.5 py-0.5">+ {entity.tags.length - 3}</span>
                )}
              </div>
            )}
            
            <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 flex items-center font-mono">
                    <Calendar className="w-3 h-3 mr-1.5 opacity-70" />
                    {new Date(entity.updatedAt).toLocaleDateString()}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-primary-500 -translate-x-2 group-hover:translate-x-0 duration-300">
                    <ArrowRight className="w-4 h-4" />
                </span>
            </div>
        </div>
      </div>
    </div>
  );
});

export default EntityCard;
