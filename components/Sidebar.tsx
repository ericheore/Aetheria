
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Book, Settings, Layers, Box, Network, History, Columns } from 'lucide-react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';

const Sidebar = () => {
  const { language } = useWorld();
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: I18N.dashboard[language] },
    { path: '/workspace', icon: Columns, label: 'Workspace' }, // New Item
    { path: '/entities', icon: Book, label: I18N.entities[language] },
    { path: '/categories', icon: Layers, label: I18N.categories[language] },
    { path: '/graph', icon: Network, label: I18N.graph_view[language] },
    { path: '/timeline', icon: History, label: I18N.timeline_view[language] },
    { path: '/settings', icon: Settings, label: I18N.settings[language] },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-10 transition-all duration-300">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <Box className="w-6 h-6 text-primary-600 mr-2" />
        <span className="text-xl font-semibold tracking-tight text-gray-800">Aetheria</span>
      </div>
      
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-100">
        <div className="text-xs text-gray-400 text-center">
          v1.1.0 Workspace
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
