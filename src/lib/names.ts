const SURNAME_SUFFIXES = new Set([
  "adams",
  "allen",
  "anderson",
  "bailey",
  "baker",
  "barnes",
  "bell",
  "bennett",
  "brooks",
  "brown",
  "campbell",
  "carter",
  "castillo",
  "chavez",
  "clark",
  "collins",
  "cooper",
  "cox",
  "cruz",
  "davis",
  "diaz",
  "edwards",
  "evans",
  "flores",
  "foster",
  "garcia",
  "gomez",
  "gonzalez",
  "gray",
  "grady",
  "green",
  "griffin",
  "gutierrez",
  "hall",
  "hamilton",
  "harris",
  "hayes",
  "hernandez",
  "hill",
  "hughes",
  "jackson",
  "james",
  "jenkins",
  "johnson",
  "jones",
  "kelly",
  "king",
  "lee",
  "lewis",
  "long",
  "lopez",
  "martin",
  "martinez",
  "miller",
  "mitchell",
  "moore",
  "morgan",
  "morales",
  "morris",
  "murphy",
  "myers",
  "nelson",
  "nguyen",
  "ortiz",
  "parker",
  "patel",
  "perez",
  "perry",
  "peterson",
  "phillips",
  "powell",
  "price",
  "ramirez",
  "ramos",
  "reed",
  "reyes",
  "rivera",
  "roberts",
  "robinson",
  "rodriguez",
  "rogers",
  "ross",
  "ruiz",
  "sanchez",
  "sanders",
  "scott",
  "shaw",
  "simmons",
  "smith",
  "stewart",
  "taylor",
  "thomas",
  "thompson",
  "torres",
  "turner",
  "walker",
  "ward",
  "washington",
  "watson",
  "white",
  "wilson",
  "wood",
  "wright",
  "young",
]);

const SURNAME_PREFIXES = new Set([
  "al",
  "bin",
  "da",
  "de",
  "del",
  "di",
  "la",
  "le",
  "mac",
  "mc",
  "saint",
  "san",
  "van",
  "von",
]);

const TITLE_CASE = (value: string) =>
  value.length ? value[0].toUpperCase() + value.slice(1).toLowerCase() : value;

const sanitizeIdentifier = (raw: string) =>
  raw
    .replace(/@.*/, "")
    .replace(/[0-9]+/g, " ")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasVowel = (segment: string) => /[aeiouy]/i.test(segment);

const looksLikeSurname = (segment: string) => {
  const lower = segment.toLowerCase();
  if (SURNAME_SUFFIXES.has(lower)) {
    return true;
  }
  return Array.from(SURNAME_PREFIXES).some((prefix) => lower.startsWith(prefix));
};

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
  primary?: string | null,
  _fallbackIdentifier?: string | null
): string => {
  const primaryName = humanizeIdentifier(primary);
  if (primaryName) {
    return primaryName;
  }

  // If we don't have an explicit name, don't try to guess one from the email/ID.
  // Just return "User" to be safe and polite.
  return "User";
};
