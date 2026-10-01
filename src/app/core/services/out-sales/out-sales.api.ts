const BASE = 'admin/sales' as const;

/**
 * Offline / manual ("Out Sales") endpoints
 */
export const OUT_SALES_API = {
    BASE,
    LIST: BASE,
    CREATE: BASE,
    UPDATE: (saleId: string) => `${BASE}/${saleId}`,
    VOID: (saleId: string) => `${BASE}/${saleId}`,
    FULFILLMENT: (saleId: string) => `${BASE}/${saleId}/fulfillment`,
} as const;
