import { apiFetch } from "./request";
import type { AnalyticsSummary } from "./types";

export class AnalyticsService {
    async getAnalyticsSummary(): Promise<AnalyticsSummary> {
        return apiFetch<AnalyticsSummary>("/analytics/summary");
    }
}

export const analyticsService = new AnalyticsService();
