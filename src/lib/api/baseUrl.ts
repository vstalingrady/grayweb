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

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const isAbsoluteUrl = (value: string) =>
  ABSOLUTE_URL_PATTERN.test(value) || value.startsWith("blob:") || value.startsWith("data:");

export const resolveApiUrl = (path: string): string => {
  if (!path) {
    return "";
  }
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const baseUrl = resolveApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath.startsWith(baseUrl)) {
    return normalizedPath;
  }
  return `${baseUrl}${normalizedPath}`;
};

type UploadUrlInput = {
  id?: number | string;
  public_url?: string | null;
};

export const resolveUploadUrl = (upload: UploadUrlInput): string => {
  if (upload.public_url) {
    return resolveApiUrl(upload.public_url);
  }
  const numericId = typeof upload.id === "number" ? upload.id : Number(upload.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    return resolveApiUrl(`/api/uploads/${numericId}/file`);
  }
  return "";
};
