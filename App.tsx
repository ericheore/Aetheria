
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WorldProvider } from './context/WorldContext';
import { ToastProvider } from './context/ToastContext';
import { ViewProvider } from './context/ViewContext'; // Import ViewProvider
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import EntityManager from './pages/EntityManager';
import CategoryManager from './pages/Categories';
import GraphView from './pages/GraphView';
import Timeline from './pages/Timeline';
import Settings from './pages/Settings';
import Workspace from './pages/Workspace'; // Import Workspace

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 ml-64 p-2 overflow-x-hidden h-screen flex flex-col">
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <WorldProvider>
        <ViewProvider> 
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/entities" element={<EntityManager />} />
                <Route path="/categories" element={<CategoryManager />} />
                <Route path="/graph" element={<GraphView />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Router>
        </ViewProvider>
      </WorldProvider>
    </ToastProvider>
  );
};

export default App;
