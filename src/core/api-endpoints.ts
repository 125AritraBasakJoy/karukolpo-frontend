/**
 * Centralized API Endpoints Configuration
 * All backend API endpoints for Karukolpo
 * Base URL: https://karukolpo-backend.onrender.com
 */

import { environment } from '../environments/environment';

export const API_CONFIG = {
    BASE_URL: environment.apiUrl,
} as const;

/**
 * Product-related endpoints
 */
export const PRODUCTS_API = {
    LIST: 'products',
    CREATE: 'products',
    GET_BY_ID: (productId: number) => `products/${productId}`,
    UPDATE: (productId: number) => `products/${productId}`,
    DELETE: (productId: number) => `products/${productId}`,

    // Product Categories
    LIST_CATEGORIES: (productId: number) => `products/${productId}/categories`,
    ADD_CATEGORY: (productId: number, categoryId: number) => `products/${productId}/categories/${categoryId}`,
    REMOVE_CATEGORY: (productId: number, categoryId: number) => `products/${productId}/categories/${categoryId}`,

    // Product Inventory
    GET_INVENTORY: (productId: number) => `products/${productId}/inventory`,
    UPDATE_INVENTORY: (productId: number) => `products/${productId}/inventory`,

    // Product Images
    ADD_IMAGE: (productId: number) => `products/${productId}/images`,
    REMOVE_IMAGE: (productId: number, imageId: number) => `products/${productId}/images/${imageId}`,
    SET_PRIMARY_IMAGE: (productId: number, imageId: number) => `products/${productId}/images/${imageId}/set-primary`,
} as const;

/**
 * Category-related endpoints
 */
export const CATEGORIES_API = {
    LIST: 'categories',
    CREATE: 'categories',
    GET_BY_ID: (categoryId: number) => `categories/${categoryId}`,
    UPDATE: (categoryId: number) => `categories/${categoryId}`,
    DELETE: (categoryId: number) => `categories/${categoryId}`,
} as const;

/**
 * Order-related endpoints
 */
export const ORDERS_API = {
    LIST: 'orders',
    CREATE: 'orders',
    GET_BY_ID: (orderId: number) => `orders/${orderId}`,
    CANCEL: (orderId: number) => `orders/${orderId}/cancel`,
    TRACK_BY_PHONE: (phone: string) => `orders/track?phone=${encodeURIComponent(phone)}`,
    
    // Admin Order Actions
    ADMIN_CONFIRM: (orderId: number) => `admin/orders/${orderId}/confirm`,
    ADMIN_CANCEL: (orderId: number) => `admin/orders/${orderId}/cancel`,
} as const;

/**
 * Payment-related endpoints
 */
export const PAYMENTS_API = {
    CREATE: (orderId: number) => `orders/${orderId}/payments`,
    CONFIRM: (orderId: number, paymentId: number) => `orders/${orderId}/payments/${paymentId}/confirm`,
    WEBHOOK: (orderId: number) => `orders/${orderId}/payments/payments/webhook`,
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

/**
 * Example usage:
 * 
 * // In a service:
 * import { API_ENDPOINTS } from '@core/api-endpoints';
 * 
 * // List products
 * this.http.get(API_ENDPOINTS.PRODUCTS.LIST);
 * 
 * // Get product by ID
 * this.http.get(API_ENDPOINTS.PRODUCTS.GET_BY_ID(123));
 * 
 * // Create order
 * this.http.post(API_ENDPOINTS.ORDERS.CREATE, orderData);
 * 
 * // Admin login
 * this.http.post(API_ENDPOINTS.ADMIN.LOGIN, { email, password });
 */
