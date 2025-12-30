
import React, { useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';
import { Clock, Database, Star, Hash, Link as LinkIcon, PieChart, Activity, Calendar, GitCommit, Layers } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const { data, language } = useWorld();
  const { entities, categories, lastModified, calendarConfig } = data;

  // 1. Stats Cards Data
  const stats = [
    { label: I18N.total_entities[language], value: entities.length, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: I18N.categories[language], value: categories.length, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: I18N.tags[language].split('(')[0], value: new Set(entities.flatMap(e => e.tags)).size, icon: Hash, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: I18N.relationships[language], value: entities.reduce((acc, e) => acc + (e.relationships?.length || 0), 0), icon: LinkIcon, color: 'text-orange-600', bg: 'bg-orange-50' }
  ];

  // 2. Recent Updates
  const recentEntities = [...entities]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  // 3. Tag Cloud Data
  const tagCounts: Record<string, number> = {};
  entities.forEach(e => {
    e.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

  // 4. Category Distribution Data
  const categoryData = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      value: entities.filter(e => e.categoryId === cat.id).length,
      color: cat.color
    })).filter(d => d.value > 0);
  }, [categories, entities]);

  // 5. Era Distribution
  const eraData = useMemo(() => {
     if (!calendarConfig?.eras) return [];
     const counts: Record<string, number> = {};
     calendarConfig.eras.forEach(e => counts[e.name] = 0);
     counts['Unknown'] = 0;

     entities.forEach(e => {
         const era = e.attributes.find(a => ['era', 'epoch', 'age', '纪元'].includes(a.key.toLowerCase()))?.value;
         if (era && counts[era] !== undefined) {
             counts[era]++;
         } else if (e.attributes.some(a => ['year', 'date', '年份'].includes(a.key.toLowerCase()))) {
             counts['Unknown']++;
         }
     });

     return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .filter(d => d.count > 0);
  }, [entities, calendarConfig]);

  // 6. Top Connected
  const topConnected = useMemo(() => {
    return [...entities]
      .map(e => ({
        title: e.title,
        connections: (e.relationships?.length || 0) + entities.filter(ent => ent.relationships?.some(r => r.targetId === e.id)).length,
        id: e.id
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 5);
  }, [entities]);

  // 7. Timeline Span
  const timelineStats = useMemo(() => {
     let minYear = Infinity;
     let maxYear = -Infinity;
     let hasDates = false;
     entities.forEach(e => {
         const yearAttr = e.attributes.find(a => ['year', 'date', '年份', 'start year'].includes(a.key.toLowerCase()));
         if (yearAttr) {
             const y = parseInt(yearAttr.value);
             if (!isNaN(y)) {
                 if (y < minYear) minYear = y;
                 if (y > maxYear) maxYear = y;
                 hasDates = true;
             }
         }
         const endYearAttr = e.attributes.find(a => ['end year', 'end date', '结束年份'].includes(a.key.toLowerCase()));
         if (endYearAttr) {
             const y = parseInt(endYearAttr.value);
             if (!isNaN(y)) { if (y > maxYear) maxYear = y; }
         }
     });
     return hasDates ? { min: minYear, max: maxYear, span: maxYear - minYear } : null;
  }, [entities]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-100 shadow-xl rounded-lg text-xs">
          <p className="font-semibold text-gray-800 mb-1">{label}</p>
          <p style={{ color: payload[0].fill }}>
            {`${payload[0].name}: ${payload[0].value}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 space-y-8 animate-slide-up pb-20 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
            <h1 className="text-4xl font-extralight tracking-tight text-slate-800 mb-2">{I18N.welcome[language]}</h1>
            <p className="text-slate-400 text-sm font-medium">
            {I18N.last_updated[language]} <span className="font-mono text-slate-600">{new Date(lastModified).toLocaleString()}</span>
            </p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-5 group">
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="xl:col-span-2 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Dist */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[340px] flex flex-col">
                    <h2 className="text-sm font-bold text-slate-700 uppercase mb-6 flex items-center tracking-wider">
                        <PieChart className="w-4 h-4 mr-2 text-slate-400" /> Categories
                    </h2>
                    <div className="flex-1 min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie 
                                    data={categoryData} 
                                    cx="50%" cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={5} 
                                    dataKey="value"
                                    cornerRadius={4}
                                >
                                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                                </Pie>
                                <ReTooltip content={<CustomTooltip />} />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Era Dist */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[340px] flex flex-col">
                     <h2 className="text-sm font-bold text-slate-700 uppercase mb-6 flex items-center tracking-wider">
                        <Layers className="w-4 h-4 mr-2 text-slate-400" /> Eras Distribution
                     </h2>
                     <div className="flex-1 min-h-[220px]">
                        {eraData.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={eraData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                     <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} interval={0} axisLine={false} tickLine={false} />
                                     <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} allowDecimals={false} axisLine={false} tickLine={false} />
                                     <ReTooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                                     <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                                 </BarChart>
                             </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <Layers className="w-12 h-12 mb-2 opacity-50" />
                                <span className="text-sm">No historical data</span>
                            </div>
                        )}
                     </div>
                </div>
            </div>

            {/* Tag Cloud */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center tracking-wider">
                  <Hash className="w-4 h-4 mr-2 text-slate-400" /> {I18N.tag_cloud[language]}
              </h2>
              <div className="flex-1 w-full flex flex-wrap gap-2 content-start">
                 {sortedTags.length === 0 ? <div className="text-slate-400 text-sm italic w-full text-center py-8">{I18N.add_tags_hint[language]}</div> : 
                   sortedTags.map(([tag, count]) => {
                     const scale = 0.5 + (count / maxTagCount) * 1.5; 
                     return (
                       <span 
                            key={tag} 
                            className="px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-slate-600 transition-all hover:bg-white hover:border-primary-200 hover:text-primary-600 hover:shadow-sm cursor-default" 
                            style={{ fontSize: `${Math.max(0.75, Math.min(scale, 1.5))}rem`, opacity: 0.7 + (count/maxTagCount)*0.3 }}
                        >
                          #{tag}<span className="ml-1.5 text-[0.6em] text-slate-400 font-bold align-top bg-white px-1 rounded-sm shadow-sm">{count}</span>
                       </span>
                     );
                   })
                 }
              </div>
            </div>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-1 space-y-8">
            {/* Timeline Stats */}
            {timelineStats && (
                <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-800"></div>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    
                    <div className="relative z-10">
                        <h2 className="text-sm font-bold mb-6 flex items-center opacity-90 uppercase tracking-widest"><Calendar className="w-4 h-4 mr-2" /> Timeline Span</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
                                <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">Start Year</p>
                                <p className="text-2xl font-mono font-bold">{timelineStats.min}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors">
                                <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">End Year</p>
                                <p className="text-2xl font-mono font-bold">{timelineStats.max}</p>
                            </div>
                            <div className="col-span-2 bg-white/20 rounded-xl p-4 backdrop-blur-md border border-white/10 flex justify-between items-center mt-2">
                                <div><p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">Total Duration</p><p className="text-3xl font-mono font-bold text-indigo-50">{timelineStats.span}</p></div>
                                <Activity className="w-10 h-10 opacity-30 rotate-12" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Connections */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center tracking-wider">
                    <GitCommit className="w-4 h-4 mr-2 text-slate-400" /> Top Connected
                </h2>
                <div className="space-y-4 flex-1">
                    {topConnected.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between group cursor-default">
                            <div className="flex items-center overflow-hidden">
                                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold mr-3 transition-colors ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                <span className="text-sm font-medium text-slate-700 truncate max-w-[120px] group-hover:text-primary-600 transition-colors">{item.title}</span>
                            </div>
                            <div className="flex items-center">
                                <div className="h-1.5 w-16 bg-slate-100 rounded-full mr-2 overflow-hidden">
                                    <div className="h-full bg-primary-400 rounded-full" style={{ width: `${Math.min(100, item.connections * 10)}%` }}></div>
                                </div>
                                <span className="text-xs font-mono text-slate-400">{item.connections}</span>
                            </div>
                        </div>
                    ))}
                    {topConnected.length === 0 && <div className="text-slate-400 text-sm italic">No connections</div>}
                </div>
            </div>

            {/* Recent Updates */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center tracking-wider">
                  <Clock className="w-4 h-4 mr-2 text-slate-400" /> {I18N.recent_updates[language]}
              </h2>
              <div className="space-y-0">
                  {recentEntities.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 -mx-2 px-2 rounded-lg transition-colors cursor-default">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate text-sm">{e.title}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">{categories.find(c => c.id === e.categoryId)?.name}</p>
                      </div>
                      <span className="text-xs text-slate-400 font-mono whitespace-nowrap ml-2">{new Date(e.updatedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {recentEntities.length === 0 && <div className="text-slate-400 text-sm italic">{I18N.no_entities[language]}</div>}
              </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
