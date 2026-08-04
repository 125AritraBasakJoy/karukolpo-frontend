const ORDER_BASE = 'orders' as const;

/**
 * Payment-related endpoints (nested under orders)
 */
export const PAYMENTS_API = {
    CREATE: (orderId: number | string) => `${ORDER_BASE}/${orderId}/payments`,
    CONFIRM: (orderId: number | string, paymentId: number | string) => `${ORDER_BASE}/${orderId}/payments/${paymentId}/confirm`,
    SUBMIT_TRX: (orderId: number | string) => `${ORDER_BASE}/${orderId}/payment/submit`,
    VERIFY: (orderId: number | string) => `${ORDER_BASE}/${orderId}/payment/verify`,
    WEBHOOK: (orderId: number | string) => `${ORDER_BASE}/${orderId}/payments/payments/webhook`,
} as const;
