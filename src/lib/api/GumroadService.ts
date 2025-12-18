/**
 * Gumroad OAuth and API service
 */

export class GumroadService {
    private static readonly API_BASE = "/api";

    /**
     * Initiate Gumroad OAuth flow
     * Redirects user to backend OAuth endpoint which then redirects to Gumroad
     */
    static initiateOAuth(): void {
        window.location.href = `${this.API_BASE}/auth/gumroad/login`;
    }

    /**
     * Disconnect Gumroad account
     */
    static async disconnect(): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${this.API_BASE}/auth/gumroad/disconnect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`Failed to disconnect Gumroad: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Manually verify Gumroad license
     * Useful for existing users who have a license key
     */
    static async verifyLicense(): Promise<{
        success: boolean;
        message?: string;
        tier?: string;
    }> {
        const response = await fetch(`${this.API_BASE}/payment/gumroad/verify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`Failed to verify license: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Check if Gumroad connection was successful from URL params
     */
    static checkOAuthCallback(): {
        success: boolean;
        error?: string;
    } | null {
        if (typeof window === "undefined") return null;

        const params = new URLSearchParams(window.location.search);
        const success = params.get("gumroad_success");
        const error = params.get("gumroad_error");

        if (success === "true") {
            // Clear the URL params
            window.history.replaceState({}, "", window.location.pathname);
            return { success: true };
        }

        if (error) {
            // Clear the URL params
            window.history.replaceState({}, "", window.location.pathname);
            return { success: false, error };
        }

        return null;
    }
}
