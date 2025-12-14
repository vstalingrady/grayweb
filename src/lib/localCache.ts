const GRAY_STORAGE_PREFIX = "gray";
const GRAY_LOCALE_COOKIE = "gray_locale";

const collectStorageKeysWithPrefix = (storage: Storage, prefix: string): string[] => {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
};

const expireCookie = (name: string) => {
  if (typeof document === "undefined") {
    return;
  }
  const expiry = new Date(0);
  const attributes = ["path=/", `expires=${expiry.toUTCString()}`, "max-age=0", "sameSite=Lax"];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    attributes.push("secure");
  }
  document.cookie = [`${name}=`, ...attributes].join("; ");
};

export const clearGrayLocalCache = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keys = collectStorageKeysWithPrefix(window.localStorage, GRAY_STORAGE_PREFIX);
    keys.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore storage failures
      }
    });
  } catch {
    // ignore localStorage enumeration failures
  }

  try {
    const keys = collectStorageKeysWithPrefix(window.sessionStorage, GRAY_STORAGE_PREFIX);
    keys.forEach((key) => {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // ignore storage failures
      }
    });
  } catch {
    // ignore sessionStorage enumeration failures
  }

  try {
    expireCookie(GRAY_LOCALE_COOKIE);
  } catch {
    // ignore cookie failures
  }
};

