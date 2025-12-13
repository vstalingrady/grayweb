/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";
import { apiService, type DashboardPulse } from "@/lib/api";
import { type PulseEntry, type PlanItem, type HabitItem, type ProactivityItem } from "@/components/gray/types";
import { toDateKey } from "@/app/gray/utils"; // We'll need to extract utils too

const MAX_PULSE_HISTORY = 30;

// Helper to normalize proactivity times (extracted from original file)
const normalizeTimeValue = (value: string | null | undefined): string => {
  if (!value) return "09:00";
  const trimmed = value.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!timeMatch) return trimmed.slice(0, 5);
  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "09:00";
  const period = timeMatch[3]?.toUpperCase();
  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else if (period === "PM") {
    if (hour !== 12) hour += 12;
  }
  const normalizedHour = Math.max(0, Math.min(23, hour));
  const normalizedMinute = Math.max(0, Math.min(59, minute));
  return `${String(normalizedHour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}`;
};

const normalizeProactivityTimes = (
  times: string[] | null | undefined,
  fallback: string | null | undefined = null
): string[] => {
  const sourceTimes =
    Array.isArray(times) && times.length > 0
      ? times
      : fallback
        ? [fallback]
        : [];

  const normalized = sourceTimes
    .map((value) => normalizeTimeValue(value))
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();

  return normalized;
};

const primaryProactivityTime = (times: string[] | null | undefined, fallback?: string | null) =>
  normalizeProactivityTimes(times ?? null, fallback)[0];

const normalizeProactivityChannels = (channels: string[] | null | undefined): string[] => {
  if (!Array.isArray(channels)) return [];
  const normalized = channels
    .map((channel) => (typeof channel === "string" ? channel.trim() : ""))
    .filter((channel) => channel.length > 0);
  return normalized.filter((channel, index, array) => array.indexOf(channel) === index);
};

const mapDashboardPulseToEntry = (pulse: DashboardPulse): PulseEntry => ({
  id: String(pulse.id),
  dateKey: pulse.date_key,
  timestamp: pulse.timestamp,
  plans: pulse.plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    completed: plan.completed,
  })),
  habits: pulse.habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    streakLabel: habit.streak_label ?? "",
    previousLabel: habit.previous_label ?? "",
    completed: habit.completed,
  })),
  proactivity: {
    id: pulse.proactivity.id,
    label: pulse.proactivity.label,
    description: pulse.proactivity.description ?? "",
    cadence: pulse.proactivity.cadence,
    time: pulse.proactivity.time,
    times: [pulse.proactivity.time],
    channels: [],
    timezone: null,
  },
});

const clonePlans = (plans: PlanItem[]): PlanItem[] =>
  plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    completed: plan.completed,
    deadline: plan.deadline ?? null,
    scheduleSlot: plan.scheduleSlot ?? null,
    reminderId: plan.reminderId,
    reminderStatus: plan.reminderStatus,
  }));

const cloneHabits = (habits: HabitItem[]): HabitItem[] =>
  habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    streakLabel: habit.streakLabel,
    previousLabel: habit.previousLabel,
    completed: Boolean(habit.completed),
  }));

const createPulseSnapshot = (
  referenceDate: Date,
  plans: PlanItem[],
  habits: HabitItem[],
  proactivity: ProactivityItem | null,
  stableId?: string
): PulseEntry => ({
  id: stableId ?? `pulse-${toDateKey(referenceDate)}`,
  dateKey: toDateKey(referenceDate),
  timestamp: referenceDate.getTime(),
  plans: clonePlans(plans),
  habits: cloneHabits(habits),
  proactivity: proactivity ? { ...proactivity } : null,
});

const arePlanListsEqual = (a: PlanItem[], b: PlanItem[]) =>
  a.length === b.length &&
  a.every((plan, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      plan.id === other.id &&
      plan.label === other.label &&
      plan.completed === other.completed &&
      (plan.deadline ?? null) === (other.deadline ?? null) &&
      (plan.scheduleSlot ?? null) === (other.scheduleSlot ?? null)
    );
  });

const areHabitListsEqual = (a: HabitItem[], b: HabitItem[]) =>
  a.length === b.length &&
  a.every((habit, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      habit.id === other.id &&
      habit.label === other.label &&
      habit.streakLabel === other.streakLabel &&
      habit.previousLabel === other.previousLabel &&
      Boolean(habit.completed) === Boolean(other.completed)
    );
  });

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

