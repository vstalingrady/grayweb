import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dashboardService, type DashboardPulse } from "@/lib/api";
import { type PulseEntry, type PlanItem, type HabitItem, type ProactivityItem } from "@/components/gray/types";
import { toDateKey } from "@/app/gray/utils";

const MAX_PULSE_HISTORY = 30;
const DEFAULT_PULSE_PROACTIVITY = {
  id: "proactivity-default",
  label: "Check-ins",
  description: "Daily sync nudges for squad channels.",
  cadence: "Daily",
  time: "09:00 AM",
  times: ["09:00 AM"],
  channels: [],
  timezone: null,
  message_length: "medium",
};

const mapDashboardPulseToEntry = (pulse: DashboardPulse): PulseEntry => ({
  id: String(pulse.id),
  dateKey: pulse.date_key,
  timestamp: pulse.timestamp,
  plans: pulse.plans.map((plan) => ({
    id: String(plan.id),
    label: plan.label,
    completed: plan.completed,
    deadline: plan.deadline ?? null,
    scheduleSlot: plan.schedule_slot ?? null,
    details: plan.description ?? null,
    reminderAt: plan.reminder_at ?? null,
    color: plan.color ?? null,
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
    times: pulse.proactivity.times ?? [pulse.proactivity.time],
    channels: pulse.proactivity.channels ?? [],
    timezone: pulse.proactivity.timezone ?? null,
    messageLength: (pulse.proactivity.message_length as "short" | "medium" | "long" | undefined) ?? "medium",
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

const arePlansEqual = (left: PlanItem[], right: PlanItem[]) => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((plan, index) => {
    const other = right[index];
    return (
      plan.id === other.id &&
      plan.label === other.label &&
      Boolean(plan.completed) === Boolean(other.completed) &&
      (plan.deadline ?? null) === (other.deadline ?? null) &&
      (plan.scheduleSlot ?? null) === (other.scheduleSlot ?? null) &&
      (plan.details ?? null) === (other.details ?? null) &&
      (plan.reminderAt ?? null) === (other.reminderAt ?? null) &&
      (plan.color ?? null) === (other.color ?? null)
    );
  });
};

const areHabitsEqual = (left: HabitItem[], right: HabitItem[]) => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((habit, index) => {
    const other = right[index];
    return (
      habit.id === other.id &&
      habit.label === other.label &&
      (habit.previousLabel ?? "") === (other.previousLabel ?? "") &&
      Boolean(habit.completed) === Boolean(other.completed) &&
      (habit.details ?? null) === (other.details ?? null) &&
      (habit.reminderAt ?? null) === (other.reminderAt ?? null)
    );
  });
};

const areStringListsEqual = (left?: string[] | null, right?: string[] | null) => {
  const leftItems = left ?? [];
  const rightItems = right ?? [];
  if (leftItems.length !== rightItems.length) {
    return false;
  }
  return leftItems.every((item, index) => item === rightItems[index]);
};

const areProactivityEqual = (left: ProactivityItem | null, right: ProactivityItem | null) => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.id === right.id &&
    left.label === right.label &&
    left.description === right.description &&
    left.cadence === right.cadence &&
    left.time === right.time &&
    left.timezone === right.timezone &&
    left.messageLength === right.messageLength &&
    areStringListsEqual(left.times, right.times) &&
    areStringListsEqual(left.channels, right.channels)
  );
};

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

  const lastPersistSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    lastPersistSignatureRef.current = null;
  }, [userId]);

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
      const livePlans = clonePlans(currentPlans);
      const liveHabits = cloneHabits(currentHabits);
      const liveProactivity = proactivity ? { ...proactivity } : null;
      const refreshEntry = (entry: PulseEntry): PulseEntry => {
        if (
          arePlansEqual(entry.plans, livePlans) &&
          areHabitsEqual(entry.habits, liveHabits) &&
          areProactivityEqual(entry.proactivity, liveProactivity)
        ) {
          return entry;
        }
        return {
          ...entry,
          plans: livePlans,
          habits: liveHabits,
          proactivity: liveProactivity,
        };
      };

      const existingIndex = previous.findIndex((entry) => entry.dateKey === nowDateKey);
      if (existingIndex === 0) {
        const refreshed = refreshEntry(previous[0]);
        if (refreshed === previous[0]) {
          return previous;
        }
        return [refreshed, ...previous.slice(1)];
      }
      if (existingIndex > 0) {
        const currentEntry = refreshEntry(previous[existingIndex]);
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

  const persistPayload = useMemo(() => {
    const normalizedProactivity = proactivity
      ? {
          id: proactivity.id,
          label: proactivity.label,
          description: proactivity.description,
          cadence: proactivity.cadence,
          time: proactivity.time,
          times: proactivity.times ?? [proactivity.time],
          channels: proactivity.channels ?? [],
          timezone: proactivity.timezone ?? null,
          message_length: proactivity.messageLength ?? DEFAULT_PULSE_PROACTIVITY.message_length,
        }
      : {
          id: DEFAULT_PULSE_PROACTIVITY.id,
          label: DEFAULT_PULSE_PROACTIVITY.label,
          description: DEFAULT_PULSE_PROACTIVITY.description,
          cadence: DEFAULT_PULSE_PROACTIVITY.cadence,
          time: DEFAULT_PULSE_PROACTIVITY.time,
          times: DEFAULT_PULSE_PROACTIVITY.times,
          channels: DEFAULT_PULSE_PROACTIVITY.channels,
          timezone: DEFAULT_PULSE_PROACTIVITY.timezone,
          message_length: DEFAULT_PULSE_PROACTIVITY.message_length,
        };

    return {
      date_key: nowDateKey,
      timestamp: todayAnchor.getTime(),
      plans: clonePlans(currentPlans).map((plan) => ({
        id: String(plan.id),
        label: plan.label,
        completed: Boolean(plan.completed),
        deadline: plan.deadline ?? null,
        schedule_slot: plan.scheduleSlot ?? null,
        description: plan.details ?? null,
        reminder_at: plan.reminderAt ?? null,
        color: plan.color ?? null,
      })),
      habits: cloneHabits(currentHabits).map((habit) => ({
        id: String(habit.id),
        label: habit.label,
        previous_label: habit.previousLabel ?? "",
        completed: Boolean(habit.completed),
      })),
      proactivity: normalizedProactivity,
    };
  }, [currentHabits, currentPlans, nowDateKey, proactivity, todayAnchor]);

  const persistSignature = useMemo(
    () => JSON.stringify({ userId, payload: persistPayload }),
    [persistPayload, userId]
  );

  useEffect(() => {
    if (!userId) {
      lastPersistSignatureRef.current = null;
      return;
    }
    if (persistSignature === lastPersistSignatureRef.current) {
      return;
    }

    let cancelled = false;
    lastPersistSignatureRef.current = persistSignature;

    const persistPulse = async () => {
      try {
        const saved = await dashboardService.createOrUpdateDashboardPulse(userId, persistPayload);
        if (cancelled) {
          return;
        }

        const mapped = mapDashboardPulseToEntry(saved);
        setPulseState((previous) => {
          if (previous.userId !== userId) {
            return previous;
          }

          const existingIndex = previous.entries.findIndex((entry) => entry.dateKey === mapped.dateKey);
          const existingId =
            existingIndex >= 0 ? previous.entries[existingIndex]?.id ?? null : `pulse-${mapped.dateKey}`;
          const nextEntries = [...previous.entries];

          if (existingIndex >= 0) {
            nextEntries[existingIndex] = mapped;
          } else {
            nextEntries.unshift(mapped);
          }

          const nextActivePulseId =
            previous.activePulseId === existingId ? mapped.id : previous.activePulseId;

          return {
            ...previous,
            entries: nextEntries.slice(0, MAX_PULSE_HISTORY),
            activePulseId: nextActivePulseId,
          };
        });
      } catch (error) {
        lastPersistSignatureRef.current = null;
        console.error("Failed to persist dashboard pulse:", error);
      }
    };

    void persistPulse();

    return () => {
      cancelled = true;
    };
  }, [persistPayload, persistSignature, userId]);

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
    isActivePulseEditable,
  };
}
