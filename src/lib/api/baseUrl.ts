const API_PROXY_PREFIX = "/api/p";
const API_BASE_OVERRIDE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
const PROD_DOMAIN = "alignment.id";

const isLocalHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "0.0.0.0" ||
  host === "::1" ||
  host.endsWith(".localhost");

export const resolveApiBaseUrl = () => {
  if (!API_BASE_OVERRIDE) {
    return API_PROXY_PREFIX;
  }

  if (typeof window === "undefined") {
    return API_BASE_OVERRIDE;
  }

  const hostname = window.location.hostname.toLowerCase();
  if (!isLocalHost(hostname) && hostname.endsWith(PROD_DOMAIN)) {
    return API_PROXY_PREFIX;
  }

  return API_BASE_OVERRIDE;
};
