const BASE = 'combos' as const;
const ADMIN_BASE = 'admin/combos' as const;

export const COMBOS_API = {
  BASE,
  ADMIN_BASE,
  LIST: (limit: number = 20) => `${BASE}?limit=${limit}`,
  PRODUCT_COMBOS: (slugOrId: string) => `products/${encodeURIComponent(slugOrId)}/combos`,
  CART_QUOTE: 'cart/quote',
  ADMIN_LIST: ADMIN_BASE,
  ADMIN_CREATE: ADMIN_BASE,
  ADMIN_GET_BY_ID: (id: string) => `${ADMIN_BASE}/${id}`,
  ADMIN_UPDATE: (id: string) => `${ADMIN_BASE}/${id}`,
  ADMIN_DELETE: (id: string) => `${ADMIN_BASE}/${id}`,
  ADMIN_SUGGESTIONS: (limit: number = 10) => `${ADMIN_BASE}/suggestions?limit=${limit}`,
} as const;
