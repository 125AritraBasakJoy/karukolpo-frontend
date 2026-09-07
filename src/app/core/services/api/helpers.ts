import { API_CONFIG } from './api-config';

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
 * Helper utility to manage and persist admin table pagination state (page size and offset)
 * across navigations and page changes.
 */
export function getSavedPageSize(key: string, defaultSize: number = 10): number {
    if (typeof window === 'undefined' || !window.localStorage) return defaultSize;
    try {
        const saved = localStorage.getItem(key) || localStorage.getItem('karukolpo_admin_page_size');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if ([10, 20, 25, 50, 100].includes(parsed)) {
                return parsed;
            }
        }
    } catch {}
    return defaultSize;
}

export function savePageSize(key: string, size: number): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        localStorage.setItem(key, size.toString());
        localStorage.setItem('karukolpo_admin_page_size', size.toString());
    } catch {}
}

export function getSavedPageOffset(key: string, defaultOffset: number = 0): number {
    if (typeof window === 'undefined' || !window.sessionStorage) return defaultOffset;
    try {
        const saved = sessionStorage.getItem(key);
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 0) {
                return parsed;
            }
        }
    } catch {}
    return defaultOffset;
}

export function savePageOffset(key: string, offset: number): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        sessionStorage.setItem(key, offset.toString());
    } catch {}
}
