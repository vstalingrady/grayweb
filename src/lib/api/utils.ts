export const buildBodyPreview = (body: unknown): string | undefined => {
  if (!body) {
    return undefined;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return "[FormData body]";
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
  }
  try {
    const serialized = JSON.stringify(body);
    return serialized.length > 400 ? `${serialized.slice(0, 400)}…` : serialized;
  } catch {
    return "[Unserializable body]";
  }
};

