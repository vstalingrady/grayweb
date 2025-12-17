import { useState, useEffect, useCallback } from "react";
import { ApiError, apiService, type ProactivitySettings } from "@/lib/api";
import { type ProactivityItem } from "@/components/gray/types";
import { normalizeProactivityTimes, primaryProactivityTime, normalizeProactivityChannels } from "@/app/gray/utils";

const PROACTIVITY_SEED: ProactivityItem = {
  id: "proactivity-1",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00",
  times: ["09:00"],
  channels: ["assistant"],
};

const FREQUENT_PROACTIVITY_TIMES = ["09:00", "12:00", "18:00"];

const ensureFrequentTimes = (cadence: string, times: string[]) => {
  const normalizedCadence = cadence.trim().toLowerCase();
  if (normalizedCadence === "frequent" && times.length <= 1) {
    return [...FREQUENT_PROACTIVITY_TIMES];
  }
  return times;
};

const mapSettingsToProactivity = (settings?: ProactivitySettings | null): ProactivityItem | null => {
  if (!settings) {
    return null;
  }
  const normalizedTimes = normalizeProactivityTimes(settings.times ?? null, settings.time);
  const hasTimes = normalizedTimes.length > 0;
  const cadenceValue = settings.cadence ?? null;
  const resolvedCadence = cadenceValue ?? PROACTIVITY_SEED.cadence;
  if (!hasTimes && !cadenceValue && !settings.time && !settings.channels && !settings.label && !settings.description) {
    return null;
  }
  const mappedTimes = ensureFrequentTimes(resolvedCadence, normalizedTimes);
  const normalizedChannels = normalizeProactivityChannels(settings.channels ?? null);
  const mapped: ProactivityItem = {
    id: settings.id ?? PROACTIVITY_SEED.id,
    label: settings.label ?? PROACTIVITY_SEED.label,
    description: settings.description ?? PROACTIVITY_SEED.description,
    cadence: resolvedCadence,
    times: mappedTimes,
    time: primaryProactivityTime(mappedTimes, settings.time),
    channels: normalizedChannels,
    timezone: settings.timezone ?? null,
  };
  if ((mapped.cadence ?? "").toLowerCase() === "manual") {
    return null;
  }
  return mapped;
};

const buildProactivitySettingsPayload = (
  candidate: ProactivityItem | null,
  timezone: string
): ProactivitySettings => {
  if (!candidate) {
    return {
      id: PROACTIVITY_SEED.id,
      label: PROACTIVITY_SEED.label,
      description: PROACTIVITY_SEED.description,
      cadence: "Manual",
      timezone,
    };
  }
  const times = normalizeProactivityTimes(candidate.times ?? null, candidate.time).sort();
  const channels = normalizeProactivityChannels(candidate.channels ?? null);
  return {
    id: candidate.id,
    label: candidate.label,
    description: candidate.description,
    cadence: candidate.cadence,
    time: primaryProactivityTime(times, candidate.time),
    times,
    channels,
    timezone: candidate.timezone ?? timezone,
  };
};

const areProactivityItemsEqual = (a: ProactivityItem | null, b: ProactivityItem | null) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.description === b.description &&
    a.cadence === b.cadence &&
    primaryProactivityTime(a.times ?? null, a.time) === primaryProactivityTime(b.times ?? null, b.time) &&
    normalizeProactivityTimes(a.times ?? null, a.time).join("|") ===
    normalizeProactivityTimes(b.times ?? null, b.time).join("|") &&
    normalizeProactivityChannels(a.channels ?? null).join("|") ===
    normalizeProactivityChannels(b.channels ?? null).join("|") &&
    (a.timezone ?? null) === (b.timezone ?? null)
  );
};

export function useProactivity(userId: number | null, resolvedTimezone: string) {
  const [proactivityState, setProactivityState] = useState<{
    userId: number | null;
    value: ProactivityItem | null;
  }>(() => ({ userId: null, value: null }));

  const proactivity = userId && proactivityState.userId === userId ? proactivityState.value : null;

  const setProactivity = useCallback(
    (next: ProactivityItem | null | ((previous: ProactivityItem | null) => ProactivityItem | null)) => {
      setProactivityState((previous) => {
        if (!userId) {
          return previous;
        }
        const previousValue = previous.userId === userId ? previous.value : null;
        const resolved = typeof next === "function" ? next(previousValue) : next;

        if (areProactivityItemsEqual(previousValue, resolved)) {
          return previous.userId === userId ? previous : { userId, value: previousValue };
        }

        return { userId, value: resolved };
      });
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadProactivitySettings = async () => {
      try {
        const settings = await apiService.getProactivitySettings(userId);
        if (cancelled) {
          return;
        }
        const normalized = mapSettingsToProactivity(settings);
        setProactivity(normalized);
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setProactivity((previous) => previous ?? PROACTIVITY_SEED);
          return;
        }
        console.error("Failed to load proactivity settings:", error);
      }
    };
    void loadProactivitySettings();
    return () => {
      cancelled = true;
    };
  }, [setProactivity, userId]);

  const persistProactivitySettings = useCallback(async (next: ProactivityItem | null) => {
    if (!userId) {
      console.warn("Cannot persist proactivity settings: userId not available");
      return;
    }
    const payload = buildProactivitySettingsPayload(next, resolvedTimezone);
    try {
      const response = await apiService.updateProactivitySettings(userId, payload);

      // Patch: ensure we preserve the ID if the backend dropped it or reset it,
      // preventing the UI from falling back to "Select a preset"
      if (response && payload.id && response.id !== payload.id) {
        response.id = payload.id;
      }

      const normalized = mapSettingsToProactivity(response);
      setProactivity(normalized);
    } catch (error) {
      console.error("Failed to save proactivity settings:", error);
    }
  }, [setProactivity, userId, resolvedTimezone]);

  return {
    proactivity,
    setProactivity,
    persistProactivitySettings,
  };
}
