const BASE = 'admin/notifications' as const;

/**
 * Admin Notification endpoints
 */
export const NOTIFICATIONS_API = {
    BASE,
    LIST: (unreadOnly = false, skip = 0, limit = 50) => `${BASE}?unread_only=${unreadOnly}&skip=${skip}&limit=${limit}`,
    UNREAD_COUNT: `${BASE}/unread-count`,
    READ_ALL: `${BASE}/read-all`,
    MARK_READ: (notificationId: string) => `${BASE}/${notificationId}/read`,
} as const;
