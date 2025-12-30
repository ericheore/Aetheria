
import { useMemo } from 'react';
import { WorldData, Language } from '../types';
import { I18N } from '../constants';
import { Database, Star, Hash, Link as LinkIcon } from 'lucide-react';

export const useDashboardStats = (data: WorldData, language: Language) => {
    const { entities, categories, lastModified, calendarConfig } = data;

    // 1. Stats Cards
    const statsCards = useMemo(() => [
        { label: I18N.total_entities[language], value: entities.length, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: I18N.categories[language], value: categories.length, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: I18N.tags[language].split('(')[0], value: new Set(entities.flatMap(e => e.tags)).size, icon: Hash, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: I18N.relationships[language], value: entities.reduce((acc, e) => acc + (e.relationships?.length || 0), 0), icon: LinkIcon, color: 'text-orange-600', bg: 'bg-orange-50' }
    ], [entities, categories, language]);

    // 2. Recent Updates
    const recentEntities = useMemo(() => [...entities]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5)
    , [entities]);

    // 3. Tag Cloud
    const tagCloud = useMemo(() => {
        const tagCounts: Record<string, number> = {};
        entities.forEach(e => {
            e.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
        });
        const sorted = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        return { 
            tags: sorted, 
            maxCount: sorted.length > 0 ? sorted[0][1] : 1 
        };
    }, [entities]);

    // 4. Category Distribution
    const categoryDist = useMemo(() => {
        return categories.map(cat => ({
            name: cat.name,
            value: entities.filter(e => e.categoryId === cat.id).length,
            color: cat.color
        })).filter(d => d.value > 0);
    }, [categories, entities]);

    // 5. Era Distribution
    const eraDist = useMemo(() => {
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
    const timelineSpan = useMemo(() => {
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

    return {
        statsCards,
        recentEntities,
        tagCloud,
        categoryDist,
        eraDist,
        topConnected,
        timelineSpan,
        lastModified
    };
};
