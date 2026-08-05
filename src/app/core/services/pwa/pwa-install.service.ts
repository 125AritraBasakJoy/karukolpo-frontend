import { Injectable, Inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Cross-browser install prompt for the PWA.
 *
 * - Chromium (Chrome/Edge/Opera/Samsung Internet, desktop + Android):
 *   fires `beforeinstallprompt`; we defer it and show our own dialog, then call
 *   `prompt()` on demand.
 * - iOS Safari: does not fire `beforeinstallprompt`; `isIOS` tells the UI to show
 *   "Share → Add to Home Screen" instructions instead.
 * - Desktop Firefox: no install API; the popup is simply not shown.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
    private deferredPrompt: any = null;

    readonly canInstall = signal<boolean>(false);
    readonly installed = signal<boolean>(false);
    readonly isIOS = signal<boolean>(false);

    private readonly DISMISS_KEY = 'karukolpo.pwa.installDismissedAt';
    private readonly RE_PROMPT_DAYS = 7;

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        if (isPlatformBrowser(this.platformId)) {
            this.detectPlatform();
            this.bindListeners();
        }
    }

    /** True when the app is running as an installed PWA (home-screen app). */
    readonly isStandalone = computed<boolean>(() => {
        if (!isPlatformBrowser(this.platformId)) return false;
        return window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
    });

    /**
     * Whether we should surface the install prompt right now.
     * Not standalone + install available + not dismissed within the last 7 days.
     */
    shouldShow(): boolean {
        if (!isPlatformBrowser(this.platformId) || this.isStandalone()) {
            return false;
        }
        if (this.installed()) {
            return false;
        }
        const dismissedAt = Number(localStorage.getItem(this.DISMISS_KEY) || 0);
        if (dismissedAt && Date.now() - dismissedAt < this.RE_PROMPT_DAYS * 24 * 60 * 60 * 1000) {
            return false;
        }
        return this.canInstall() || this.isIOS();
    }

    /** Remember the user chose "Not now" so we wait RE_PROMPT_DAYS before asking again. */
    markDismissed(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        localStorage.setItem(this.DISMISS_KEY, String(Date.now()));
    }

    /** Trigger the native install prompt. Resolves true when the user accepted. */
    async promptInstall(): Promise<boolean> {
        if (!isPlatformBrowser(this.platformId)) return false;
        if (!this.deferredPrompt) return false;

        const prompt = this.deferredPrompt;
        this.deferredPrompt = null;
        this.canInstall.set(false);

        try {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') {
                this.installed.set(true);
                return true;
            }
        } catch (err) {
            console.error('Install prompt failed:', err);
        }
        return false;
    }

    private detectPlatform(): void {
        const ua = window.navigator.userAgent || '';
        const iOS = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && (window.navigator as any).maxTouchPoints > 1);
        this.isIOS.set(iOS);
    }

    private bindListeners(): void {
        // Pick up early-captured event if present
        if (typeof window !== 'undefined' && (window as any).deferredPrompt) {
            this.deferredPrompt = (window as any).deferredPrompt;
            this.canInstall.set(true);
        }

        // Listen for custom event dispatch from index.html
        window.addEventListener('pwa-beforeinstallprompt', (event: any) => {
            this.deferredPrompt = event.detail;
            this.canInstall.set(true);
        });

        window.addEventListener('beforeinstallprompt', (event: any) => {
            event.preventDefault();
            this.deferredPrompt = event;
            this.canInstall.set(true);
        });

        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.canInstall.set(false);
            this.installed.set(true);
        });

        window.addEventListener('load', () => {
            try {
                if ((window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches) {
                    this.installed.set(true);
                    this.canInstall.set(false);
                }
            } catch {
                /* ignore */
            }
        });
    }
}
