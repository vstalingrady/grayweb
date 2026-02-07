"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import {
  buildNotificationPreferencesStorageKey,
  clearNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  parseNotificationPreferences,
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
  const { user, updateUser } = useUser();
  const userId = typeof user?.id === "number" ? user.id : null;
  const storageKey = useMemo(() => buildNotificationPreferencesStorageKey(userId), [userId]);

  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(() =>
    loadNotificationPreferences(storageKey)
  );
  const lastPersistedRef = useRef<NotificationPreferences | null>(null);

  const arePreferencesEqual = useCallback(
    (a: NotificationPreferences | null | undefined, b: NotificationPreferences | null | undefined) => {
      if (!a || !b) {
        return false;
      }
      return (
        a.device === b.device &&
        a.tasks === b.tasks &&
        a.proactivity === b.proactivity &&
        a.calendarEvents === b.calendarEvents
      );
    },
    []
  );

  useEffect(() => {
    let nextPrefs: NotificationPreferences;
    if (!user) {
      lastPersistedRef.current = null;
      nextPrefs = loadNotificationPreferences(storageKey);
    } else {
      const serverPrefs = user.notification_preferences
        ? parseNotificationPreferences(user.notification_preferences)
        : null;

      if (serverPrefs) {
        nextPrefs = serverPrefs;
        lastPersistedRef.current = serverPrefs;
      } else {
        nextPrefs = loadNotificationPreferences(storageKey);
      }
    }

    if (!arePreferencesEqual(notificationPreferences, nextPrefs)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotificationPreferencesState(nextPrefs);
    }
  }, [storageKey, user, arePreferencesEqual, notificationPreferences]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (user) {
      return;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setNotificationPreferencesState(loadNotificationPreferences(storageKey));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [storageKey, user]);

  const setNotificationPreferences = useCallback(
    (preferences: NotificationPreferences) => {
      setNotificationPreferencesState(preferences);
      if (!user) {
        saveNotificationPreferences(storageKey, preferences);
      }
    },
    [storageKey, user]
  );

  const setNotificationPreference = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setNotificationPreferencesState((current) => {
        const next = { ...current, [key]: value };
        if (!user) {
          saveNotificationPreferences(storageKey, next);
        }
        return next;
      });
    },
    [storageKey, user]
  );

  const resetNotificationPreferences = useCallback(() => {
    setNotificationPreferencesState(DEFAULT_NOTIFICATION_PREFERENCES);
    if (!user) {
      clearNotificationPreferences(storageKey);
    }
  }, [storageKey, user]);

  useEffect(() => {
    if (!userId || typeof userId !== "number") {
      return;
    }
    const serverPrefs = user?.notification_preferences
      ? parseNotificationPreferences(user.notification_preferences)
      : null;
    if (serverPrefs && arePreferencesEqual(serverPrefs, notificationPreferences)) {
      lastPersistedRef.current = notificationPreferences;
      return;
    }
    if (lastPersistedRef.current && arePreferencesEqual(lastPersistedRef.current, notificationPreferences)) {
      return;
    }
    if (!serverPrefs && arePreferencesEqual(notificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES)) {
      return;
    }
    lastPersistedRef.current = notificationPreferences;
    void updateUser({ notification_preferences: notificationPreferences }).catch((error) => {
      console.error("Failed to persist notification preferences:", error);
    });
  }, [arePreferencesEqual, notificationPreferences, updateUser, user, userId]);

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
