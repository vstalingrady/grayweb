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

const splitCompactName = (token: string): [string, string] | null => {
  if (token.length < 6) {
    return null;
  }

  const lower = token.toLowerCase();
  let bestSplitIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestLeftLength = 0;

  for (let index = 2; index <= lower.length - 3; index += 1) {
    const left = lower.slice(0, index);
    const right = lower.slice(index);

    if (!hasVowel(left) || !hasVowel(right)) {
      continue;
    }

    if (!looksLikeSurname(right)) {
      continue;
    }

    let score = Math.abs(left.length - right.length);

    const boundaryPair = lower.slice(index - 1, index + 1);
    if (boundaryPair === "in") {
      score += 2.5;
    }

    const rightPair = right.slice(0, 2);
    if (rightPair === "ng" && right.length > 2) {
      score += 3;
    }

    if (/^[bcdfghjklmnpqrstvwxyz]/.test(right)) {
      score -= 0.25;
    }

    if (score < bestScore - 1e-3 || (Math.abs(score - bestScore) < 1e-3 && index > bestLeftLength)) {
      bestScore = score;
      bestSplitIndex = index;
      bestLeftLength = index;
    }
  }

  if (bestSplitIndex > 0 && bestScore <= 3.5) {
    return [token.slice(0, bestSplitIndex), token.slice(bestSplitIndex)];
  }

  return null;
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

  if (!/^[a-z]+$/i.test(token)) {
    return TITLE_CASE(token);
  }

  const compoundSplit = splitCompactName(token);
  if (compoundSplit) {
    return compoundSplit.map(TITLE_CASE).join(" ");
  }

  return TITLE_CASE(token);
};

export const formatDisplayName = (
  primary?: string | null,
  fallbackIdentifier?: string | null
): string => {
  const primaryName = humanizeIdentifier(primary);
  if (primaryName) {
    return primaryName;
  }

  const fallbackName = humanizeIdentifier(fallbackIdentifier);
  if (fallbackName) {
    return fallbackName;
  }

  return "Operator";
};
