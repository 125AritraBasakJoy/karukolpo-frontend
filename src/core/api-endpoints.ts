/**
 * Centralized API Endpoints Configuration
 * All backend API endpoints for Karukolpo
 */

import { environment } from '../environments/environment';

export const API_CONFIG = {
    BASE_URL: environment.baseUrl,
} as const;

/**
 * Product-related endpoints
 */
export const PRODUCTS_API = {
    LIST: 'products',
    CREATE: 'products',
    GET_BY_ID: (productId: string) => `products/${productId}`,
    UPDATE: (productId: string) => `products/${productId}`,
    DELETE: (productId: string) => `products/${productId}`,

    // Product Categories
    LIST_CATEGORIES: (productId: string) => `products/${productId}/categories`,
    ADD_CATEGORY: (productId: string, categoryId: string) => `products/${productId}/categories/${categoryId}`,
    REMOVE_CATEGORY: (productId: string, categoryId: string) => `products/${productId}/categories/${categoryId}`,
    ADD_MULTIPLE_CATEGORIES: (productId: string) => `products/${productId}/categories`,
    UPDATE_CATEGORIES: (productId: string) => `products/${productId}/categories`,

    // Product Inventory
    GET_INVENTORY: (productId: string) => `products/${productId}/inventory`,
    UPDATE_INVENTORY: (productId: string) => `products/${productId}/inventory`,

    // Product Images
    ADD_IMAGE: (productId: string) => `products/${productId}/images`,
    BULK_UPLOAD_IMAGES: (productId: string) => `products/${productId}/images/bulk`,
    BATCH_UPDATE_IMAGES: (productId: string) => `products/${productId}/images/batch`,
    REMOVE_IMAGE: (productId: string, image_id: string) => `products/${productId}/images/${image_id}`,
    SET_PRIMARY_IMAGE: (productId: string, image_id: string) => `products/${productId}/images/${image_id}/set-primary`,

    // Special Sections
    HOT_DEALS: 'products/hot-deals',
    HOT_DEALS_DELETE: (productId: string) => `products/hot-deals/${productId}`,
    BEST_SELLERS: 'products/best-sellers',
    BEST_SELLERS_DELETE: (productId: string) => `products/best-sellers/${productId}`,
} as const;

/**
 * Category-related endpoints
 */
export const CATEGORIES_API = {
    LIST: 'categories',
    CREATE: 'categories',
    GET_BY_ID: (categoryId: number | string) => `categories/${categoryId}`,
    UPDATE: (categoryId: number | string) => `categories/${categoryId}`,
    DELETE: (categoryId: number | string) => `categories/${categoryId}`,
} as const;

/**
 * Order-related endpoints
 */
export const ORDERS_API = {
    LIST: 'orders',
    CREATE: 'orders',
    GET_BY_ID: (orderId: number | string) => `orders/${orderId}`,
    UPDATE: (orderId: number | string) => `orders/${orderId}`, // Generic update endpoint
    CANCEL: (orderId: number | string) => `orders/${orderId}/cancel`,
    CONFIRM: (orderId: number | string) => `orders/${orderId}/confirm`, // Added based on pattern
    COMPLETE: (orderId: number | string) => `orders/${orderId}/complete`, // Added based on pattern
    TRACK_BY_PHONE: (phone: string) => `orders/track?phone=${encodeURIComponent(phone)}`,
    TRACK_BY_NUMBER: (orderNumber: string) => `orders/order-number/${encodeURIComponent(orderNumber)}`,

    // Admin Order Actions
    ADMIN_UPDATE: (orderId: number | string) => `admin/orders/${orderId}`, // Generic Admin Update
    ADMIN_CONFIRM: (orderId: number | string) => `admin/orders/${orderId}/confirm`,
    ADMIN_CANCEL: (orderId: number | string) => `admin/orders/${orderId}/cancel`,
    ADMIN_COMPLETE: (orderId: number | string) => `admin/orders/${orderId}/complete`,
} as const;

/**
 * Payment-related endpoints
 */
export const PAYMENTS_API = {
    CREATE: (orderId: number | string) => `orders/${orderId}/payments`,
    CONFIRM: (orderId: number | string, paymentId: number | string) => `orders/${orderId}/payments/${paymentId}/confirm`,
    SUBMIT_TRX: (orderId: number | string) => `orders/${orderId}/payment/submit`,
    VERIFY: (orderId: number | string) => `orders/${orderId}/payment/verify`,
    WEBHOOK: (orderId: number | string) => `orders/${orderId}/payments/payments/webhook`,
} as const;

