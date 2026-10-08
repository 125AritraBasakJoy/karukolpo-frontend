const BASE = 'site-notices' as const;
const ADMIN_BASE = 'admin/site-notice' as const;

export const SITE_NOTICE_API = {
  BASE,
  ADMIN_BASE,
  PUBLIC: BASE,
  ADMIN_READ: ADMIN_BASE,
  ADMIN_UPDATE: ADMIN_BASE
} as const;
