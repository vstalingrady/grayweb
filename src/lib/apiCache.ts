// Simple in-memory cache for API responses
type CacheEntry<T> = {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
};

class ApiCache {
    private cache = new Map<string, CacheEntry<unknown>>();

    get<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;
        if (!entry) {
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            // Entry expired
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set<T>(key: string, data: T, ttl: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    invalidate(key: string): void {
        this.cache.delete(key);
    }

    invalidatePattern(pattern: RegExp): void {
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

// Singleton instance
export const apiCache = new ApiCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    USER: 5 * 60 * 1000, // 5 minutes
    PLANS: 1 * 60 * 1000, // 1 minute
    HABITS: 1 * 60 * 1000, // 1 minute  
    WORKSPACE_BACKGROUNDS: 60 * 60 * 1000, // 1 hour
    CALENDARS: 30 * 1000, // 30 seconds
    REMINDERS: 30 * 1000, // 30 seconds
} as const;

// Cache key builders
export const buildCacheKey = {
    user: (userId: number) => `user:${userId}`,
    plans: (userId: number) => `plans:${userId}`,
    habits: (userId: number) => `habits:${userId}`,
    workspaceBackgrounds: () => 'workspace-backgrounds',
    calendars: (userId: number) => `calendars:${userId}`,
    calendar: (userId: number, calendarId: number) => `calendar:${userId}:${calendarId}`,
    events: (userId: number) => `events:${userId}`,
    reminders: (userId: number) => `reminders:${userId}`,
};
