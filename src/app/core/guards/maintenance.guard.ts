import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SiteConfigService } from '../../services/site-config.service';

/**
 * MaintenanceGuard - Redirects users to /maintenance page if maintenance mode is enabled.
 * Excludes the /maintenance path itself and /admin paths to allow management.
 */
export const maintenanceGuard: CanActivateFn = (route, state) => {
    const siteConfigService = inject(SiteConfigService);
    const router = inject(Router);
    const isMaintenance = siteConfigService.siteConfig().isMaintenanceMode;

    // Allow access to maintenance page and admin pages even during maintenance
    const isMaintenancePath = state.url.startsWith('/maintenance');
    const isAdminPath = state.url.startsWith('/admin');

    if (isMaintenance && !isMaintenancePath && !isAdminPath) {
        return router.parseUrl('/maintenance');
    }

    // If we are on maintenance page but maintenance is OFF, redirect home
    if (!isMaintenance && isMaintenancePath) {
        return router.parseUrl('/');
    }

    return true;
};
