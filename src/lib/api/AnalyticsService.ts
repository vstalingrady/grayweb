import { apiFetch } from "./request";
import type {
  AnalyticsSummary,
  AffiliateAnalyticsSummary,
  AffiliateDirectoryEntry,
  AffiliateDirectoryResponse,
} from "./types";

export class AnalyticsService {
    async getAnalyticsSummary(): Promise<AnalyticsSummary> {
        return apiFetch<AnalyticsSummary>("/analytics/summary");
    }

    async getAffiliateSummary(code?: string): Promise<AffiliateAnalyticsSummary> {
        const query = code ? `?code=${encodeURIComponent(code)}` : "";
        return apiFetch<AffiliateAnalyticsSummary>(`/analytics/affiliate${query}`);
    }

    async getAffiliateDirectory(): Promise<AffiliateDirectoryResponse> {
        return apiFetch<AffiliateDirectoryResponse>("/analytics/affiliates");
    }

    async seedTestAffiliate(): Promise<AffiliateDirectoryEntry> {
        return apiFetch<AffiliateDirectoryEntry>("/analytics/affiliates/test", {
            method: "POST",
        });
    }
}

export const analyticsService = new AnalyticsService();
