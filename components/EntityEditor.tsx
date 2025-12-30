
import React, { useState, useMemo, useEffect } from 'react';
import { Entity, Category, Attribute, Relationship, NodeShape, LineStyle } from '../types';
import { I18N } from '../constants';
import { useWorld } from '../context/WorldContext';
import { X, Plus, Trash2, Save, Link as LinkIcon, FileText, Check, Edit2, Palette, Circle, Square, Hexagon, Diamond, CalendarClock, ArrowRight, AlertTriangle, MessageSquare } from 'lucide-react';

interface EntityEditorProps {
  entity?: Entity;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  initialAttributes?: Attribute[]; 
  initialCategoryId?: string; 
  initialHasChronology?: boolean; // New Prop
}

type Tab = 'content' | 'relationships' | 'visuals';

const EntityEditor: React.FC<EntityEditorProps> = ({ 
    entity, 
    categories, 
    onClose, 
    onSave, 
    onDelete, 
    initialAttributes, 
    initialCategoryId,
    initialHasChronology = false 
}) => {
  const { language, data } = useWorld();
  const [activeTab, setActiveTab] = useState<Tab>('content');

  const [title, setTitle] = useState(entity?.title || '');
  const [nodeNote, setNodeNote] = useState(entity?.nodeNote || '');
  const [categoryId, setCategoryId] = useState(entity?.categoryId || initialCategoryId || categories[0]?.id || '');
  const [description, setDescription] = useState(entity?.description || '');
  const [tags, setTags] = useState<string[]>(entity?.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  // Attributes management: We split generic attributes from Chronology for better UI
  const [genericAttributes, setGenericAttributes] = useState<Attribute[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>(entity?.relationships || []);
  
  // -- Chronology State --
  const [hasChronology, setHasChronology] = useState(initialHasChronology);
  const [isRange, setIsRange] = useState(false);
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [startEra, setStartEra] = useState('');
  const [endEra, setEndEra] = useState('');
  const [customMonth, setCustomMonth] = useState('');
  const [customDay, setCustomDay] = useState('');

  // Delete Confirmation State
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  // Initialize Attributes Split
  useEffect(() => {
    const allAttrs = entity?.attributes || initialAttributes || [];
    const chronoKeys = ['year', 'start year', 'end year', 'date', 'era', 'end era', 'epoch', 'start epoch', 'end epoch', 'month', 'day', '年份', '纪元', '结束年份'];
    
    const generics: Attribute[] = [];
    let foundChrono = false;
    let sYear = '', eYear = '', sEra = '', eEra = '', month = '', day = '';

    allAttrs.forEach(a => {
        const k = a.key.toLowerCase();
        if (chronoKeys.includes(k)) {
            foundChrono = true;
            if (k.includes('end year') || k.includes('结束年份')) eYear = a.value;
            else if (k.includes('year') || k.includes('年份') || k === 'date') sYear = a.value;
            else if (k === 'end era' || k.includes('end epoch')) eEra = a.value;
            else if (k.includes('era') || k.includes('epoch') || k.includes('纪元')) sEra = a.value;
            else if (k.includes('month') || k === '月') month = a.value;
            else if (k.includes('day') || k === '日') day = a.value;
        } else {
            generics.push({ ...a });
        }
    });

    setGenericAttributes(generics);
    // If specifically requested via prop, ensure it's true, otherwise check data
    setHasChronology(initialHasChronology || foundChrono || (!!initialAttributes && initialAttributes.some(a => chronoKeys.includes(a.key.toLowerCase()))));
    
    setStartYear(sYear);
    setEndYear(eYear);
    setIsRange(!!eYear);
    setStartEra(sEra);
    setEndEra(eEra);
    setCustomMonth(month);
    setCustomDay(day);
  }, [entity, initialAttributes]); // Note: excluding initialHasChronology to prevent reset on re-render

  // Visuals State
  const [customColor, setCustomColor] = useState(entity?.customColor || '');
  const [customScale, setCustomScale] = useState(entity?.customScale || 1.0);
  const [customShape, setCustomShape] = useState<NodeShape>(entity?.customShape || 'circle');

  // Relationship State
  const [newRelTargetId, setNewRelTargetId] = useState('');
  const [newRelType, setNewRelType] = useState('');
  const [newRelStyle, setNewRelStyle] = useState<LineStyle>('solid');
  
  // Editing Relationship State
  const [editingRelId, setEditingRelId] = useState<string | null>(null);
  const [editingRelType, setEditingRelType] = useState('');
  const [editingRelStyle, setEditingRelStyle] = useState<LineStyle>('solid');

  const currentCategory = categories.find(c => c.id === categoryId);
  const otherEntities = useMemo(() => data.entities.filter(e => e.id !== entity?.id), [data.entities, entity?.id]);
  const eras = data.calendarConfig?.eras || [];

  // Auto-detect Era based on Year
  const handleYearChange = (val: string, isStart: boolean) => {
      if (isStart) setStartYear(val); else setEndYear(val);

      const y = parseInt(val);
      if (!isNaN(y)) {
          const matchingEra = eras.find(e => 
              (e.startYear !== undefined ? y >= e.startYear : true) && 
              (e.endYear !== undefined ? y <= e.endYear : true)
          );
          if (matchingEra) {
              if (isStart) setStartEra(matchingEra.name);
              else setEndEra(matchingEra.name);
          }
      }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Reconstruct Attributes
    const finalAttributes = [...genericAttributes];
    if (hasChronology) {
        if (startYear) finalAttributes.push({ key: 'Year', value: startYear });
        if (startEra) finalAttributes.push({ key: 'Era', value: startEra });
        if (isRange && endYear) finalAttributes.push({ key: 'End Year', value: endYear });
        if (isRange && endEra && endEra !== startEra) finalAttributes.push({ key: 'End Era', value: endEra });
        if (customMonth) finalAttributes.push({ key: 'Month', value: customMonth });
        if (customDay) finalAttributes.push({ key: 'Day', value: customDay });
    }

    onSave({
      categoryId,
      title,
      nodeNote,
      description,
      tags,
      attributes: finalAttributes,
      relationships,
      customColor: customColor || undefined,
      customScale: customScale !== 1.0 ? customScale : undefined,
      customShape: customShape !== 'circle' ? customShape : undefined
    });
  };

  const handleDeleteClick = () => {
      if (isDeleteConfirming) {
          if (onDelete) onDelete();
      } else {
          setIsDeleteConfirming(true);
          // Auto reset after 3 seconds if not clicked
          setTimeout(() => setIsDeleteConfirming(false), 3000);
      }
  };

  // ... (Tag and Generic Attribute handlers same as before)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));
  const addAttribute = () => setGenericAttributes([...genericAttributes, { key: '', value: '' }]);
  const updateAttribute = (index: number, field: 'key' | 'value', val: string) => {
    const newAttrs = [...genericAttributes];
    newAttrs[index][field] = val;
    setGenericAttributes(newAttrs);
  };
  const removeAttribute = (index: number) => setGenericAttributes(genericAttributes.filter((_, i) => i !== index));
  
  // Relationship Handlers
  const addRelationship = () => {
      if (!newRelTargetId || !newRelType.trim()) return;
      setRelationships([...relationships, { id: crypto.randomUUID(), targetId: newRelTargetId, type: newRelType, style: newRelStyle }]);
      setNewRelType(''); setNewRelTargetId('');
  };
  const removeRelationship = (id: string) => setRelationships(relationships.filter(r => r.id !== id));

  // Edit Relationship Handlers
  const startEditingRel = (rel: Relationship) => {
    setEditingRelId(rel.id);
    setEditingRelType(rel.type);
    setEditingRelStyle(rel.style || 'solid');
  };

  const cancelEditingRel = () => {
    setEditingRelId(null);
    setEditingRelType('');
    setEditingRelStyle('solid');
  };

  const saveEditingRel = () => {
    if (!editingRelId || !editingRelType.trim()) return;
    
    setRelationships(relationships.map(r => 
      r.id === editingRelId 
        ? { ...r, type: editingRelType, style: editingRelStyle }
        : r
    ));
    cancelEditingRel();
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">
            {entity ? I18N.edit[language] : I18N.create_new[language]}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
            <button onClick={() => setActiveTab('content')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'content' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <FileText className="w-4 h-4 mr-2" />{I18N.content[language]}
            </button>
            <button onClick={() => setActiveTab('relationships')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'relationships' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <LinkIcon className="w-4 h-4 mr-2" />{I18N.relationships[language]}
                <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 rounded-full text-xs">{relationships.length}</span>
            </button>
            <button onClick={() => setActiveTab('visuals')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center ${activeTab === 'visuals' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Palette className="w-4 h-4 mr-2" />{I18N.custom_appearance[language]}
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {activeTab === 'content' && (
              <>
                {/* Basic Info */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">{I18N.title[language]}</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={I18N.ph_title[language]} autoFocus />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase">{I18N.category[language]}</label>
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                            {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                    </div>
                </div>

                {/* Node Note (Subtitle) */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {I18N.node_note[language]}
                    </label>
                    <input 
                        type="text" 
                        value={nodeNote} 
                        onChange={(e) => setNodeNote(e.target.value)} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50" 
                        placeholder={I18N.ph_node_note[language]} 
                    />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase">{I18N.tags[language]}</label>
                    <div className="flex flex-wrap gap-2 mb-1">
                        {tags.map(tag => (
                            <span key={tag} className="bg-primary-50 text-primary-700 px-2 py-1 rounded-md text-sm flex items-center">#{tag}<button onClick={() => removeTag(tag)} className="ml-1"><X className="w-3 h-3" /></button></span>
                        ))}
                    </div>
                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleKeyDown} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" placeholder={I18N.ph_tags[language]} />
                </div>

                {/* --- CHRONOLOGY SECTION --- */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-gray-700">Chronology & Timeline</h3>
                        </div>
                        <label className="flex items-center cursor-pointer">
                           <div className="relative">
                             <input type="checkbox" className="sr-only" checked={hasChronology} onChange={(e) => setHasChronology(e.target.checked)} />
                             <div className={`w-9 h-5 rounded-full shadow-inner transition-colors ${hasChronology ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                             <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow transition-transform ${hasChronology ? 'translate-x-4' : 'translate-x-0'}`}></div>
                           </div>
                           <span className="ml-2 text-xs text-gray-600">Track Time</span>
                        </label>
                    </div>

                    {hasChronology && (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                             {/* Range Toggle */}
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setIsRange(!isRange)} 
                                    className={`text-xs px-2 py-1 rounded border transition-colors flex items-center ${isRange ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <ArrowRight className="w-3 h-3 mr-1" />
                                    {isRange ? 'Date Range (Duration)' : 'Single Point in Time'}
                                </button>
                            </div>

                            <div className="flex gap-4 items-start">
                                {/* Start Date */}
                                <div className="flex-1 space-y-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Start / Date</label>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block">Year</span>
                                            <input type="number" value={startYear} onChange={(e) => handleYearChange(e.target.value, true)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 outline-none font-mono text-sm" placeholder="e.g. 1024" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block">Era</span>
                                            <select value={startEra} onChange={(e) => setStartEra(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 outline-none text-sm bg-white">
                                                <option value="">-- Select Era --</option>
                                                {eras.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {isRange && (
                                    <>
                                        <div className="pt-8 text-gray-300"><ArrowRight className="w-5 h-5" /></div>
                                        {/* End Date */}
                                        <div className="flex-1 space-y-3">
                                            <label className="text-xs font-bold text-gray-400 uppercase">End Date</label>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block">Year</span>
                                                    <input type="number" value={endYear} onChange={(e) => handleYearChange(e.target.value, false)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 outline-none font-mono text-sm" placeholder="e.g. 1080" />
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1 block">Era</span>
                                                    <select value={endEra} onChange={(e) => setEndEra(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 outline-none text-sm bg-white">
                                                        <option value="">-- {startEra || 'Select'} --</option>
                                                        {eras.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Granularity */}
                            <div className="flex gap-2 pt-2 border-t border-slate-200">
                                <input placeholder={I18N.ph_month[language]} value={customMonth} onChange={e => setCustomMonth(e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded" />
                                <input placeholder={I18N.ph_day[language]} value={customDay} onChange={e => setCustomDay(e.target.value)} className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Generic Attributes */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase">{I18N.attributes[language]} (Misc)</label>
                        <button onClick={addAttribute} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center"><Plus className="w-3 h-3 mr-1" /> {I18N.add_attribute[language]}</button>
                    </div>
                    {genericAttributes.length === 0 && <div className="text-sm text-gray-400 italic bg-gray-50 p-3 rounded text-center">{I18N.no_attributes[language]}</div>}
                    <div className="space-y-2">
                        {genericAttributes.map((attr, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input placeholder="Key" value={attr.key} onChange={(e) => updateAttribute(idx, 'key', e.target.value)} className="w-1/3 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:border-primary-500 outline-none" />
                                <input placeholder="Value" value={attr.value} onChange={(e) => updateAttribute(idx, 'value', e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:border-primary-500 outline-none" />
                                <button onClick={() => removeAttribute(idx)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lore Content */}
                <div className="space-y-2 h-64 flex flex-col">
                    <label className="text-xs font-semibold text-gray-500 uppercase">{I18N.content[language]}</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none font-mono text-sm leading-relaxed" placeholder={I18N.ph_lore[language]} />
                </div>
              </>
          )}

          {activeTab === 'relationships' && (
              <div className="space-y-6">
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">{I18N.add_relationship[language]}</h3>
                      <div className="flex flex-col gap-3">
                         <div className="flex gap-2">
                             <select
                                value={newRelTargetId}
                                onChange={(e) => setNewRelTargetId(e.target.value)}
                                className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                             >
                                 <option value="">{I18N.target_entity[language]}...</option>
                                 {otherEntities.length > 0 ? (
                                     otherEntities.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                     ))
                                 ) : (
                                     <option disabled>{I18N.no_other_entities[language]}</option>
                                 )}
                             </select>
                             <input type="text" value={newRelType} onChange={(e) => setNewRelType(e.target.value)} placeholder={I18N.relation_type[language]} className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                             <select value={newRelStyle} onChange={(e) => setNewRelStyle(e.target.value as LineStyle)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                <option value="solid">{I18N.style_solid[language]}</option>
                                <option value="dashed">{I18N.style_dashed[language]}</option>
                                <option value="dotted">{I18N.style_dotted[language]}</option>
                             </select>
                         </div>
                         <button onClick={addRelationship} disabled={!newRelTargetId || !newRelType.trim()} className="w-full py-2 bg-white border border-gray-300 text-primary-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                            {I18N.add_connection[language]}
                         </button>
                      </div>
                  </div>
                   <div className="space-y-3">
                      {relationships.map(rel => {
                              const target = data.entities.find(e => e.id === rel.targetId);
                              const isEditing = editingRelId === rel.id;

                              if (isEditing) {
                                  return (
                                      <div key={rel.id} className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg animate-in fade-in">
                                          <input 
                                            value={editingRelType}
                                            onChange={(e) => setEditingRelType(e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="Type..."
                                            autoFocus
                                          />
                                          <select
                                              value={editingRelStyle}
                                              onChange={(e) => setEditingRelStyle(e.target.value as LineStyle)}
                                              className="w-24 px-2 py-1 text-sm border border-indigo-300 rounded bg-white outline-none"
                                          >
                                             <option value="solid">Solid</option>
                                             <option value="dashed">Dashed</option>
                                             <option value="dotted">Dotted</option>
                                          </select>
                                          <button onClick={saveEditingRel} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="Save"><Check className="w-4 h-4" /></button>
                                          <button onClick={cancelEditingRel} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded" title="Cancel"><X className="w-4 h-4" /></button>
                                      </div>
                                  );
                              }

                              return (
                                  <div key={rel.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg group hover:border-indigo-300 transition-colors">
                                      <div className="flex items-center flex-1 min-w-0">
                                          <div className={`w-2 h-2 rounded-full mr-3 flex-shrink-0 ${rel.style === 'dashed' ? 'bg-indigo-300' : rel.style === 'dotted' ? 'bg-indigo-200' : 'bg-indigo-500'}`}></div>
                                          <div className="flex-1 truncate">
                                              <span className="text-gray-900 font-semibold text-sm mr-2">{rel.type}</span>
                                              <span className="text-gray-400 font-normal text-xs">→ {target?.title || 'Unknown'}</span>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <button onClick={() => startEditingRel(rel)} className="text-gray-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                           <button onClick={() => removeRelationship(rel.id)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                  </div>
                              )
                      })}
                  </div>
              </div>
          )}

          {activeTab === 'visuals' && (
               <div className="space-y-6">
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                     <label className="text-sm font-semibold text-gray-700 block mb-3">{I18N.node_shape[language]}</label>
                     <div className="flex gap-4">
                         {[{ id: 'circle', icon: Circle }, { id: 'square', icon: Square }, { id: 'diamond', icon: Diamond }, { id: 'hexagon', icon: Hexagon }].map(shape => (
                             <button key={shape.id} onClick={() => setCustomShape(shape.id as NodeShape)} className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${customShape === shape.id ? 'bg-white border-primary-500 ring-2 ring-primary-100 text-primary-600' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'}`}>
                                 <shape.icon className="w-6 h-6" /><span className="text-xs font-medium capitalize">{shape.id}</span>
                             </button>
                         ))}
                     </div>
                 </div>
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <label className="text-sm font-semibold text-gray-700 block mb-2">{I18N.override_color[language]}</label>
                    <div className="flex items-center gap-4">
                        <input type="color" value={customColor || currentCategory?.color || '#000000'} onChange={(e) => setCustomColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer border-0 p-0" />
                        {customColor && <button onClick={() => setCustomColor('')} className="text-xs text-red-500 hover:underline">Reset</button>}
                    </div>
                 </div>
               </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
                {entity && onDelete && (
                    <button 
                        onClick={handleDeleteClick} 
                        className={`px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-all ${
                            isDeleteConfirming 
                            ? 'bg-red-600 text-white shadow-md animate-pulse' 
                            : 'text-red-500 hover:bg-red-50'
                        }`}
                    >
                        {isDeleteConfirming ? (
                            <>
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                {I18N.confirm_action[language]}
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                {I18N.delete[language]}
                            </>
                        )}
                    </button>
                )}
            </div>
            <div className="flex space-x-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{I18N.cancel[language]}</button>
              <button onClick={handleSave} disabled={!title.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center shadow-sm"><Save className="w-4 h-4 mr-2" />{I18N.save[language]}</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EntityEditor;
