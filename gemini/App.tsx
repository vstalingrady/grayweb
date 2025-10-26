import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="bg-[#101010] text-gray-300 min-h-screen flex">
      <div 
        className="fixed inset-0 z-[-1] bg-cover bg-center" 
        style={{backgroundImage: "url('https://picsum.photos/seed/dashboardbg/1920/1080')", filter: 'brightness(0.2)'}}
      ></div>
      <Sidebar isExpanded={isSidebarExpanded} onToggle={() => setIsSidebarExpanded(prev => !prev)} />
      <main className={`flex-1 p-8 transition-all duration-300 ${isSidebarExpanded ? 'ml-64' : 'ml-20'}`}>
        <Dashboard />
      </main>
    </div>
  );
};

export default App;