import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import { workspaceService } from "@/lib/api";
import type {
  PlanItem,
  PlanUpdates,
  PulseEntry,
} from "@/components/gray/types";

type UsePlanHabitActionsOptions = {
  userId: number | null;
  isActivePulseEditable: boolean;
  pulseEntries: PulseEntry[];
  plans: PlanItem[];
  setPlans: Dispatch<SetStateAction<PlanItem[]>>;
  sendDashboardNotification: (title: string, body: string) => Promise<void>;
};

export const usePlanHabitActions = ({
  userId,
  isActivePulseEditable,
  pulseEntries,
  plans,
  setPlans,
  sendDashboardNotification,
}: UsePlanHabitActionsOptions) => {
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

  return {
    togglePlan,
    savePlan,
    deletePlan,
  };
};
