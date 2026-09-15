const BASE = 'admin/analytics' as const;

/**
 * Analytics endpoints
 */
export const ANALYTICS_API = {
    BASE,
    OVERVIEW: (period = '30d', channel = 'all') => `${BASE}/overview?period=${period}&channel=${channel}`,
    REVENUE_TIMESERIES: (period = '30d', granularity = 'day', channel = 'all') => `${BASE}/revenue-timeseries?period=${period}&granularity=${granularity}&channel=${channel}`,
    ORDERS_BREAKDOWN: (period = '30d', channel = 'all') => `${BASE}/orders-breakdown?period=${period}&channel=${channel}`,
    GEOGRAPHY: (period = '30d', groupBy = 'district', channel = 'all') => `${BASE}/geography?period=${period}&group_by=${groupBy}&channel=${channel}`,
    TOP_PRODUCTS: (period = '30d', by = 'revenue', limit = 10, channel = 'all') => `${BASE}/top-products?period=${period}&by=${by}&limit=${limit}&channel=${channel}`,
    TOP_CATEGORIES: (period = '30d', limit = 10, channel = 'all') => `${BASE}/top-categories?period=${period}&limit=${limit}&channel=${channel}`,
    INVENTORY_HEALTH: `${BASE}/inventory-health`,
    CUSTOMERS: (period = '30d', limit = 10, channel = 'all') => `${BASE}/customers?period=${period}&limit=${limit}&channel=${channel}`,
    DISCOUNTS: (period = '30d', channel = 'all') => `${BASE}/discounts?period=${period}&channel=${channel}`,
    CUSTOMER_SEGMENTS: (period = '30d', channel = 'all') => `${BASE}/customers/segments?period=${period}&channel=${channel}`,
    CUSTOMER_COHORTS: (months = 6, channel = 'all') => `${BASE}/customers/cohorts?months=${months}&channel=${channel}`,
    PATTERNS_TIME: (period = '30d', channel = 'all') => `${BASE}/patterns/time?period=${period}&channel=${channel}`,
    PATTERNS_BASKET: (period = '30d', limit = 10, channel = 'all') => `${BASE}/patterns/basket?period=${period}&limit=${limit}&channel=${channel}`,
    INVENTORY_SLOW_MOVERS: (period = '30d', channel = 'all') => `${BASE}/inventory/slow-movers?period=${period}&channel=${channel}`,
    ORDERS_RISK: (period = '30d', channel = 'all') => `${BASE}/orders/risk?period=${period}&channel=${channel}`,
    PRODUCTS_PROFITABLE: (period = '30d', limit = 10, channel = 'all') => `${BASE}/products/profitable?period=${period}&limit=${limit}&channel=${channel}`,
    MARKETING_ATTRIBUTION: (period = '30d') => `${BASE}/marketing/attribution?period=${period}`,
    TRAFFIC_OVERVIEW: (period = '30d') => `${BASE}/traffic/overview?period=${period}`,
    TRAFFIC_SOURCES: (period = '30d') => `${BASE}/traffic/sources?period=${period}`,
    TRAFFIC_LANDING: (period = '30d') => `${BASE}/traffic/landing?period=${period}`,
    TRAFFIC_GEO: (period = '30d') => `${BASE}/traffic/geo?period=${period}`,
    TRAFFIC_CONVERSION: (period = '30d') => `${BASE}/traffic/conversion?period=${period}`,
    SALES_BY_SOURCE: (period = '30d') => `${BASE}/sales-by-source?period=${period}`,
    JOURNEY_FUNNEL: (period = '30d') => `${BASE}/journey/funnel?period=${period}`,
    JOURNEY_PRODUCT_INTEREST: (period = '30d', limit = 20) => `${BASE}/journey/product-interest?period=${period}&limit=${limit}`,
    JOURNEY_ABANDONED_CARTS: (period = '30d', limit = 50) => `${BASE}/journey/abandoned-carts?period=${period}&limit=${limit}`,
    JOURNEY_ENGAGEMENT: (limit = 50) => `${BASE}/journey/engagement?limit=${limit}`,
    JOURNEY_DEVICE_TIMELINE: (deviceIdHash: string, limit = 200) => `track/journey?device=${encodeURIComponent(deviceIdHash)}&limit=${limit}`,
} as const;
