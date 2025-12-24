import { useCallback, useEffect, useMemo, useState } from "react";
import { dashboardService, type DashboardPulse } from "@/lib/api";
import { type PulseEntry, type PlanItem, type HabitItem, type ProactivityItem } from "@/components/gray/types";
import { toDateKey } from "@/app/gray/utils"; // We'll need to extract utils too

const MAX_PULSE_HISTORY = 30;

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
    details: plan.details ?? null,
    reminderAt: plan.reminderAt ?? null,
    color: plan.color ?? null,
  }));

const cloneHabits = (habits: HabitItem[]): HabitItem[] =>
  habits.map((habit) => ({
    id: habit.id,
    label: habit.label,
    previousLabel: habit.previousLabel,
    completed: Boolean(habit.completed),
    details: habit.details ?? null,
    reminderAt: habit.reminderAt ?? null,
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

export function usePulse(
  userId: number | null,
  todayAnchor: Date,
  nowDateKey: string,
  currentPlans: PlanItem[],
  currentHabits: HabitItem[],
  proactivity: ProactivityItem | null,
  _onNotification?: (title: string, body: string) => void
) {
  const [pulseState, setPulseState] = useState<{
    userId: number | null;
    entries: PulseEntry[];
    activePulseId: string | null;
  }>(() => ({ userId: null, entries: [], activePulseId: null }));

  // Fetch initial pulse data
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadPulses = async () => {
      try {
        const pulses = await dashboardService.getDashboardPulses(userId, MAX_PULSE_HISTORY);
        if (cancelled) {
          return;
        }
        const mapped = pulses.map((pulse) => mapDashboardPulseToEntry(pulse));
        const todayEntryId = mapped.find((entry) => entry.dateKey === nowDateKey)?.id ?? `pulse-${nowDateKey}`;
        setPulseState((previous) => {
          const previousActivePulseId = previous.userId === userId ? previous.activePulseId : null;
          const nextActivePulseId =
            previousActivePulseId && mapped.some((entry) => entry.id === previousActivePulseId)
              ? previousActivePulseId
              : todayEntryId;
          return { userId, entries: mapped, activePulseId: nextActivePulseId };
        });
      } catch (error) {
        console.error("Failed to load dashboard pulses:", error);
      }
    };

    void loadPulses();
    return () => {
      cancelled = true;
    };
  }, [nowDateKey, userId]);

  const mergeTodaySnapshot = useCallback(
    (previous: PulseEntry[]): PulseEntry[] => {
      const existingIndex = previous.findIndex((entry) => entry.dateKey === nowDateKey);
      if (existingIndex === 0) {
        return previous;
      }
      if (existingIndex > 0) {
        const currentEntry = previous[existingIndex];
        const without = previous.filter((_, index) => index !== existingIndex);
        return [currentEntry, ...without].slice(0, MAX_PULSE_HISTORY);
      }

      const snapshot = createPulseSnapshot(todayAnchor, currentPlans, currentHabits, proactivity);
      return [snapshot, ...previous].slice(0, MAX_PULSE_HISTORY);
    },
    [currentHabits, currentPlans, nowDateKey, proactivity, todayAnchor]
  );

  const pulseEntries = useMemo(() => {
    if (!userId || pulseState.userId !== userId) {
      return [];
    }
    return mergeTodaySnapshot(pulseState.entries);
  }, [mergeTodaySnapshot, pulseState.entries, pulseState.userId, userId]);

  const setPulseEntries = useCallback(
    (next: PulseEntry[] | ((previous: PulseEntry[]) => PulseEntry[])) => {
      setPulseState((previous) => {
        if (!userId) {
          return previous;
        }

        const baseEntries = previous.userId === userId ? previous.entries : [];
        const mergedPrevious = mergeTodaySnapshot(baseEntries);
        const resolvedNext = typeof next === "function" ? next(mergedPrevious) : next;

        return {
          userId,
          entries: resolvedNext,
          activePulseId: previous.userId === userId ? previous.activePulseId : null,
        };
      });
    },
    [mergeTodaySnapshot, userId]
  );

  const activePulseId = useMemo(() => {
    if (!pulseEntries.length || !userId || pulseState.userId !== userId) {
      return null;
    }
    const candidate = pulseState.activePulseId;
    if (candidate && pulseEntries.some((entry) => entry.id === candidate)) {
      return candidate;
    }
    return pulseEntries[0]?.id ?? null;
  }, [pulseEntries, pulseState.activePulseId, pulseState.userId, userId]);

  const setActivePulseId = useCallback(
    (next: string | null | ((previous: string | null) => string | null)) => {
      setPulseState((previous) => {
        if (!userId) {
          return previous;
        }

        const previousActivePulseId = previous.userId === userId ? previous.activePulseId : null;
        const resolvedNext = typeof next === "function" ? next(previousActivePulseId) : next;

        if (resolvedNext === previousActivePulseId && previous.userId === userId) {
          return previous;
        }

        return {
          userId,
          entries: previous.userId === userId ? previous.entries : [],
          activePulseId: resolvedNext,
        };
      });
    },
    [userId]
  );

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
