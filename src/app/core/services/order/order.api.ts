const BASE = 'orders' as const;
const ADMIN_BASE = 'admin/orders' as const;

/**
 * Order-related endpoints
 */
export const ORDERS_API = {
    BASE,
    ADMIN_BASE,
    LIST: BASE,
    CREATE: BASE,
    GET_BY_ID: (orderId: number | string) => `${BASE}/${orderId}`,
    UPDATE: (orderId: number | string) => `${BASE}/${orderId}`,
    CANCEL: (orderId: number | string) => `${BASE}/${orderId}/cancel`,
    CONFIRM: (orderId: number | string) => `${BASE}/${orderId}/confirm`,
    COMPLETE: (orderId: number | string) => `${BASE}/${orderId}/complete`,
    TRACK_BY_PHONE: (phone: string) => `${BASE}/track?phone=${encodeURIComponent(phone)}`,
    TRACK_BY_NUMBER: (orderNumber: string) => `${BASE}/order-number/${encodeURIComponent(orderNumber)}`,

    // Admin Order Actions
    ADMIN_UPDATE: (orderId: number | string) => `${ADMIN_BASE}/${orderId}`,
    ADMIN_CONFIRM: (orderId: number | string) => `${ADMIN_BASE}/${orderId}/confirm`,
    ADMIN_CANCEL: (orderId: number | string) => `${ADMIN_BASE}/${orderId}/cancel`,
    ADMIN_COMPLETE: (orderId: number | string) => `${ADMIN_BASE}/${orderId}/complete`,
} as const;
