
import { WorldData, Category, CalendarConfig, Era } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

const STORAGE_KEY = 'aetheria_world_data_v1';

const DEFAULT_CALENDAR: CalendarConfig = {
    eras: [
        { id: 'era_bc', name: 'BC', endYear: 0 },
        { id: 'era_ad', name: 'AD', startYear: 1 }
    ],
    months: [],
    daysInYear: 365,
    useEras: true
};

const INITIAL_DATA: WorldData = {
  name: 'My New World',
  categories: DEFAULT_CATEGORIES as Category[],
  entities: [],
  lastModified: Date.now(),
  calendarConfig: DEFAULT_CALENDAR
};

export const saveWorld = (data: WorldData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save world data', e);
  }
};

export const loadWorld = (): WorldData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DATA;
    const data = JSON.parse(raw) as WorldData;
    
    // Migration for calendar config
    if (!data.calendarConfig) {
        data.calendarConfig = DEFAULT_CALENDAR;
    } else {
        // Migration: Convert string[] eras to Era[] objects
        // @ts-ignore - Runtime check for legacy data
        if (data.calendarConfig.eras.length > 0 && typeof data.calendarConfig.eras[0] === 'string') {
             // @ts-ignore
             data.calendarConfig.eras = (data.calendarConfig.eras as string[]).map(name => ({
                 id: crypto.randomUUID(),
                 name: name
             }));
        }
    }
    return data;
  } catch (e) {
    console.error('Failed to load world data', e);
    return INITIAL_DATA;
  }
};
