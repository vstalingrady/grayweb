const API_PROXY_PREFIX = "/api/p";
const API_BASE_OVERRIDE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export const resolveApiBaseUrl = () => API_BASE_OVERRIDE || API_PROXY_PREFIX;
