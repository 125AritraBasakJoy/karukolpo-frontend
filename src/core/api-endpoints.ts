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
 * Query parameter builders for list endpoints
 */
export const buildListQuery = (skip = 0, limit = 100): string => {
    return `?skip=${skip}&limit=${limit}`;
};

/**
 * Helper to build full URL with base
 */
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
} as const;
