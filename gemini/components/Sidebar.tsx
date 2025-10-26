import React from 'react';
import { HISTORY_DATA, SearchIcon, PlusIcon, DashboardIcon, HistoryIcon, LogoIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../constants';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onToggle }) => {
  const [activeItem, setActiveItem] = React.useState('History');
  const [activeHistoryItem, setActiveHistoryItem] = React.useState('Real-time Data Visualization');

  const navItems = [
    { name: 'General', icon: null },
    { name: 'New Thread', icon: <PlusIcon /> },
    { name: 'Dashboard', icon: <DashboardIcon /> },
    { name: 'History', icon: <HistoryIcon /> },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, name: string) => {
    e.preventDefault();
    setActiveItem(name);
  };

  const handleHistoryClick = (e: React.MouseEvent<HTMLAnchorElement>, name: string) => {
    e.preventDefault();
    setActiveHistoryItem(name);
  };

  return (
    <aside className={`fixed top-0 left-0 h-full bg-[#1C1D22] border-r border-gray-700/50 flex flex-col p-4 text-gray-400 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'}`}>
      <button 
        onClick={onToggle} 
        className="absolute -right-3 top-9 z-10 bg-[#2a2b31] border border-gray-700/50 hover:bg-gray-700 text-white rounded-full p-1"
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isExpanded ? <ChevronLeftIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
      </button>

      <div className={`flex items-center gap-3 mb-8 p-2 ${!isExpanded && 'justify-center'}`}>
        <LogoIcon className="w-8 h-8 text-white flex-shrink-0" />
      </div>

      <div className="relative mb-6">
        {isExpanded ? (
          <>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-[#2a2b31] border border-gray-700/50 rounded-md py-2 pl-9 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-[#3a3b41] px-1.5 py-0.5 rounded">CTRL+K</span>
          </>
        ) : (
          <a href="#" className="flex justify-center items-center p-2 rounded-md hover:bg-[#2a2b31]">
            <SearchIcon className="w-5 h-5" />
          </a>
        )}
      </div>


      <nav className="flex-1 overflow-y-auto">
        <ul>
          {navItems.map((item) => (
            <li key={item.name} className="mb-1 relative">
              <a
                href="#"
                onClick={(e) => handleNavClick(e, item.name)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${!isExpanded && 'justify-center'} ${
                  activeItem === item.name
                    ? 'bg-[#2a2b31] text-white'
                    : 'hover:bg-[#2a2b31] hover:text-white'
                }`}
              >
                {item.icon}
                {isExpanded && <span>{item.name}</span>}
              </a>
              {item.name === 'History' && activeItem === 'History' && isExpanded && (
                <div className="mt-1">
                  <div className="absolute left-[22px] top-[28px] bottom-0 w-px bg-gray-700/40" aria-hidden="true"></div>
                  <div className="pl-[44px]">
                    {HISTORY_DATA.map((group) => (
                      <div key={group.period} className="mb-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group.period}</h3>
                        <ul className="pl-4">
                          {group.items.map((historyItem) => (
                            <li key={historyItem}>
                              <a
                                href="#"
                                onClick={(e) => handleHistoryClick(e, historyItem)}
                                className={`block py-1.5 text-sm rounded-md truncate transition-colors ${
                                  activeHistoryItem === historyItem
                                    ? 'text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                              >
                                {historyItem}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto">
        <div className={`flex items-center p-2 rounded-md hover:bg-[#2a2b31] cursor-pointer ${isExpanded ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center gap-3">
                <img
                    src="https://picsum.photos/seed/useravatar/40/40"
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full flex-shrink-0"
                />
                {isExpanded && (
                    <div>
                        <p className="text-sm font-semibold text-white truncate">V. Stalingrady</p>
                        <p className="text-xs text-gray-500">OPERATOR</p>
                    </div>
                )}
            </div>
            {isExpanded && <ChevronDownIcon className="w-4 h-4 text-gray-500" />}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;