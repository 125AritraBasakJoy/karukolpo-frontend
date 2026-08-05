import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { MAINTENANCE_API } from './maintenance.api';
import { SiteConfigService } from '../site-config/site-config.service';

export interface MaintenanceStatus {
    enabled: boolean;
    message: string | null;
    ends_at: string | null;
}

export interface MaintenanceRead extends MaintenanceStatus {
    updated_at: string | null;
    updated_by: string | null;
}

export interface MaintenanceUpdate {
    enabled: boolean;
    message?: string | null;
    ends_at?: string | null;
}

const DEFAULT_STATUS: MaintenanceStatus = {
    enabled: false,
    message: null,
    ends_at: null
};

@Injectable({
    providedIn: 'root'
})
export class MaintenanceService {
    /** Live storefront view, kept fresh by polling GET /maintenance. */
    status = signal<MaintenanceStatus>({ ...DEFAULT_STATUS });

    private pollTimer: any = null;
    private readonly POLL_INTERVAL = 60000;

    constructor(
        private apiService: ApiService,
        private siteConfigService: SiteConfigService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    /**
     * Public storefront status.
     * GET /maintenance
     */
    refreshStatus(): Observable<MaintenanceStatus> {
        return this.apiService.get<MaintenanceStatus>(MAINTENANCE_API.STATUS);
    }

    /**
     * Applies a status and keeps the legacy SiteConfig flag accurate for
     * anything still reading siteConfig().isMaintenanceMode.
     */
    private applyStatus(status: MaintenanceStatus): void {
        this.status.set(status);
        this.siteConfigService.updateConfig({ isMaintenanceMode: status.enabled });
    }

    /**
     * Admin view — reads the database (source of truth) with audit trail.
     * GET /admin/maintenance
     */
    getAdminState(): Observable<MaintenanceRead> {
        return this.apiService.get<MaintenanceRead>(MAINTENANCE_API.ADMIN_READ);
    }

    /**
     * Flip the switch.
     * PUT /admin/maintenance
     */
    updateAdminState(payload: MaintenanceUpdate): Observable<MaintenanceRead> {
        return this.apiService.put<MaintenanceRead>(MAINTENANCE_API.ADMIN_UPDATE, payload);
    }

    /**
     * Begin polling the public endpoint so the storefront stays in sync with
     * the backend even when it is already open in a tab.
     */
    startPolling(): void {
        if (!isPlatformBrowser(this.platformId) || this.pollTimer) {
            return;
        }
        this.refreshStatus().subscribe({
            next: (status) => this.applyStatus(status),
            error: () => { /* backend unreachable — keep last known state */ }
        });
        this.pollTimer = setInterval(() => {
            this.refreshStatus().subscribe({
                next: (status) => this.applyStatus(status),
                error: () => { /* keep last known state */ }
            });
        }, this.POLL_INTERVAL);
    }

    stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    /** Store a snapshot observed from a 503 maintenance response body. */
    applyBlockedState(payload: Partial<MaintenanceStatus> | null | undefined): void {
        this.applyStatus({
            ...DEFAULT_STATUS,
            enabled: true,
            ...(payload || {})
        });
    }
}
