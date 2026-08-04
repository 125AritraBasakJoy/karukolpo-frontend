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
