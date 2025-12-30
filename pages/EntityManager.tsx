
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
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-light text-gray-900">{I18N.entities[language]}</h1>
          <p className="text-sm text-gray-500">{filteredEntities.length} {I18N.entries_found[language]}</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
           {/* Tag Filter (Replaces Select) */}
           <div className="w-40">
               <TagFilter 
                  tags={uniqueTags}
                  selectedTag={selectedTag}
                  onChange={setSelectedTag}
                  language={language}
               />
           </div>

           <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input 
                type="text" 
                placeholder={I18N.search_placeholder[language]}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
             />
           </div>
           
           <button 
             onClick={handleCreate}
             className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center shadow-sm font-medium whitespace-nowrap"
           >
             <Plus className="w-4 h-4 mr-2" />
             {I18N.create_new[language]}
           </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
            selectedCategory === 'all' 
              ? 'bg-gray-800 text-white border-gray-800' 
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {I18N.all[language]}
        </button>
        {data.categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border flex items-center ${
              selectedCategory === cat.id
                ? 'bg-white border-current shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 opacity-80 hover:opacity-100'
            }`}
            style={selectedCategory === cat.id ? { color: cat.color, borderColor: cat.color } : {}}
          >
            <span className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: cat.color}}></span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredEntities.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
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
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
           <div className="bg-gray-100 p-6 rounded-full mb-4">
             <Filter className="w-8 h-8 text-gray-300" />
           </div>
           <p>{I18N.no_entities[language]}</p>
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
