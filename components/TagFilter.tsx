
import React, { useState, useRef, useEffect } from 'react';
import { Filter, Search, Check, X, Hash } from 'lucide-react';
import { I18N } from '../constants';

interface TagFilterProps {
  tags: string[];
  selectedTag: string;
  onChange: (tag: string) => void;
  language: string;
  className?: string;
}

const TagFilter: React.FC<TagFilterProps> = ({ tags, selectedTag, onChange, language, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTags = tags.filter(tag => 
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (tag: string) => {
    onChange(tag);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-sm transition-all ${
            isOpen ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300'
        } ${selectedTag !== 'all' ? 'text-primary-700 bg-primary-50 border-primary-200' : 'text-gray-700'}`}
      >
        <div className="flex items-center overflow-hidden">
            <Hash className={`w-4 h-4 mr-2 flex-shrink-0 ${selectedTag !== 'all' ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className="truncate max-w-[120px]">
                {selectedTag === 'all' ? I18N.all[language] : selectedTag}
            </span>
        </div>
        {selectedTag !== 'all' && (
            <div 
                onClick={(e) => { e.stopPropagation(); onChange('all'); }}
                className="ml-2 p-0.5 rounded-full hover:bg-primary-200 text-primary-500"
            >
                <X className="w-3 h-3" />
            </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 origin-top-left flex flex-col max-h-80">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Filter tags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-primary-500 focus:bg-white transition-colors"
                    />
                </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                <button
                    onClick={() => handleSelect('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-gray-50 mb-1 ${selectedTag === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                >
                    <span>{I18N.all[language]}</span>
                    {selectedTag === 'all' && <Check className="w-4 h-4" />}
                </button>
                
                {filteredTags.length > 0 ? (
                    filteredTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => handleSelect(tag)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-gray-50 ${selectedTag === tag ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'}`}
                        >
                            <span className="truncate">#{tag}</span>
                            {selectedTag === tag && <Check className="w-4 h-4" />}
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-3 text-xs text-gray-400 text-center italic">
                        No tags found
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default TagFilter;
