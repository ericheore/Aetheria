
import { Translation } from './types';
export { I18N } from './locales';

export const DEFAULT_CATEGORIES = [
  { id: 'cat_char', name: 'Characters', color: '#f87171', template: [{key: 'Age', value: ''}, {key: 'Race', value: ''}] },
  { id: 'cat_loc', name: 'Locations', color: '#60a5fa', template: [{key: 'Population', value: ''}, {key: 'Climate', value: ''}] },
  { id: 'cat_item', name: 'Items', color: '#fbbf24', template: [{key: 'Value', value: ''}, {key: 'Weight', value: ''}] },
  // Expanded for Deep World Building
  { id: 'cat_history', name: 'History & Events', color: '#a78bfa', template: [{key: 'Year', value: ''}, {key: 'Era', value: ''}, {key: 'Month', value: ''}, {key: 'Day', value: ''}] },
  { id: 'cat_cosmology', name: 'Cosmology & Laws', color: '#34d399', template: [{key: 'Type', value: 'Magic/Physics'}, {key: 'Origin', value: ''}] },
  { id: 'cat_groups', name: 'Factions & Groups', color: '#f472b6', template: [{key: 'Leader', value: ''}, {key: 'Ideology', value: ''}] },
  { id: 'cat_quest', name: 'Quests & Arcs', color: '#fb923c', template: [{key: 'Status', value: 'Open'}, {key: 'Reward', value: ''}] },
  { id: 'cat_notes', name: 'Notes', color: '#94a3b8', template: [] },
];
