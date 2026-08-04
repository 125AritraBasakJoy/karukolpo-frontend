const BASE = 'products' as const;

/**
 * Product-related endpoints
 */
export const PRODUCTS_API = {
    BASE,
    LIST: BASE,
    CREATE: BASE,
    GET_BY_ID: (productId: string) => `${BASE}/${productId}`,
    UPDATE: (productId: string) => `${BASE}/${productId}`,
    DELETE: (productId: string) => `${BASE}/${productId}`,

    // Product Categories
    LIST_CATEGORIES: (productId: string) => `${BASE}/${productId}/categories`,
    ADD_CATEGORY: (productId: string, categoryId: string) => `${BASE}/${productId}/categories/${categoryId}`,
    REMOVE_CATEGORY: (productId: string, categoryId: string) => `${BASE}/${productId}/categories/${categoryId}`,
    ADD_MULTIPLE_CATEGORIES: (productId: string) => `${BASE}/${productId}/categories`,
    UPDATE_CATEGORIES: (productId: string) => `${BASE}/${productId}/categories`,

    // Product Inventory
    GET_INVENTORY: (productId: string) => `${BASE}/${productId}/inventory`,
    UPDATE_INVENTORY: (productId: string) => `${BASE}/${productId}/inventory`,

    // Product Images
    ADD_IMAGE: (productId: string) => `${BASE}/${productId}/images`,
    BULK_UPLOAD_IMAGES: (productId: string) => `${BASE}/${productId}/images/bulk`,
    BATCH_UPDATE_IMAGES: (productId: string) => `${BASE}/${productId}/images/batch`,
    REMOVE_IMAGE: (productId: string, imageId: string) => `${BASE}/${productId}/images/${imageId}`,
    SET_PRIMARY_IMAGE: (productId: string, imageId: string) => `${BASE}/${productId}/images/${imageId}/set-primary`,

    // Special Sections
    HOT_DEALS: `${BASE}/hot-deals`,
    HOT_DEALS_DELETE: (productId: string) => `${BASE}/hot-deals/${productId}`,
    BEST_SELLERS: `${BASE}/best-sellers`,
    BEST_SELLERS_DELETE: (productId: string) => `${BASE}/best-sellers/${productId}`,
} as const;
