import React from 'react';
import { LogoIcon } from './icons/LogoIcon';
import { SearchIcon } from './icons/SearchIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { GeneralIcon } from './icons/GeneralIcon';
import { NewThreadIcon } from './icons/NewThreadIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import type { UserProfile } from '../types';


interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  view: string;
  setView: (view: string) => void;
  user: UserProfile | null;
  userNameOverride: string;
  userError: string | null;
  loadingUser: boolean;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
  isExpanded: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, text, active, isExpanded, onClick }) => {
  return (
    <li
      onClick={onClick}
      className={`
        flex items-center py-2.5 px-3 my-1 font-medium rounded-lg cursor-pointer
        transition-colors group
        ${active ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800 text-zinc-400'}
      `}
    >
      {icon}
      <span className={`overflow-hidden transition-all ${isExpanded ? 'w-40 ml-3' : 'w-0'}`}>
        {text}
      </span>
    </li>
  );
};

const deriveInitials = (name?: string | null) => {
  if (!name) return '??';
  const parts = name
    .split(' ')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Sidebar: React.FC<SidebarProps> = ({
  isExpanded,
  setIsExpanded,
  view,
  setView,
  user,
  userNameOverride,
  userError,
  loadingUser,
}) => {
  const navItems = [
    { icon: <GeneralIcon />, text: 'General', view: 'general' },
    { icon: <NewThreadIcon />, text: 'New Thread', view: 'new_thread' },
    { icon: <DashboardIcon />, text: 'Dashboard', view: 'dashboard' },
    { icon: <HistoryIcon />, text: 'History', view: 'history' },
  ];

  const historyItems = {};

  return (
    <aside className={`flex flex-col bg-black transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-20'}`}>
      <div className="flex items-center p-4 h-16 shrink-0 border-b border-zinc-800">
        <div className={`p-1.5 ${isExpanded ? 'mr-3' : ''}`}>
           <LogoIcon className="w-6 h-6" />
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Search Bar */}
        <div className={`flex items-center px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg mb-4`}>
            <SearchIcon className="w-5 h-5 text-zinc-400"/>
            <span className={`overflow-hidden transition-all whitespace-nowrap ${isExpanded ? 'w-auto ml-2' : 'w-0'}`}>Search</span>
            <span className={`overflow-hidden transition-all ml-auto text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded ${isExpanded ? 'w-auto' : 'w-0'}`}>
              Ctrl+K
            </span>
        </div>

        {/* Nav Items */}
        <ul className="flex flex-col">
          {navItems.map((item) => (
            <SidebarItem 
              key={item.text} 
              isExpanded={isExpanded}
              icon={item.icon}
              text={item.text}
              active={view === item.view}
              onClick={() => setView(item.view)} 
            />
          ))}
        </ul>

        {/* History List */}
        <div className={`mt-6 space-y-4 overflow-hidden transition-all ${isExpanded ? 'max-h-screen' : 'max-h-0'}`}>
           <div className="px-3">
               <div className="h-px bg-zinc-800"></div>
           </div>
          {Object.entries(historyItems).map(([month, items]) => (
            <div key={month}>
              <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{month}</h3>
              <ul>
                {items.map((item, index) => (
                  <li key={index} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white cursor-pointer truncate">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <div
          className={`flex ${isExpanded ? 'flex-row items-center gap-3' : 'flex-col items-center gap-3'}`}
        >
          <div
            className={`flex w-full items-center rounded-2xl border border-white/10 bg-white/[0.04] transition-all ${isExpanded ? 'px-3 py-2' : 'justify-center px-2 py-2'}`}
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-sm font-semibold uppercase text-white">
              {user?.profile_picture_url ? (
                <img
                  src={user.profile_picture_url}
                  alt={userNameOverride}
                  className="h-full w-full object-cover"
                />
              ) : (
                (user?.initials ?? deriveInitials(user?.full_name))
              )}
            </div>
            <div
              className={`flex items-center overflow-hidden transition-all ${isExpanded ? 'ml-3 w-full opacity-100' : 'ml-0 w-0 opacity-0 pointer-events-none'}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {userNameOverride}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {loadingUser ? 'Connecting…' : user?.role ?? (userError ? 'Guest' : 'Operator')}
                </p>
              </div>
              {isExpanded && <ChevronDownIcon className="ml-2 h-4 w-4 text-zinc-500" />}
            </div>
          </div>
          <div className={`flex flex-col gap-2 ${isExpanded ? '' : 'w-full items-center'}`}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <ChevronLeftIcon
                className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`}
              />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
