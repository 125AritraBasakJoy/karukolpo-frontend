import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { SITE_NOTICE_API } from './site-notice.api';
import { SKIP_GLOBAL_LOADER, SKIP_AUTH_BEARER } from '../../interceptors/http-context-tokens';

export type NoticeTone = 'info' | 'warning' | 'success' | 'danger';

export interface SiteNotice {
  message: string;
  tone: NoticeTone;
  starts_at: string | null;
  ends_at: string | null;
}

export interface SiteNoticeList {
  notices: SiteNotice[];
}

export interface SiteNoticeRead extends Omit<SiteNotice, 'message'> {
  enabled: boolean;
  message: string | null;
  state: 'off' | 'scheduled' | 'live' | 'ended';
  updated_at: string | null;
  updated_by: string | null;
}

export type SiteNoticeUpdate = Partial<Pick<SiteNoticeRead, 'enabled' | 'message' | 'tone' | 'starts_at' | 'ends_at'>>;

@Injectable({ providedIn: 'root' })
export class SiteNoticeService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'karukolpo_site_notices';
  private readonly REFETCH_AFTER_MS = 5 * 60_000;
  private lastFetch = 0;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private started = false;

  /** Seeded from localStorage so returning visitors see live strip immediately */
  readonly notices = signal<SiteNotice[]>(this.stillLive(this.readStored()));

  /** Tracks whether the initial network fetch has resolved (success or error) */
  readonly initialized = signal<boolean>(!isPlatformBrowser(this.platformId));

  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.started) return;
    this.started = true;

    // Apply any initial timer for seeded notices
    this.scheduleNextExpiry(this.notices());

    this.refresh();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Re-evaluate expiry immediately on tab return
        this.notices.set(this.stillLive(this.notices()));
        if (Date.now() - this.lastFetch > this.REFETCH_AFTER_MS) {
          this.refresh();
        }
      }
    });
  }

  refresh(): void {
    const context = new HttpContext()
      .set(SKIP_GLOBAL_LOADER, true)
      .set(SKIP_AUTH_BEARER, true);

    this.http
      .get<SiteNoticeList>(SITE_NOTICE_API.PUBLIC, { context })
      .pipe(catchError(() => of(null))) // Keep existing notices on error
      .subscribe(res => {
        this.initialized.set(true);
        if (!res) return;
        this.lastFetch = Date.now();
        this.apply(res.notices ?? []);
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(res.notices ?? []));
        } catch {
          // Ignore localStorage quota / access issues
        }
      });
  }

  private apply(list: SiteNotice[]): void {
    const live = this.stillLive(list);
    this.notices.set(live);
    this.scheduleNextExpiry(live);
  }

  private scheduleNextExpiry(live: SiteNotice[]): void {
    clearTimeout(this.expiryTimer);
    const endTimes = live
      .map(n => (n.ends_at ? Date.parse(n.ends_at) : Infinity))
      .filter(t => !isNaN(t));
    const nextEnd = endTimes.length ? Math.min(...endTimes) : Infinity;

    if (Number.isFinite(nextEnd)) {
      // +1000ms: ends_at is inclusive; cap at ~24.8 days to prevent 32-bit signed int overflow
      const delay = Math.max(0, Math.min(nextEnd - Date.now() + 1000, 2_147_000_000));
      this.expiryTimer = setTimeout(() => {
        this.apply(this.notices());
      }, delay);
    }
  }

  private stillLive(list: SiteNotice[]): SiteNotice[] {
    const now = Date.now();
    return list.filter(n => {
      if (!n || typeof n.message !== 'string') return false;
      if (!n.ends_at) return true;
      const end = Date.parse(n.ends_at);
      return isNaN(end) || end >= now;
    });
  }

  private readStored(): SiteNotice[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Admin endpoints
  getAdmin() {
    return this.http.get<SiteNoticeRead>(SITE_NOTICE_API.ADMIN_READ);
  }

  update(body: SiteNoticeUpdate) {
    return this.http.patch<SiteNoticeRead>(SITE_NOTICE_API.ADMIN_UPDATE, body);
  }
}
