import { User } from "@/lib/api";
import quickQuestionsConfig from "@/config/quick-questions.json";

export const DEFAULT_LANGUAGE = "en";

export const SKIP_KEYWORDS = new Set(["skip", "n/a", "na", "none", "no"]);

export const TIME_KEYWORDS = [
    "every",
    "daily",
    "weekly",
    "weekday",
    "weekend",
    "morning",
    "evening",
    "night",
    "noon",
    "midnight",
    "am",
    "pm",
    "tomorrow",
    "tonight",
];

export const TIME_PATTERN = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i;
export const RELATIVE_PATTERN = /\b(in|after)\s+\d{1,3}\s+(minutes?|hours?)\b/i;

export const SMART_NUMBER_WORDS = new Set([
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "couple",
    "few",
    "several",
]);

export const SMART_FREQUENCY_WORDS = new Set([
    "daily",
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "annually",
    "per",
    "each",
    "every",
]);

export const SMART_TIME_WORDS = new Set([
    "today",
    "tonight",
    "tomorrow",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "weekend",
    "morning",
    "afternoon",
    "evening",
    "q1",
    "q2",
    "q3",
    "q4",
    "year",
    "month",
    "week",
    "day",
    "deadline",
    "by",
    "before",
    "next",
    "in",
]);

export const SMART_VAGUE_WORDS = new Set([
    "better",
    "more",
    "improve",
    "work on",
    "focus on",
    "get better",
    "do more",
    "increase",
    "decrease",
]);

export type SmartGoalEvaluation = {
    specific: boolean;
    measurable: boolean;
    time_bound: boolean;
    gaps: string[];
    complete: boolean;
};

const normalizeTextForChecks = (text: string): string => {
    return (text || "").replace(/\s+/g, " ").trim();
};

const tokenizeWords = (text: string): string[] => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    return cleaned.split(/\s+/).filter(Boolean);
};

const containsNumber = (text: string, tokens: string[]): boolean => {
    if (/\d/.test(text)) {
        return true;
    }
    return tokens.some((token) => SMART_NUMBER_WORDS.has(token));
};

const containsTimeReference = (tokens: string[]): boolean => {
    return tokens.some((token) => SMART_TIME_WORDS.has(token));
};

const containsFrequency = (tokens: string[]): boolean => {
    return tokens.some((token) => SMART_FREQUENCY_WORDS.has(token));
};

const looksSpecific = (text: string, tokens: string[]): boolean => {
    if (tokens.length < 6 || text.length < 30) {
        return false;
    }

    let vagueHits = 0;
    const lowerText = text.toLowerCase();
    for (const phrase of SMART_VAGUE_WORDS) {
        if (lowerText.includes(phrase)) {
            vagueHits++;
        }
    }
    return vagueHits < Math.max(1, Math.floor(tokens.length / 6));
};

export const evaluateSmartGoal = (text: string): SmartGoalEvaluation => {
    const normalized = normalizeTextForChecks(text);
    const tokens = tokenizeWords(normalized);

    const hasNumber = containsNumber(normalized, tokens);
    const hasFrequency = containsFrequency(tokens);
    const timeMatch = TIME_PATTERN.test(normalized);
    const relativeMatch = RELATIVE_PATTERN.test(normalized);
    const hasTime = containsTimeReference(tokens) || hasFrequency || timeMatch || relativeMatch;
    const isSpecific = looksSpecific(normalized, tokens) || hasNumber || hasTime;

    const gaps: string[] = [];
    if (!isSpecific) {
        gaps.push("Make it **specific** — add the exact deliverable or action.");
    }
    if (!hasNumber && !hasFrequency) {
        gaps.push("Make it **measurable** — include a number, frequency, or success metric.");
    }
    if (!hasTime) {
        gaps.push("Make it **time-bound** — mention a deadline or cadence (e.g., ‘by Friday’, ‘per week’).");
    }

    return {
        specific: isSpecific,
        measurable: hasNumber || hasFrequency,
        time_bound: hasTime,
        gaps,
        complete: gaps.length === 0,
    };
};

export const renderSmartFeedback = (goalText: string, evaluation: SmartGoalEvaluation): string => {
    if (evaluation.complete) {
        return "";
    }

    const gapLines = evaluation.gaps.map((gap) => `• ${gap}`).join("\n");
    return (
        "Thanks for sharing your goal! To keep it SMART, consider tightening a few pieces:\n" +
        `${gapLines}` +
        "\n\nTap **Refine with SMART** to update it now, or keep going and circle back later."
    );
};

export type QuickQuestion = {
    key: string;
    prompt: string;
    clarification: string;
    examples: string[];
    optional: boolean;
};

const QUICK_QUESTION_SETS = quickQuestionsConfig as Record<string, QuickQuestion[]>;

export const getQuickQuestions = (language: string = DEFAULT_LANGUAGE): QuickQuestion[] => {
    const normalized = (language || DEFAULT_LANGUAGE).toLowerCase();
    const fromConfig = QUICK_QUESTION_SETS[normalized] || QUICK_QUESTION_SETS[DEFAULT_LANGUAGE] || [];
    // Return a shallow copy so callers can mutate safely.
    return fromConfig.map((item) => ({ ...item }));
};

export type QuestionnaireSession = {
    userId: number;
    mode: "quick" | "deep";
    phase: "foundation" | "personalized" | "ocean";
    step: number;
    foundationAnswers: Record<string, string>;
    personalizedQuestions: string[];
    personalizedMetadata: Record<string, any>;
    personalizedAnswers: any[];
    awaitingPersonalizedDecision: boolean;
    oceanIndex: number;
    oceanAnswers: Record<string, number[]>;
    startedAt: number;
    language: string;
    quickQuestions: QuickQuestion[];
};

export const createInitialSession = (userId: number, mode: "quick" | "deep" = "quick"): QuestionnaireSession => {
    return {
        userId,
        mode,
        phase: "foundation",
        step: 0,
        foundationAnswers: {},
        personalizedQuestions: [],
        personalizedMetadata: {},
        personalizedAnswers: [],
        awaitingPersonalizedDecision: false,
        oceanIndex: 0,
        oceanAnswers: {},
        startedAt: Date.now(),
        language: "en",
        quickQuestions: getQuickQuestions(),
    };
};
