import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MaintenanceService } from '../services/maintenance/maintenance.service';
import { environment } from '../../../environments/environment';

/**
 * Watches for backend maintenance responses (503 with a JSON body whose
 * `maintenance` flag is true) and sends the storefront to the maintenance
 * page. This catches mid-session blocking — e.g. a user already browsing when
 * an admin flips the switch — while the maintenanceGuard handles navigation.
 */
export const maintenanceInterceptor: HttpInterceptorFn = (req, next) => {
    // Only handle our API calls
    if (!req.url.startsWith(environment.baseUrl) && !req.url.startsWith('/api')) {
        return next(req);
    }

    // Never intercept admin traffic or the maintenance poll itself
    const path = req.url.replace(environment.baseUrl, '');
    if (path.startsWith('/admin') || path === '/maintenance') {
        return next(req);
    }

    const maintenanceService = inject(MaintenanceService);
    const router = inject(Router);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 503 && error.error && error.error.maintenance === true) {
                maintenanceService.applyBlockedState({
                    message: error.error.message ?? null,
                    ends_at: error.error.ends_at ?? null
                });
                if (router.url !== '/maintenance') {
                    router.navigate(['/maintenance']);
                }
            }
            return throwError(() => error);
        })
    );
};