export function usePulse(
  userId: number | null,
  todayAnchor: Date,
  nowDateKey: string,
  currentPlans: PlanItem[],
  currentHabits: HabitItem[],
  proactivity: ProactivityItem | null,
  onNotification?: (title: string, body: string) => void
) {
  const [pulseEntries, setPulseEntries] = useState<PulseEntry[]>([]);
  const [activePulseId, setActivePulseId] = useState<string | null>(null);

  // Fetch initial pulse data
  useEffect(() => {
    if (!userId) {
      setPulseEntries([]);
      setActivePulseId(null);
      return;
    }

    let cancelled = false;

    const loadPulses = async () => {
      try {
        const pulses = await apiService.getDashboardPulses(userId, MAX_PULSE_HISTORY);
        if (cancelled) {
          return;
        }
        const mapped = pulses.map((pulse) => mapDashboardPulseToEntry(pulse));
        setPulseEntries(mapped);
        setActivePulseId((previous) => {
          if (previous && mapped.some((entry) => entry.id === previous)) {
            return previous;
          }
          return mapped[0]?.id ?? null;
        });
      } catch (error) {
        console.error("Failed to load dashboard pulses:", error);
      }
    };

    void loadPulses();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Sync current state to today's pulse
  useEffect(() => {
    if (!userId) return;

    const snapshotBase = createPulseSnapshot(todayAnchor, currentPlans, currentHabits, proactivity);

    setPulseEntries((previous) => {
      const existingIndex = previous.findIndex((entry) => entry.dateKey === snapshotBase.dateKey);
      const stableId = existingIndex >= 0 ? previous[existingIndex].id : snapshotBase.id;

      // Preserve completion status and streak info from existing pulse entry if available
      // because snapshotBase is derived from 'currentHabits' which typically defaults to uncompleted
      let mergedSnapshot = snapshotBase;
      if (existingIndex >= 0) {
        const currentEntry = previous[existingIndex];
        mergedSnapshot = {
          ...snapshotBase,
          habits: snapshotBase.habits.map((h) => {
            const match = currentEntry.habits.find((ch) => ch.id === h.id);
            if (match) {
              return {
                ...h,
                completed: match.completed,
                streakLabel: match.streakLabel,
                previousLabel: match.previousLabel,
              };
            }
            return h;
          }),
        };
      }

      const snapshot: PulseEntry = {
        ...mergedSnapshot,
        id: stableId,
      };

      if (existingIndex === 0) {
        const current = previous[0];
        if (
          arePlanListsEqual(current.plans, snapshot.plans) &&
          areHabitListsEqual(current.habits, snapshot.habits) &&
          areProactivityItemsEqual(current.proactivity, snapshot.proactivity)
        ) {
          return previous;
        }
        return [
          { ...current, ...snapshot },
          ...previous.slice(1),
        ];
      }

      if (existingIndex > 0) {
        const without = previous.filter((_, index) => index !== existingIndex);
        return [snapshot, ...without].slice(0, MAX_PULSE_HISTORY);
      }

      return [snapshot, ...previous].slice(0, MAX_PULSE_HISTORY);
    });

  }, [userId, currentPlans, currentHabits, proactivity, todayAnchor, onNotification]);

  // Ensure active pulse selection
  useEffect(() => {
    if (!pulseEntries.length) {
      if (activePulseId !== null) {
        setActivePulseId(null);
      }
      return;
    }

    if (!activePulseId || !pulseEntries.some((entry) => entry.id === activePulseId)) {
      setActivePulseId(pulseEntries[0].id);
    }
  }, [pulseEntries, activePulseId]);

  const activePulse = useMemo(() => {
    if (!pulseEntries.length) return null;
    if (!activePulseId) return pulseEntries[0];
    return pulseEntries.find((entry) => entry.id === activePulseId) ?? pulseEntries[0];
  }, [pulseEntries, activePulseId]);

  const isActivePulseEditable = activePulse?.dateKey === nowDateKey;

  return {
    pulseEntries,
    setPulseEntries,
    activePulseId,
    setActivePulseId,
    activePulse,
    isActivePulseEditable
  };
}
