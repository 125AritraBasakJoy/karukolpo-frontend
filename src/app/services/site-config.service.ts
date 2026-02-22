import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface SiteConfig {
    siteName: string;
    logoUrl: string;
}

@Injectable({
    providedIn: 'root'
})
export class SiteConfigService {
    private readonly STORAGE_KEY = 'siteConfig';

    siteConfig = signal<SiteConfig>({
        siteName: 'Karukolpo',
        logoUrl: '' // Empty string means use text fallback
    });

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        this.loadConfig();
    }

    private loadConfig() {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    this.siteConfig.set({ ...this.siteConfig(), ...parsed });
                } catch (e) {
                    console.error('Failed to parse site config', e);
                }
            }
        }
    }

    updateConfig(config: Partial<SiteConfig>) {
        const newConfig = { ...this.siteConfig(), ...config };
        this.siteConfig.set(newConfig);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
        }
    }
}
