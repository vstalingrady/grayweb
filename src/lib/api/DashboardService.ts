import { apiFetch } from "./request";
import type {
    DashboardPulse,
    DashboardPulsePlanItem,
    DashboardPulseHabitItem,
    DashboardPulseProactivity
} from "./types";

export class DashboardService {
    async getDashboardPulses(userId: number, limit = 30): Promise<DashboardPulse[]> {
        const params = new URLSearchParams({ limit: String(limit) });
        return apiFetch<DashboardPulse[]>(`/users/${userId}/dashboard/pulses?${params.toString()}`);
    }

    async createOrUpdateDashboardPulse(
        userId: number,
        payload: {
            date_key: string;
            timestamp: number;
            plans: DashboardPulsePlanItem[];
            habits: DashboardPulseHabitItem[];
            proactivity: DashboardPulseProactivity;
            carry_forward?: boolean;
        }
    ): Promise<DashboardPulse> {
        return apiFetch<DashboardPulse>(`/users/${userId}/dashboard/pulses`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
}

export const dashboardService = new DashboardService();
