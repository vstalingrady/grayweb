const DAYS_TO_PERSIST = 30;

const normalizeExpiry = (expires: Date) => expires.toUTCString();

const getCookieAttributes = (expires: Date, extra: string[] = []) => {
  const attributes = ["path=/", "sameSite=Lax", `expires=${normalizeExpiry(expires)}`];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    attributes.push("secure");
  }
  return [...attributes, ...extra];
};

const buildFutureExpiry = () => {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + DAYS_TO_PERSIST);
  return expiration;
};

export const persistAuthCookies = (email?: string | null) => {
  if (typeof document === "undefined") {
    return;
  }
  const expiry = buildFutureExpiry();
  const maxAgeSeconds = Math.round((expiry.getTime() - Date.now()) / 1000);
  const baseAttributes = getCookieAttributes(expiry, [`max-age=${maxAgeSeconds}`]);
  document.cookie = ["gray-auth=1", ...baseAttributes].join("; ");
  if (email) {
    document.cookie = [
      `gray-auth-email=${encodeURIComponent(email)}`,
      ...baseAttributes,
    ].join("; ");
  }
};

export const clearAuthCookies = () => {
  if (typeof document === "undefined") {
    return;
  }
  const expiry = new Date(0);
  const baseAttributes = getCookieAttributes(expiry, ["max-age=0"]);
  document.cookie = ["gray-auth=", ...baseAttributes].join("; ");
  document.cookie = ["gray-auth-email=", ...baseAttributes].join("; ");
};