/**
 * Admin authentication endpoints
 */
export const ADMIN_API = {
    LOGIN: 'admin/login',
    REFRESH: 'admin/refresh',
    FORGOT_PASSWORD: 'admin/forgot-password',
    RESET_PASSWORD: 'admin/reset-password',
} as const;

/**
 * Admin Notification endpoints
 */
export const NOTIFICATIONS_API = {
    LIST: (unreadOnly = false, skip = 0, limit = 50) => `admin/notifications?unread_only=${unreadOnly}&skip=${skip}&limit=${limit}`,
    UNREAD_COUNT: 'admin/notifications/unread-count',
    READ_ALL: 'admin/notifications/read-all',
    MARK_READ: (notificationId: string) => `admin/notifications/${notificationId}/read`,
} as const;

/**
 * Query parameter builders for list endpoints
 */
export const buildListQuery = (skip = 0, limit = 100): string => {
    return `?skip=${skip}&limit=${limit}`;
};

/**
 * Helper to build full URL with base
 */
export const ANALYTICS_API = {
    OVERVIEW: (period = '30d') => `admin/analytics/overview?period=${period}`,
    REVENUE_TIMESERIES: (period = '30d', granularity = 'day') => `admin/analytics/revenue-timeseries?period=${period}&granularity=${granularity}`,
    ORDERS_BREAKDOWN: (period = '30d') => `admin/analytics/orders-breakdown?period=${period}`,
    GEOGRAPHY: (period = '30d', groupBy = 'district') => `admin/analytics/geography?period=${period}&group_by=${groupBy}`,
    TOP_PRODUCTS: (period = '30d', by = 'revenue', limit = 10) => `admin/analytics/top-products?period=${period}&by=${by}&limit=${limit}`,
    TOP_CATEGORIES: (period = '30d', limit = 10) => `admin/analytics/top-categories?period=${period}&limit=${limit}`,
    INVENTORY_HEALTH: 'admin/analytics/inventory-health',
    CUSTOMERS: (period = '30d', limit = 10) => `admin/analytics/customers?period=${period}&limit=${limit}`,
    DISCOUNTS: (period = '30d') => `admin/analytics/discounts?period=${period}`,
    CUSTOMER_SEGMENTS: (period = '30d') => `admin/analytics/customers/segments?period=${period}`,
    CUSTOMER_COHORTS: (months = 6) => `admin/analytics/customers/cohorts?months=${months}`,
    PATTERNS_TIME: (period = '30d') => `admin/analytics/patterns/time?period=${period}`,
    PATTERNS_BASKET: (period = '30d', limit = 10) => `admin/analytics/patterns/basket?period=${period}&limit=${limit}`,
    INVENTORY_SLOW_MOVERS: (period = '30d') => `admin/analytics/inventory/slow-movers?period=${period}`,
    ORDERS_RISK: (period = '30d') => `admin/analytics/orders/risk?period=${period}`,
    PRODUCTS_PROFITABLE: (period = '30d', limit = 10) => `admin/analytics/products/profitable?period=${period}&limit=${limit}`,
    MARKETING_ATTRIBUTION: (period = '30d') => `admin/analytics/marketing/attribution?period=${period}`,
    TRAFFIC_OVERVIEW: (period = '30d') => `admin/analytics/traffic/overview?period=${period}`,
    TRAFFIC_SOURCES: (period = '30d') => `admin/analytics/traffic/sources?period=${period}`,
    TRAFFIC_LANDING: (period = '30d') => `admin/analytics/traffic/landing?period=${period}`,
    TRAFFIC_GEO: (period = '30d') => `admin/analytics/traffic/geo?period=${period}`,
    TRAFFIC_CONVERSION: (period = '30d') => `admin/analytics/traffic/conversion?period=${period}`,
} as const;

export const buildFullUrl = (endpoint: string): string => {
    return `${API_CONFIG.BASE_URL}/${endpoint}`;
};

/**
 * All API endpoints grouped by resource
 */
export const API_ENDPOINTS = {
    PRODUCTS: PRODUCTS_API,
    CATEGORIES: CATEGORIES_API,
    ORDERS: ORDERS_API,
    PAYMENTS: PAYMENTS_API,
    ADMIN: ADMIN_API,
    NOTIFICATIONS: NOTIFICATIONS_API,
    ANALYTICS: ANALYTICS_API,
} as const;

