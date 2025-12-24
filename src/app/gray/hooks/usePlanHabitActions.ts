import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { workspaceService, dashboardService } from "@/lib/api";
import type {
  HabitItem,
  HabitUpdates,
  PlanItem,
  PlanUpdates,
  PulseEntry,
} from "@/components/gray/types";

type UsePlanHabitActionsOptions = {
  userId: number | null;
  isActivePulseEditable: boolean;
  pulseEntries: PulseEntry[];
  activePulse: PulseEntry | null;
  setPulseEntries: Dispatch<SetStateAction<PulseEntry[]>>;
  plans: PlanItem[];
  setPlans: Dispatch<SetStateAction<PlanItem[]>>;
  habits: HabitItem[];
  setHabits: Dispatch<SetStateAction<HabitItem[]>>;
  sendDashboardNotification: (title: string, body: string) => Promise<void>;
};

export const usePlanHabitActions = ({
  userId,
  isActivePulseEditable,
  pulseEntries,
  activePulse,
  setPulseEntries,
  plans,
  setPlans,
  habits,
  setHabits,
  sendDashboardNotification,
}: UsePlanHabitActionsOptions) => {
  const [habitEditorTarget, setHabitEditorTarget] = useState<HabitItem | null>(null);

  const canMutateWorkspace = useCallback(() => {
    if (typeof userId !== "number") {
      return false;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return false;
    }
    return true;
  }, [isActivePulseEditable, pulseEntries.length, userId]);

  const togglePlan = useCallback(
    (id: string) => {
      if (!canMutateWorkspace()) {
        return;
      }

      const numericPlanId = Number(id);
      if (Number.isNaN(numericPlanId)) {
        return;
      }

      const previousPlans = plans;
      const targetPlan = previousPlans.find((plan) => plan.id === id);
      if (!targetPlan) {
        return;
      }

      const nextCompleted = !targetPlan.completed;
      const nowIso = new Date().toISOString();
      const updatedPlans = previousPlans.map((plan) =>
        plan.id === id ? { ...plan, completed: nextCompleted, updatedAt: nowIso } : plan
      );

      setPlans(updatedPlans);

      workspaceService.updatePlan(userId as number, numericPlanId, { completed: nextCompleted }).catch((error) => {
        console.error("Failed to update plan:", error);
        setPlans(previousPlans);
      });
    },
    [canMutateWorkspace, plans, setPlans, userId]
  );

  const savePlan = useCallback(
    async (planId: string, updates: PlanUpdates) => {
      if (!canMutateWorkspace()) {
        return;
      }

      const numericPlanId = Number(planId);
      if (Number.isNaN(numericPlanId)) {
        return;
      }

      const previousPlans = plans;
      const updatedPlans = previousPlans.map((plan) =>
        plan.id === planId
          ? {
            ...plan,
            label: updates.label,
            deadline: updates.deadline ?? null,
            scheduleSlot: updates.scheduleSlot ?? null,
            details: updates.details ?? null,
            reminderAt:
              "reminderAt" in updates ? (updates.reminderAt ?? null) : plan.reminderAt ?? null,
            color: "color" in updates ? (updates.color ?? null) : plan.color ?? null,
          }
          : plan
      );

      setPlans(updatedPlans);

      const targetPlan = previousPlans.find((plan) => plan.id === planId);
      const planLabel = updates.label || targetPlan?.label || "Plan";
      void sendDashboardNotification("Plan saved", `${planLabel} updated in today's pulse.`);

      try {
        const updatePayload: Parameters<typeof workspaceService.updatePlan>[2] = {
          label: updates.label,
          description: updates.details ?? null,
          deadline: updates.deadline ?? null,
          scheduleSlot: updates.scheduleSlot ?? null,
        };

        if ("reminderAt" in updates) {
          updatePayload.reminderAt = updates.reminderAt ?? null;
        }
        if ("color" in updates) {
          updatePayload.color = updates.color ?? null;
        }

        await workspaceService.updatePlan(userId as number, numericPlanId, updatePayload);
      } catch (error) {
        console.error("Failed to update plan:", error);
        setPlans(previousPlans);
        throw error;
      }
    },
    [canMutateWorkspace, plans, sendDashboardNotification, setPlans, userId]
  );

  const deletePlan = useCallback(
    (planToDelete: PlanItem) => {
      if (!canMutateWorkspace()) {
        return;
      }

      const numericPlanId = Number(planToDelete.id);
      if (Number.isNaN(numericPlanId)) {
        return;
      }

      const previousPlans = plans;
      const updatedPlans = previousPlans.filter((plan) => plan.id !== planToDelete.id);
      setPlans(updatedPlans);

      workspaceService.deletePlan(userId as number, numericPlanId).catch((error) => {
        console.error("Failed to delete plan:", error);
        setPlans(previousPlans);
      });
    },
    [canMutateWorkspace, plans, setPlans, userId]
  );

  const toggleHabit = useCallback(
    async (id: string) => {
      if (!canMutateWorkspace()) {
        return;
      }

      const previousHabits = habits;
      const targetHabit = previousHabits.find((habit) => habit.id === id);
      if (!targetHabit) {
        return;
      }

      const nowIso = new Date().toISOString();
      const updatedHabits = previousHabits.map((habit) =>
        habit.id === id ? { ...habit, completed: !habit.completed, updatedAt: nowIso } : habit
      );

      setHabits(updatedHabits);

      if (!activePulse) {
        return;
      }

      const updatedPulseHabits = activePulse.habits.map((habit) => {
        if (habit.id === id) {
          const updatedHabit = updatedHabits.find((candidate) => candidate.id === id);
          if (updatedHabit) {
            return { ...habit, completed: updatedHabit.completed };
          }
        }
        return habit;
      });

      const newActivePulse = { ...activePulse, habits: updatedPulseHabits };

      setPulseEntries((previous) =>
        previous.map((entry) => (entry.id === activePulse.id ? newActivePulse : entry))
      );

      try {
        await dashboardService.createOrUpdateDashboardPulse(userId as number, {
          date_key: newActivePulse.dateKey,
          timestamp: newActivePulse.timestamp,
          plans: newActivePulse.plans,
          habits: newActivePulse.habits.map((habit) => ({
            id: habit.id,
            label: habit.label,
            previous_label: habit.previousLabel,
            completed: Boolean(habit.completed),
          })),
          proactivity: {
            id: newActivePulse.proactivity?.id ?? "proactivity-1",
            label: newActivePulse.proactivity?.label ?? "Check-ins",
            description: newActivePulse.proactivity?.description ?? null,
            cadence: newActivePulse.proactivity?.cadence ?? "Manual",
            time: newActivePulse.proactivity?.time ?? "09:00",
          },
          carry_forward: false,
        });
      } catch (error) {
        console.error("Failed to save habit toggle to pulse:", error);
      }
    },
    [activePulse, canMutateWorkspace, habits, setHabits, setPulseEntries, userId]
  );

  const handleHabitModalSubmit = useCallback(
    async (habitId: string | null, updates: HabitUpdates) => {
      if (typeof userId !== "number") {
        throw new Error("You need to be signed in to update habits.");
      }
      if (!habitId) {
        throw new Error("Missing habit id.");
      }
      const numericId = Number(habitId);
      if (Number.isNaN(numericId)) {
        throw new Error("Invalid habit id.");
      }

      const previousHabits = habits;
      const updatedHabits = previousHabits.map((habit) =>
        habit.id === habitId
          ? { ...habit, label: updates.label, details: updates.details ?? habit.details }
          : habit
      );
      setHabits(updatedHabits);

      try {
        await workspaceService.updateHabit(userId, numericId, {
          label: updates.label,
          description: updates.details ?? null,
        });
      } catch (error) {
        console.error("Failed to update habit:", error);
        setHabits(previousHabits);
        throw error instanceof Error ? error : new Error("Failed to update habit.");
      }
    },
    [habits, setHabits, userId]
  );

  const editHabit = useCallback(
    (habitToEdit: HabitItem) => {
      if (!canMutateWorkspace()) {
        return;
      }
      setHabitEditorTarget(habitToEdit);
    },
    [canMutateWorkspace]
  );

  const deleteHabit = useCallback(
    (habitToDelete: HabitItem) => {
      if (!canMutateWorkspace()) {
        return;
      }

      const habitId = Number(habitToDelete.id);
      if (Number.isNaN(habitId)) {
        return;
      }

      const previousHabits = habits;
      const updatedHabits = previousHabits.filter((habit) => habit.id !== habitToDelete.id);
      setHabits(updatedHabits);

      workspaceService.deleteHabit(userId as number, habitId).catch((error: unknown) => {
        console.error("Failed to delete habit:", error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Habit not found")) {
          return;
        }
        setHabits(previousHabits);
      });
    },
    [canMutateWorkspace, habits, setHabits, userId]
  );

  return {
    habitEditorTarget,
    setHabitEditorTarget,
    togglePlan,
    savePlan,
    deletePlan,
    toggleHabit,
    handleHabitModalSubmit,
    editHabit,
    deleteHabit,
  };
};
