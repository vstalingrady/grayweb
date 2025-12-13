/**
 * Anonymous session management for unauthenticated users.
 * Tracks message count in sessionStorage to limit free usage before requiring sign-up.
 */

const ANON_MESSAGE_COUNT_KEY = "gray_anon_message_count";
const ANON_CAPTCHA_VERIFIED_KEY = "gray_anon_captcha_verified";
const ANON_MESSAGE_LIMIT = 5;

/**
 * Get the current anonymous message count.
 */
export function getAnonMessageCount(): number {
    if (typeof window === "undefined") {
        return 0;
    }
    try {
        const stored = sessionStorage.getItem(ANON_MESSAGE_COUNT_KEY);
        const count = stored ? parseInt(stored, 10) : 0;
        return Number.isNaN(count) ? 0 : count;
    } catch {
        return 0;
    }
}

/**
 * Increment the anonymous message count.
 */
export function incrementAnonMessageCount(): number {
    if (typeof window === "undefined") {
        return 0;
    }
    try {
        const current = getAnonMessageCount();
        const next = current + 1;
        sessionStorage.setItem(ANON_MESSAGE_COUNT_KEY, String(next));
        return next;
    } catch {
        return 0;
    }
}

/**
 * Check if the anonymous message limit has been reached.
 */
export function isAnonLimitReached(): boolean {
    return getAnonMessageCount() >= ANON_MESSAGE_LIMIT;
}

/**
 * Get the remaining message count for anonymous users.
 */
export function getAnonMessagesRemaining(): number {
    return Math.max(0, ANON_MESSAGE_LIMIT - getAnonMessageCount());
}

/**
 * Check if captcha has been verified for this anonymous session.
 */
export function isAnonCaptchaVerified(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return sessionStorage.getItem(ANON_CAPTCHA_VERIFIED_KEY) === "1";
    } catch {
        return false;
    }
}

/**
 * Mark captcha as verified for this anonymous session.
 */
export function markAnonCaptchaVerified(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        sessionStorage.setItem(ANON_CAPTCHA_VERIFIED_KEY, "1");
    } catch {
        // Ignore storage errors
    }
}

/**
 * Reset anonymous session state (for testing or after sign-up).
 */
export function resetAnonSession(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        sessionStorage.removeItem(ANON_MESSAGE_COUNT_KEY);
        sessionStorage.removeItem(ANON_CAPTCHA_VERIFIED_KEY);
    } catch {
        // Ignore storage errors
    }
}

export const ANON_MESSAGE_LIMIT_VALUE = ANON_MESSAGE_LIMIT;
