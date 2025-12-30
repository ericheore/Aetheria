
import React, { useMemo } from 'react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';
import { Clock, Database, Star, Hash, Link as LinkIcon, PieChart, Activity, Calendar, GitCommit, Layers } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

const Dashboard = () => {
  const { data, language } = useWorld();
  const { entities, categories, lastModified, calendarConfig } = data;

  // 1. Stats Cards Data
  const stats = [
    { label: I18N.total_entities[language], value: entities.length, icon: Database, color: 'bg-blue-500' },
    { label: I18N.categories[language], value: categories.length, icon: Star, color: 'bg-purple-500' },
    { label: I18N.tags[language].split('(')[0], value: new Set(entities.flatMap(e => e.tags)).size, icon: Hash, color: 'bg-emerald-500' },
    { label: I18N.relationships[language], value: entities.reduce((acc, e) => acc + (e.relationships?.length || 0), 0), icon: LinkIcon, color: 'bg-orange-500' }
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

  // 4. Category Distribution Data (Pie Chart)
  const categoryData = useMemo(() => {
    return categories.map(cat => ({
      name: cat.name,
      value: entities.filter(e => e.categoryId === cat.id).length,
      color: cat.color
    })).filter(d => d.value > 0);
  }, [categories, entities]);

  // 5. Era Distribution Data (Bar Chart) - NEW
  const eraData = useMemo(() => {
     if (!calendarConfig?.eras) return [];
     const counts: Record<string, number> = {};
     // Initialize
     calendarConfig.eras.forEach(e => counts[e.name] = 0);
     counts['Unknown'] = 0;

     entities.forEach(e => {
         const era = e.attributes.find(a => ['era', 'epoch', 'age', '纪元'].includes(a.key.toLowerCase()))?.value;
         if (era && counts[era] !== undefined) {
             counts[era]++;
         } else if (e.attributes.some(a => ['year', 'date', '年份'].includes(a.key.toLowerCase()))) {
             // Has date but no explicit era, simplified for chart
             counts['Unknown']++;
         }
     });

     return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .filter(d => d.count > 0);
  }, [entities, calendarConfig]);

  // 6. Top Connected Entities
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

  // 7. Timeline Span Stats
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

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-light text-gray-900 mb-2">{I18N.welcome[language]}</h1>
        <p className="text-gray-500">
          {I18N.last_updated[language]} {new Date(lastModified).toLocaleString()}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${stat.color} bg-opacity-10`}>
              <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category Dist */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[300px] flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><PieChart className="w-5 h-5 mr-2 text-gray-400" /> Categories</h2>
                    <div className="flex-1 min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                </Pie>
                                <ReTooltip />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Era Dist (NEW) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[300px] flex flex-col">
                     <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Layers className="w-5 h-5 mr-2 text-gray-400" /> Eras Breakdown</h2>
                     <div className="flex-1 min-h-[200px]">
                        {eraData.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={eraData}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                     <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                                     <YAxis tick={{fontSize: 10}} allowDecimals={false} />
                                     <ReTooltip cursor={{fill: 'transparent'}} />
                                     <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                 </BarChart>
                             </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No historical data</div>
                        )}
                     </div>
                </div>
            </div>

            {/* Tag Cloud */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Hash className="w-5 h-5 mr-2 text-gray-400" /> {I18N.tag_cloud[language]}</h2>
              <div className="flex-1 w-full bg-gray-50 rounded-xl p-6 flex flex-wrap gap-3 content-start min-h-[100px]">
                 {sortedTags.length === 0 ? <div className="text-gray-400 text-sm">{I18N.add_tags_hint[language]}</div> : 
                   sortedTags.map(([tag, count]) => {
                     const scale = 0.5 + (count / maxTagCount) * 1.5; 
                     return (
                       <span key={tag} className="px-3 py-1 rounded-full bg-white border border-gray-200 text-primary-700 transition-all hover:shadow-sm" style={{ fontSize: `${Math.max(0.75, Math.min(scale, 2))}rem`, opacity: 0.6 + (count/maxTagCount)*0.4 }}>
                          #{tag}<span className="ml-1 text-[0.6em] text-gray-400 font-bold align-top">{count}</span>
                       </span>
                     );
                   })
                 }
              </div>
            </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-8">
            {/* Timeline Stats */}
            {timelineStats && (
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md">
                    <h2 className="text-lg font-semibold mb-4 flex items-center opacity-90"><Calendar className="w-5 h-5 mr-2" /> World Timeline</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-wide opacity-70">Start</p>
                            <p className="text-xl font-mono font-bold">{timelineStats.min}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-wide opacity-70">End</p>
                            <p className="text-xl font-mono font-bold">{timelineStats.max}</p>
                        </div>
                        <div className="col-span-2 bg-white/20 rounded-lg p-3 backdrop-blur-sm flex justify-between items-center">
                            <div><p className="text-xs uppercase tracking-wide opacity-70">Total Span</p><p className="text-2xl font-mono font-bold">{timelineStats.span} <span className="text-sm font-sans font-normal opacity-80">years</span></p></div>
                            <Activity className="w-8 h-8 opacity-50" />
                        </div>
                    </div>
                </div>
            )}

            {/* Top Connections */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><GitCommit className="w-5 h-5 mr-2 text-gray-400" /> Top Connected</h2>
                <div className="space-y-3 flex-1">
                    {topConnected.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold mr-3 ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</span>
                                <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{item.title}</span>
                            </div>
                            <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">{item.connections} links</span>
                        </div>
                    ))}
                    {topConnected.length === 0 && <div className="text-gray-400 text-sm">No connections</div>}
                </div>
            </div>

            {/* Recent Updates */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-gray-400" /> {I18N.recent_updates[language]}</h2>
              <div className="space-y-4">
                  {recentEntities.map(e => (
                    <div key={e.id} className="flex items-center justify-between pb-3 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="font-medium text-gray-800 truncate max-w-[150px]">{e.title}</p>
                        <p className="text-xs text-gray-500">{categories.find(c => c.id === e.categoryId)?.name}</p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(e.updatedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {recentEntities.length === 0 && <div className="text-gray-400 text-sm">{I18N.no_entities[language]}</div>}
              </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
