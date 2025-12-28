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

    async createAffiliate(payload: {
        code: string;
        display_name?: string | null;
        owner_email?: string | null;
        commission_rate?: number | null;
        discount_rate?: number | null;
        is_active?: boolean;
    }): Promise<AffiliateDirectoryEntry> {
        return apiFetch<AffiliateDirectoryEntry>("/analytics/affiliates", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async seedTestAffiliate(): Promise<AffiliateDirectoryEntry> {
        return apiFetch<AffiliateDirectoryEntry>("/analytics/affiliates/test", {
            method: "POST",
        });
    }
}

export const analyticsService = new AnalyticsService();
