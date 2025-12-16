const TITLE_CASE = (value: string) =>
  value.length ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value;

const sanitizeIdentifier = (raw: string) =>
  raw
    .replace(/@.*/, "")
    .replace(/[0-9]+/g, " ")
    .replace(/[_\-.]+/g, " ")
	    .replace(/\s+/g, " ")
	    .trim();

export const humanizeIdentifier = (input?: string | null): string | null => {
  if (!input) {
    return null;
  }

  const sanitized = sanitizeIdentifier(input);
  if (!sanitized) {
    return null;
  }

  const segments = sanitized.split(" ").filter(Boolean);
  if (segments.length > 1) {
    return segments.map(TITLE_CASE).join(" ");
  }

  const [token] = segments;
  if (!token) {
    return null;
  }

  // Disable aggressive splitting of compact names (e.g. vstalingrady -> Vstalin Grady)
  // to respect user privacy and avoid hallucinating names.
  return TITLE_CASE(token);
};

export const formatDisplayName = (
  primary?: string | null
): string => {
  const primaryName = humanizeIdentifier(primary);
  if (primaryName) {
    return primaryName;
  }

  // If we don't have an explicit name, don't try to guess one from the email/ID.
  // Just return "User" to be safe and polite.
  return "User";
};
