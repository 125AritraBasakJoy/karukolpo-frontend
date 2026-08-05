const BASE = 'maintenance' as const;
const ADMIN_BASE = 'admin/maintenance' as const;

/**
 * Maintenance endpoints
 */
export const MAINTENANCE_API = {
    BASE,
    ADMIN_BASE,
    STATUS: BASE,
    ADMIN_READ: ADMIN_BASE,
    ADMIN_UPDATE: ADMIN_BASE,
} as const;
