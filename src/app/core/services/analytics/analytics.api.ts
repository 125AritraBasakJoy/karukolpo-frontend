const BASE = 'admin/analytics' as const;

/**
 * Analytics endpoints
 */
export const ANALYTICS_API = {
    BASE,
    OVERVIEW: (period = '30d') => `${BASE}/overview?period=${period}`,
    REVENUE_TIMESERIES: (period = '30d', granularity = 'day') => `${BASE}/revenue-timeseries?period=${period}&granularity=${granularity}`,
    ORDERS_BREAKDOWN: (period = '30d') => `${BASE}/orders-breakdown?period=${period}`,
    GEOGRAPHY: (period = '30d', groupBy = 'district') => `${BASE}/geography?period=${period}&group_by=${groupBy}`,
    TOP_PRODUCTS: (period = '30d', by = 'revenue', limit = 10) => `${BASE}/top-products?period=${period}&by=${by}&limit=${limit}`,
    TOP_CATEGORIES: (period = '30d', limit = 10) => `${BASE}/top-categories?period=${period}&limit=${limit}`,
    INVENTORY_HEALTH: `${BASE}/inventory-health`,
    CUSTOMERS: (period = '30d', limit = 10) => `${BASE}/customers?period=${period}&limit=${limit}`,
    DISCOUNTS: (period = '30d') => `${BASE}/discounts?period=${period}`,
    CUSTOMER_SEGMENTS: (period = '30d') => `${BASE}/customers/segments?period=${period}`,
    CUSTOMER_COHORTS: (months = 6) => `${BASE}/customers/cohorts?months=${months}`,
    PATTERNS_TIME: (period = '30d') => `${BASE}/patterns/time?period=${period}`,
    PATTERNS_BASKET: (period = '30d', limit = 10) => `${BASE}/patterns/basket?period=${period}&limit=${limit}`,
    INVENTORY_SLOW_MOVERS: (period = '30d') => `${BASE}/inventory/slow-movers?period=${period}`,
    ORDERS_RISK: (period = '30d') => `${BASE}/orders/risk?period=${period}`,
    PRODUCTS_PROFITABLE: (period = '30d', limit = 10) => `${BASE}/products/profitable?period=${period}&limit=${limit}`,
    MARKETING_ATTRIBUTION: (period = '30d') => `${BASE}/marketing/attribution?period=${period}`,
    TRAFFIC_OVERVIEW: (period = '30d') => `${BASE}/traffic/overview?period=${period}`,
    TRAFFIC_SOURCES: (period = '30d') => `${BASE}/traffic/sources?period=${period}`,
    TRAFFIC_LANDING: (period = '30d') => `${BASE}/traffic/landing?period=${period}`,
    TRAFFIC_GEO: (period = '30d') => `${BASE}/traffic/geo?period=${period}`,
    TRAFFIC_CONVERSION: (period = '30d') => `${BASE}/traffic/conversion?period=${period}`,
    SALES_BY_SOURCE: (period = '30d') => `${BASE}/sales-by-source?period=${period}`,
} as const;
