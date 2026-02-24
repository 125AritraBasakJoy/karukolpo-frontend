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
    GET_BY_ID: (productId: number | string) => `products/${productId}`,
    UPDATE: (productId: number | string) => `products/${productId}`,
    DELETE: (productId: number | string) => `products/${productId}`,

    // Product Categories
    LIST_CATEGORIES: (productId: number | string) => `products/${productId}/categories`,
    ADD_CATEGORY: (productId: number | string, categoryId: number | string) => `products/${productId}/categories/${categoryId}`,
    REMOVE_CATEGORY: (productId: number | string, categoryId: number | string) => `products/${productId}/categories/${categoryId}`,
    ADD_MULTIPLE_CATEGORIES: (productId: number | string) => `products/${productId}/categories`,
    UPDATE_CATEGORIES: (productId: number | string) => `products/${productId}/categories`,

    // Product Inventory
    GET_INVENTORY: (productId: number | string) => `products/${productId}/inventory`,
    UPDATE_INVENTORY: (productId: number | string) => `products/${productId}/inventory`,

    // Product Images
    ADD_IMAGE: (productId: number | string) => `products/${productId}/images`,
    BULK_UPLOAD_IMAGES: (productId: number | string) => `products/${productId}/images/bulk`,
    BATCH_UPDATE_IMAGES: (productId: number | string) => `products/${productId}/images/batch`,
    REMOVE_IMAGE: (productId: number | string, image_id: number | string) => `products/${productId}/images/${image_id}`,
    SET_PRIMARY_IMAGE: (productId: number | string, image_id: number | string) => `products/${productId}/images/${image_id}/set-primary`,
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
