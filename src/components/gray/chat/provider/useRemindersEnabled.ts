/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";

const REMINDERS_ENABLED_STORAGE_PREFIX = "gray_reminders_enabled";

type UseRemindersEnabledResult = {
  remindersEnabled: boolean;
  toggleRemindersEnabled: () => void;
};

export const useRemindersEnabled = (
  userId: number | undefined
): UseRemindersEnabledResult => {
  const remindersEnabledStorageKey = useMemo(
    () => `${REMINDERS_ENABLED_STORAGE_PREFIX}:${userId ?? "anon"}`,
    [userId]
  );
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(remindersEnabledStorageKey);
      if (stored === null) {
        setRemindersEnabled(true);
        return;
      }
      setRemindersEnabled(stored !== "0");
    } catch {
      setRemindersEnabled(true);
    }
  }, [remindersEnabledStorageKey]);

  const setRemindersEnabledPersisted = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setRemindersEnabled((prev) => {
        const nextValue = typeof updater === "function" ? updater(prev) : updater;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              remindersEnabledStorageKey,
              nextValue ? "1" : "0"
            );
          } catch {
            // Best-effort persistence.
          }
        }
        return nextValue;
      });
    },
    [remindersEnabledStorageKey]
  );

  const toggleRemindersEnabled = useCallback(() => {
    setRemindersEnabledPersisted((prev) => !prev);
  }, [setRemindersEnabledPersisted]);

  return { remindersEnabled, toggleRemindersEnabled };
};
