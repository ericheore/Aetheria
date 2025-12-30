
import React, { useState, useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';
import { Entity } from '../types';
import EntityCard from '../components/EntityCard';
import EntityEditor from '../components/EntityEditor';
import TagFilter from '../components/TagFilter'; // Import
import { Plus, Search, Filter } from 'lucide-react';

const EntityManager = () => {
  const { data, language, addEntity, updateEntity, deleteEntity } = useWorld();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    data.entities.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [data.entities]);

  const filteredEntities = useMemo(() => {
    return data.entities.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || e.categoryId === selectedCategory;
      const matchesTag = selectedTag === 'all' || e.tags.includes(selectedTag);
      return matchesSearch && matchesCategory && matchesTag;
    });
  }, [data.entities, searchQuery, selectedCategory, selectedTag]);

  const handleCreate = () => {
    setEditingEntity(undefined);
    setIsEditorOpen(true);
  };

  const handleEdit = (entity: Entity) => {
    setEditingEntity(entity);
    setIsEditorOpen(true);
  };

  const handleSave = (entityData: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingEntity) {
      updateEntity(editingEntity.id, entityData);
    } else {
      addEntity(entityData);
    }
    setIsEditorOpen(false);
  };

  const handleDelete = () => {
    if (editingEntity) {
        deleteEntity(editingEntity.id);
        setIsEditorOpen(false);
    }
  }

  return (
    <div className="h-full flex flex-col p-8 animate-slide-up max-w-[1600px] mx-auto w-full">
      
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-extralight text-slate-800 tracking-tight">{I18N.entities[language]}</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">{filteredEntities.length} {I18N.entries_found[language]}</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto items-center">
           {/* Tag Filter (Replaces Select) */}
           <div className="w-full sm:w-48">
               <TagFilter 
                  tags={uniqueTags}
                  selectedTag={selectedTag}
                  onChange={setSelectedTag}
                  language={language}
               />
           </div>

           <div className="relative flex-1 min-w-[200px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
                type="text" 
                placeholder={I18N.search_placeholder[language]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all shadow-sm"
             />
           </div>
           
           <button 
             onClick={handleCreate}
             className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-md hover:shadow-lg flex items-center font-semibold whitespace-nowrap active:scale-95"
           >
             <Plus className="w-5 h-5 mr-2" />
             {I18N.create_new[language]}
           </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide -mx-2 px-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
            selectedCategory === 'all' 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
              : 'bg-white text-slate-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {I18N.all[language]}
        </button>
        {data.categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border flex items-center ${
              selectedCategory === cat.id
                ? 'bg-white border-current shadow-md ring-1 ring-offset-1'
                : 'bg-white text-slate-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50 opacity-80 hover:opacity-100'
            }`}
            style={selectedCategory === cat.id ? { color: cat.color, borderColor: cat.color, '--tw-ring-color': cat.color } as any : {}}
          >
            <span className="w-2 h-2 rounded-full mr-2 shadow-sm" style={{backgroundColor: cat.color}}></span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredEntities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
          {filteredEntities.map(entity => (
            <EntityCard 
              key={entity.id} 
              entity={entity} 
              category={data.categories.find(c => c.id === entity.categoryId)}
              onClick={() => handleEdit(entity)}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
           <div className="bg-slate-100 p-8 rounded-full mb-4 shadow-inner">
             <Filter className="w-10 h-10 text-slate-300" />
           </div>
           <p className="text-lg font-medium">{I18N.no_entities[language]}</p>
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <EntityEditor 
          entity={editingEntity}
          categories={data.categories}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSave}
          onDelete={editingEntity ? handleDelete : undefined}
        />
      )}

    </div>
  );
};

export default EntityManager;
