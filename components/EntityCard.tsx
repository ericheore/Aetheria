import React from 'react';
import { Entity, Category } from '../types';
import { I18N } from '../constants';
import { useWorld } from '../context/WorldContext';
import { Calendar, Hash } from 'lucide-react';

interface EntityCardProps {
  entity: Entity;
  category?: Category;
  onClick: () => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, category, onClick }) => {
  const { language } = useWorld();

  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
    >
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center space-x-2">
            {category && (
              <span 
                className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 flex items-center">
             <Calendar className="w-3 h-3 mr-1" />
             {new Date(entity.updatedAt).toLocaleDateString()}
          </span>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-800 mb-2 group-hover:text-primary-600 transition-colors">
          {entity.title}
        </h3>
        
        <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
          {entity.description || I18N.no_desc[language]}
        </p>
        
        {entity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-3 border-t border-gray-50">
            {entity.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="flex items-center text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                <Hash className="w-3 h-3 mr-0.5 opacity-50" />
                {tag}
              </span>
            ))}
            {entity.tags.length > 3 && (
              <span className="text-xs text-gray-400 px-1.5 py-0.5">+ {entity.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityCard;
