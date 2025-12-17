import { useCallback, useMemo, useSyncExternalStore } from "react";

const REMINDERS_ENABLED_STORAGE_PREFIX = "gray_reminders_enabled";
const REMINDERS_ENABLED_STORAGE_EVENT = "gray:reminders-enabled-storage";

const readRemindersEnabled = (storageKey: string): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) {
      return true;
    }
    return stored !== "0";
  } catch {
    return true;
  }
};

const writeRemindersEnabled = (storageKey: string, enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, enabled ? "1" : "0");
  } catch {
    // Best-effort persistence.
  }
};

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

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea !== window.localStorage) {
          return;
        }
        if (event.key !== remindersEnabledStorageKey) {
          return;
        }
        onStoreChange();
      };

      const handleCustom = (event: Event) => {
        if (!(event instanceof CustomEvent)) {
          return;
        }
        const detail = event.detail as { key?: unknown } | null;
        if (detail?.key !== remindersEnabledStorageKey) {
          return;
        }
        onStoreChange();
      };

      window.addEventListener("storage", handleStorage);
      window.addEventListener(REMINDERS_ENABLED_STORAGE_EVENT, handleCustom);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(REMINDERS_ENABLED_STORAGE_EVENT, handleCustom);
      };
    },
    [remindersEnabledStorageKey]
  );

  const getSnapshot = useCallback(
    () => readRemindersEnabled(remindersEnabledStorageKey),
    [remindersEnabledStorageKey]
  );

  const remindersEnabled = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const toggleRemindersEnabled = useCallback(() => {
    const nextValue = !remindersEnabled;
    writeRemindersEnabled(remindersEnabledStorageKey, nextValue);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REMINDERS_ENABLED_STORAGE_EVENT, {
          detail: { key: remindersEnabledStorageKey },
        })
      );
    }
  }, [remindersEnabled, remindersEnabledStorageKey]);

  return { remindersEnabled, toggleRemindersEnabled };
};
