import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { getDeviceId } from '../../../utils/device-id';

type JourneyEventName = 'page_view' | 'add_to_cart' | 'remove_from_cart' | 'begin_checkout';

interface JourneyEvent {
  event: JourneyEventName;
  path?: string | null;
  product_id?: string | null;
  quantity?: number | null;
}

/** Must not exceed MAX_EVENTS_PER_BATCH in app/routers/track.py, or the batch 422s. */
const MAX_BATCH = 20;
const FLUSH_DELAY_MS = 10000;

@Injectable({ providedIn: 'root' })
export class JourneyService {
  private queue: JourneyEvent[] = [];
  private timer: any = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (!isPlatformBrowser(this.platformId)) return;

    // `pagehide`, not `unload`: unload breaks the bfcache and never fires on mobile
    // Safari, which is a large share of this store's traffic. visibilitychange covers
    // tab switches, where a phone user may never come back.
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  track(event: JourneyEventName, detail: Partial<JourneyEvent> = {}): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // Admin browsing is not part of the customer funnel. The backend also excludes
    // authenticated admins from view_product, but it cannot tell for these events —
    // they carry no token — so the filter has to be here.
    if (window.location.pathname.startsWith('/admin')) return;

    this.queue.push({ event, ...detail });

    if (this.queue.length >= MAX_BATCH) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
    }
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.queue.length) return;

    const events = this.queue.splice(0, MAX_BATCH);

    // Raw fetch rather than HttpClient, for one reason: `keepalive` is what lets the
    // request survive the page being closed, and HttpClient cannot express it. The
    // cost is that the interceptors don't run, so the device header is set by hand —
    // it is the same value getDeviceId() gives every other request.
    fetch(`${environment.baseUrl}/track/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // Swallowed on purpose. A customer must never see an analytics failure.
    });

    // A burst larger than one batch leaves a remainder; make sure it still goes.
    if (this.queue.length) {
      this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
    }
  }
}
