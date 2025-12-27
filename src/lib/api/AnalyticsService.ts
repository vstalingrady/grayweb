import { apiFetch } from "./request";
import type { AnalyticsSummary, AffiliateAnalyticsSummary } from "./types";

export class AnalyticsService {
    async getAnalyticsSummary(): Promise<AnalyticsSummary> {
        return apiFetch<AnalyticsSummary>("/analytics/summary");
    }

    async getAffiliateSummary(): Promise<AffiliateAnalyticsSummary> {
        return apiFetch<AffiliateAnalyticsSummary>("/analytics/affiliate");
    }
}

export const analyticsService = new AnalyticsService();
