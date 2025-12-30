
import React, { useState, useEffect, useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';
import { Attribute, Category } from '../types';
import { Plus, Trash2, Tag, Edit3, X, AlertTriangle, LayoutGrid, List, Search, ArrowUpDown, Database, Save } from 'lucide-react';

const CategoryManager = () => {
  const { data, language, addCategory, updateCategory, deleteCategory } = useWorld();
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  
  // State for editing a specific category
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [tempTemplate, setTempTemplate] = useState<Attribute[]>([]);
  // Added fields for basic info editing
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // State for delete confirmation (Two-step delete)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'count'>('count');

  // Auto-reset delete confirmation after 3 seconds
  useEffect(() => {
    if (deleteConfirmId) {
      const timer = setTimeout(() => {
        setDeleteConfirmId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirmId]);

  // Derived Data
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data.entities.forEach(e => {
        counts[e.categoryId] = (counts[e.categoryId] || 0) + 1;
    });
    return counts;
  }, [data.entities]);

  const filteredCategories = useMemo(() => {
      let cats = data.categories.filter(c => 
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (sortMode === 'name') {
          cats.sort((a, b) => a.name.localeCompare(b.name));
      } else {
          cats.sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0));
      }
      return cats;
  }, [data.categories, searchQuery, sortMode, categoryCounts]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName,
      color: newCatColor,
      template: []
    });
    setNewCatName('');
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmId === id) {
      deleteCategory(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
    }
  };

  const startEditing = (cat: Category) => {
    setEditingCatId(cat.id);
    setTempTemplate(cat.template || []);
    setEditName(cat.name);
    setEditColor(cat.color);
    setDeleteConfirmId(null);
  };

  const saveCategoryChanges = () => {
    if (editingCatId) {
      updateCategory(editingCatId, { 
          name: editName,
          color: editColor,
          template: tempTemplate 
      });
      setEditingCatId(null);
    }
  };

  const addTemplateField = () => {
    setTempTemplate([...tempTemplate, { key: '', value: '' }]);
  };

  const updateTemplateField = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...tempTemplate];
    next[index][field] = val;
    setTempTemplate(next);
  };

  const removeTemplateField = (index: number) => {
    setTempTemplate(tempTemplate.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-light text-gray-900">{I18N.categories[language]}</h1>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
             <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title={I18N.grid_view[language]}
             >
                 <LayoutGrid className="w-4 h-4" />
             </button>
             <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title={I18N.list_view[language]}
             >
                 <List className="w-4 h-4" />
             </button>
        </div>
      </div>

      {/* Tools Row */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
          
          {/* Create New - Simplified Layout */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-1 lg:max-w-md">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">{I18N.create_category[language]}</h2>
            <form onSubmit={handleAdd} className="flex gap-2">
              <div className="flex-1">
                <input 
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                    placeholder="e.g. Ancient Relics"
                />
              </div>
              <div className="relative w-10">
                   <input 
                      type="color" 
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                   />
                   <div className="w-full h-full rounded-lg border border-gray-300" style={{backgroundColor: newCatColor}}></div>
              </div>
              <button 
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm whitespace-nowrap"
              >
                {I18N.save[language]}
              </button>
            </form>
          </div>

          {/* Search & Sort */}
          <div className="flex-1 flex gap-3">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none h-full"
                     placeholder={I18N.search_categories[language]}
                  />
              </div>
              <button 
                  onClick={() => setSortMode(sortMode === 'count' ? 'name' : 'count')}
                  className="px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 flex items-center gap-2 whitespace-nowrap shadow-sm"
              >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="text-sm font-medium">{sortMode === 'count' ? 'Count' : 'Name'}</span>
              </button>
          </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm transition-all hover:shadow-md">
                
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/30">
                    {editingCatId === cat.id ? (
                        // Edit Mode Header
                        <div className="flex gap-2 items-center">
                            <input 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-primary-500 outline-none"
                            />
                            <div className="relative w-6 h-6 flex-shrink-0">
                                <input 
                                    type="color" 
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="w-full h-full rounded border border-gray-300" style={{backgroundColor: editColor}}></div>
                            </div>
                        </div>
                    ) : (
                        // View Mode Header
                        <div className="flex items-center justify-between">
                            <div className="flex items-center overflow-hidden">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 shadow-sm" style={{backgroundColor: cat.color}}>
                                    <Tag className="w-4 h-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate" title={cat.name}>{cat.name}</h3>
                                    <p className="text-[10px] text-gray-400 font-mono truncate">{categoryCounts[cat.id] || 0} {I18N.entity_count[language]}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-4 flex-1">
                    {editingCatId === cat.id ? (
                        <TemplateEditor 
                            fields={tempTemplate} 
                            onUpdate={updateTemplateField} 
                            onAdd={addTemplateField} 
                            onRemove={removeTemplateField} 
                            onSave={saveCategoryChanges} 
                            onCancel={() => setEditingCatId(null)}
                            language={language}
                        />
                    ) : (
                        <TemplatePreview cat={cat} language={language} />
                    )}
                </div>

                {/* Footer */}
                {editingCatId !== cat.id && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center h-14">
                        <button 
                            onClick={() => startEditing(cat)} 
                            className="text-gray-600 hover:text-primary-600 text-xs font-medium flex items-center transition-colors px-2 py-1 rounded hover:bg-white"
                        >
                            <Edit3 className="w-3 h-3 mr-1.5" /> 
                            {I18N.edit[language]}
                        </button>
                        <DeleteButton 
                            isConfirming={deleteConfirmId === cat.id}
                            onClick={() => handleDeleteClick(cat.id)}
                            language={language}
                        />
                    </div>
                )}
            </div>
            ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                          <th className="px-6 py-4">{I18N.name[language]}</th>
                          <th className="px-6 py-4 w-32 text-center">{I18N.entity_count[language]}</th>
                          <th className="px-6 py-4">{I18N.template_fields[language]}</th>
                          <th className="px-6 py-4 w-40 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredCategories.map(cat => (
                          <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                  {editingCatId === cat.id ? (
                                     <div className="flex items-center gap-2">
                                          <div className="relative w-6 h-6 flex-shrink-0">
                                                <input 
                                                    type="color" 
                                                    value={editColor}
                                                    onChange={(e) => setEditColor(e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                <div className="w-full h-full rounded border border-gray-300" style={{backgroundColor: editColor}}></div>
                                            </div>
                                            <input 
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:border-primary-500 outline-none"
                                            />
                                     </div>
                                  ) : (
                                     <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm" style={{backgroundColor: cat.color}}>
                                              <Tag className="w-4 h-4 text-white" />
                                          </div>
                                          <div>
                                              <div className="font-semibold text-gray-800">{cat.name}</div>
                                              <div className="text-[10px] text-gray-400 font-mono">{cat.id}</div>
                                          </div>
                                     </div>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      <Database className="w-3 h-3 mr-1 text-gray-400"/>
                                      {categoryCounts[cat.id] || 0}
                                  </span>
                              </td>
                              <td className="px-6 py-4">
                                  {editingCatId === cat.id ? (
                                      <TemplateEditor 
                                        fields={tempTemplate} 
                                        onUpdate={updateTemplateField} 
                                        onAdd={addTemplateField} 
                                        onRemove={removeTemplateField} 
                                        onSave={saveCategoryChanges} 
                                        onCancel={() => setEditingCatId(null)}
                                        language={language}
                                        compact
                                    />
                                  ) : (
                                      <div className="flex flex-wrap gap-2">
                                          {cat.template && cat.template.length > 0 ? (
                                              cat.template.map((t, i) => (
                                                  <span key={i} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600">
                                                      <span className="font-medium text-gray-800">{t.key}</span>
                                                      {t.value && <span className="text-gray-400 ml-1">: {t.value}</span>}
                                                  </span>
                                              ))
                                          ) : (
                                              <span className="text-xs text-gray-400 italic">No template</span>
                                          )}
                                      </div>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                  {editingCatId !== cat.id && (
                                      <div className="flex justify-end gap-2">
                                          <button 
                                              onClick={() => startEditing(cat)}
                                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                          >
                                              <Edit3 className="w-4 h-4" />
                                          </button>
                                          <DeleteButton 
                                            isConfirming={deleteConfirmId === cat.id}
                                            onClick={() => handleDeleteClick(cat.id)}
                                            language={language}
                                            iconOnly
                                          />
                                      </div>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

// Sub-components for cleaner render logic

const TemplatePreview = ({ cat, language }: { cat: Category, language: string }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{I18N.template_fields[language]}</h4>
        </div>
        
        {(cat.template && cat.template.length > 0) ? (
            <div className="space-y-1.5">
                {cat.template.map((field, i) => (
                    <div key={i} className="text-sm flex justify-between items-center bg-gray-50 px-2 py-1.5 rounded border border-gray-100">
                        <span className="text-gray-700 font-medium text-xs">{field.key}</span>
                        <span className="text-gray-400 text-xs italic truncate max-w-[50%]">{field.value || '-'}</span>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-xs text-gray-400 italic py-4 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                {I18N.template_help[language]}
            </div>
        )}
    </div>
);

const TemplateEditor = ({ fields, onUpdate, onAdd, onRemove, onSave, onCancel, language, compact = false }: any) => (
    <div className={`space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 ${compact ? 'bg-white' : ''}`}>
        {!compact && (
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-primary-600 uppercase">{I18N.editing_template[language]}</span>
            </div>
        )}
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {fields.map((field: Attribute, idx: number) => (
                <div key={idx} className="flex gap-2">
                    <input 
                        value={field.key}
                        onChange={(e) => onUpdate(idx, 'key', e.target.value)}
                        placeholder="Key"
                        className="w-1/2 px-2 py-1 text-xs border border-gray-300 rounded focus:border-primary-500 outline-none"
                        autoFocus={idx === fields.length - 1}
                    />
                    <input 
                        value={field.value}
                        onChange={(e) => onUpdate(idx, 'value', e.target.value)}
                        placeholder="Default"
                        className="w-1/2 px-2 py-1 text-xs border border-gray-300 rounded focus:border-primary-500 outline-none"
                    />
                    <button onClick={() => onRemove(idx)} className="text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            ))}
            {fields.length === 0 && (
                <div className="text-center py-2 text-xs text-gray-400 italic border border-dashed border-gray-200 rounded">
                    {I18N.no_fields[language]}
                </div>
            )}
        </div>
        <div className="flex justify-between pt-1">
            <button onClick={onAdd} className="text-xs text-primary-600 flex items-center hover:underline font-medium">
                <Plus className="w-3 h-3 mr-1" /> {I18N.add_field[language]}
            </button>
            <div className="flex gap-2">
                <button onClick={onCancel} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">{I18N.cancel[language]}</button>
                <button onClick={onSave} className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 shadow-sm">
                    <Save className="w-3 h-3" />
                    {I18N.save[language]}
                </button>
            </div>
        </div>
    </div>
);

const DeleteButton = ({ isConfirming, onClick, language, iconOnly = false }: any) => (
    <button 
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className={`text-xs font-medium flex items-center transition-all rounded ${
            isConfirming 
            ? 'bg-red-600 text-white border border-red-700 hover:bg-red-700 shadow-sm animate-pulse px-3 py-1.5' 
            : (iconOnly ? 'text-gray-400 hover:text-red-500 hover:bg-red-50 p-2' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 px-3 py-1.5')
        }`}
        title={isConfirming ? I18N.click_again[language] : I18N.delete_category_tooltip[language]}
    >
        {isConfirming ? (
            <>
                <AlertTriangle className="w-3 h-3 mr-1.5" />
                {!iconOnly && I18N.confirm_action[language]}
            </>
        ) : (
            <>
                <Trash2 className={`${iconOnly ? 'w-4 h-4' : 'w-3 h-3 mr-1.5'} pointer-events-none`} />
                {!iconOnly && I18N.delete[language]}
            </>
        )}
    </button>
);

export default CategoryManager;
