"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  buildNotificationPreferencesStorageKey,
  clearNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";

type NotificationPreferencesContextValue = {
  notificationPreferences: NotificationPreferences;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setNotificationPreferences: (preferences: NotificationPreferences) => void;
  resetNotificationPreferences: () => void;
};

const NotificationPreferencesContext = createContext<NotificationPreferencesContextValue | null>(null);

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const userId = typeof user?.id === "number" ? user.id : null;
  const storageKey = useMemo(() => buildNotificationPreferencesStorageKey(userId), [userId]);

  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(() =>
    loadNotificationPreferences(storageKey)
  );

  useEffect(() => {
    setNotificationPreferencesState(loadNotificationPreferences(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setNotificationPreferencesState(loadNotificationPreferences(storageKey));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey]);

  const setNotificationPreferences = useCallback(
    (preferences: NotificationPreferences) => {
      setNotificationPreferencesState(preferences);
      saveNotificationPreferences(storageKey, preferences);
    },
    [storageKey]
  );

  const setNotificationPreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setNotificationPreferencesState((current) => {
        const next = { ...current, [key]: value };
        saveNotificationPreferences(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const resetNotificationPreferences = useCallback(() => {
    setNotificationPreferencesState(DEFAULT_NOTIFICATION_PREFERENCES);
    clearNotificationPreferences(storageKey);
  }, [storageKey]);

  const value = useMemo(
    () => ({
      notificationPreferences,
      setNotificationPreference,
      setNotificationPreferences,
      resetNotificationPreferences,
    }),
    [notificationPreferences, resetNotificationPreferences, setNotificationPreference, setNotificationPreferences]
  );

  return (
    <NotificationPreferencesContext.Provider value={value}>
      {children}
    </NotificationPreferencesContext.Provider>
  );
}

export function useNotificationPreferences() {
  const ctx = useContext(NotificationPreferencesContext);
  if (!ctx) {
    throw new Error("useNotificationPreferences must be used within a NotificationPreferencesProvider");
  }
  return ctx;
}

