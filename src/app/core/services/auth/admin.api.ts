const BASE = 'admin' as const;

/**
 * Admin authentication endpoints
 */
export const ADMIN_API = {
    BASE,
    LOGIN: `${BASE}/login`,
    REFRESH: `${BASE}/refresh`,
    FORGOT_PASSWORD: `${BASE}/forgot-password`,
    RESET_PASSWORD: `${BASE}/reset-password`,
} as const;
