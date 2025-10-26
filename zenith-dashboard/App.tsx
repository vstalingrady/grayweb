import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import HistoryPage from './components/history/HistoryPage';
import type { UserProfile } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const PREFERRED_USER_EMAIL = import.meta.env.VITE_VIEWER_EMAIL ?? '';
const PREFERRED_USER_ID = import.meta.env.VITE_VIEWER_ID ?? '';

const App: React.FC = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [view, setView] = useState('dashboard'); // Default to 'dashboard'
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const resolveEndpoint = () => {
      if (PREFERRED_USER_EMAIL) {
        return `/users/email/${encodeURIComponent(PREFERRED_USER_EMAIL)}`;
      }
      if (PREFERRED_USER_ID) {
        return `/users/${PREFERRED_USER_ID}`;
      }
      return '/users/1';
    };

    const loadUser = async () => {
      setIsLoadingUser(true);
      setUserError(null);
      try {
        const response = await fetch(`${API_BASE_URL}${resolveEndpoint()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const fallbackMessage = `Failed to load user: ${response.status}`;
          const errorPayload = await response.json().catch(() => null);
          throw new Error(
            (errorPayload && (errorPayload.detail ?? errorPayload.message)) || fallbackMessage
          );
        }

        const data: UserProfile = await response.json();
        setUser(data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unable to load user profile';
        setUserError(message);
        setUser(null);
        console.error('User profile fetch failed:', error);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingUser(false);
        }
      }
    };

    void loadUser();

    return () => {
      controller.abort();
    };
  }, []);

  const sidebarUserName = useMemo(() => {
    if (user?.full_name) {
      return user.full_name;
    }
    if (userError) {
      return 'Guest Operator';
    }
    return isLoadingUser ? 'Loading…' : 'Operator';
  }, [user, userError, isLoadingUser]);

  const renderView = () => {
    switch (view) {
      case 'history':
        return <HistoryPage />;
      case 'dashboard':
      case 'general':
      case 'new_thread':
        return (
          <MainContent
            user={user}
            userNameOverride={sidebarUserName}
            loadingUser={isLoadingUser}
          />
        );
      default:
        return (
          <MainContent
            user={user}
            userNameOverride={sidebarUserName}
            loadingUser={isLoadingUser}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans text-white bg-zinc-900">
      <Sidebar 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded}
        view={view}
        setView={setView}
        user={user}
        userNameOverride={sidebarUserName}
        userError={userError}
        loadingUser={isLoadingUser}
      />
      <div className="flex-1 overflow-y-auto">
        {renderView()}
      </div>
    </div>
  );
};

export default App;
