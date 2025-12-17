import type { ProactivityItem } from "./types";

export const DEFAULT_PROACTIVITY_TIME = "09:00";

export type ProactivityPreset = {
    id: string;
    title: string;
    label: string;
    cadence: string;
    description: string;
    summary: string;
    defaultTime?: string;
    defaultTimes?: string[];
    recommendedFor: string;
};

export const CUSTOM_PROACTIVITY_ID = "proactivity-custom";

export const PROACTIVITY_PRESETS: ProactivityPreset[] = [
    {
        id: "proactivity-frequent",
        title: "Frequent",
        label: "Check-ins",
        cadence: "Frequent",
        description: "Built for launch mode. Morning, midday, and evening nudges to keep momentum compounding.",
        summary: "Three structured touchpoints each day with action follow-ups.",
        recommendedFor: "Teams sprinting toward a release window or coordinating across time zones.",
        defaultTime: "09:00",
        defaultTimes: ["09:00", "14:00", "18:00"],
    },
    {
        id: "proactivity-daily",
        title: "Stay Close",
        label: "Check-ins",
        cadence: "Daily",
        description: "One guided check-in every morning plus smart reminders when things drift.",
        summary: "Daily rhythm that keeps work moving without overwhelming signal.",
        recommendedFor: "Founders or leads who want a steady async cadence.",
        defaultTime: "09:00",
    },
    {
        id: "proactivity-manual",
        title: "Manual Only",
        label: "Check-ins",
        cadence: "Manual",
        description: "Gray stays quiet until you ask. All proactive nudges are paused.",
        summary: "Full manual control with quick access to on-demand help.",
        recommendedFor: "Exploration phases or when you need a temporary quiet period.",
        defaultTime: "—",
    },
];

export type CustomSettingsState = {
    times: string[];
};

export const DEFAULT_CUSTOM_SETTINGS: CustomSettingsState = {
    times: [DEFAULT_PROACTIVITY_TIME],
};

export const formatCustomTimeLabel = (time: string) => {
    if (!time || time === "—") {
        return "Flexible";
    }
    const [rawHour, rawMinute] = time.split(":").map((value) => Number.parseInt(value, 10));
    if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) {
        return time;
    }
    const date = new Date();
    date.setHours(rawHour, rawMinute, 0, 0);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const normalizeTimeForInput = (value: string | null | undefined) => {
    if (!value) {
        return DEFAULT_PROACTIVITY_TIME;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) {
        return trimmed.slice(0, 5);
    }
    let hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    if (period === "AM") {
        if (hours === 12) {
            hours = 0;
        }
    } else if (period === "PM") {
        if (hours !== 12) {
            hours += 12;
        }
    }
    const clampedHours = Math.max(0, Math.min(23, hours));
    const clampedMinutes = Math.max(0, Math.min(59, minutes));
    return `${String(clampedHours).padStart(2, "0")}:${String(clampedMinutes).padStart(2, "0")}`;
};

export const dedupeTimes = (times: string[]) =>
    times
        .map((value) => normalizeTimeForInput(value))
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort();

export const findNextCustomTime = (existingTimes: string[]): string => {
    const normalizedExisting = dedupeTimes(existingTimes);
    const existingSet = new Set(normalizedExisting);
    const base = normalizedExisting[normalizedExisting.length - 1] ?? DEFAULT_PROACTIVITY_TIME;
    const [baseHour, baseMinute] = base.split(":").map((value) => Number.parseInt(value, 10));
    const baseTotalMinutes =
        (Number.isFinite(baseHour) && Number.isFinite(baseMinute) ? baseHour * 60 + baseMinute : 9 * 60) %
        (24 * 60);
    const stepMinutes = 90;

    for (let index = 1; index <= Math.ceil((24 * 60) / stepMinutes); index += 1) {
        const totalMinutes = (baseTotalMinutes + index * stepMinutes) % (24 * 60);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const candidate = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        if (!existingSet.has(candidate)) {
            return candidate;
        }
    }

    return DEFAULT_PROACTIVITY_TIME;
};

export const getProactivityTimes = (item: ProactivityItem | null | undefined) => {
    if (!item) {
        return [];
    }
    if (Array.isArray(item.times) && item.times.length > 0) {
        return dedupeTimes(item.times);
    }
    if (item.time) {
        return dedupeTimes([item.time]);
    }
    return [];
};

export const buildCustomProactivityItem = (times: string[]): ProactivityItem => {
    const sortedTimes = dedupeTimes(times);
    const resolvedTimes = sortedTimes.length > 0 ? sortedTimes : [...DEFAULT_CUSTOM_SETTINGS.times];
    const firstTime = resolvedTimes[0] ?? DEFAULT_PROACTIVITY_TIME;
    const formattedTimes = resolvedTimes.map((time) => formatCustomTimeLabel(time)).join(", ");
    const descriptionParts = [`${resolvedTimes.length} touchpoints`, formattedTimes];

    return {
        id: CUSTOM_PROACTIVITY_ID,
        label: "Custom plan",
        description: descriptionParts.join(" • "),
        cadence: "Custom",
        time: firstTime,
        times: resolvedTimes,
    };
};
