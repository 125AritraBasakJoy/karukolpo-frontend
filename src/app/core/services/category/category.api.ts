const BASE = 'categories' as const;

/**
 * Category-related endpoints
 */
export const CATEGORIES_API = {
    BASE,
    LIST: BASE,
    CREATE: BASE,
    GET_BY_ID: (categoryId: number | string) => `${BASE}/${categoryId}`,
    UPDATE: (categoryId: number | string) => `${BASE}/${categoryId}`,
    DELETE: (categoryId: number | string) => `${BASE}/${categoryId}`,
} as const;
