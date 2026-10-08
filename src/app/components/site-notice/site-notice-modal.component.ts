import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  signal,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { DialogModule } from 'primeng/dialog';
import { SiteNotice, SiteNoticeService } from '../../core/services/site-notice/site-notice.service';

@Component({
  selector: 'app-site-notice-modal',
  standalone: true,
  imports: [CommonModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-notice-modal.component.html',
  styleUrls: ['./site-notice-modal.component.scss'],
})
export class SiteNoticeModalComponent {
  private router = inject(Router);
  private noticeService = inject(SiteNoticeService);
  private platformId = inject(PLATFORM_ID);

  private readonly DISMISSED_KEY_PREFIX = 'karukolpo_notice_dismissed_';
  private inMemoryDismissed = new Set<string>();

  visible = signal<boolean>(false);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.navigated ? this.router.url : '' }
  );

  activeNotices = computed<SiteNotice[]>(() => {
    const url = this.url();
    if (!url || url.startsWith('/admin') || url.startsWith('/maintenance')) return [];
    return this.noticeService.notices();
  });

  primaryTone = computed(() => {
    const list = this.activeNotices();
    return list[0]?.tone ?? 'info';
  });

  fingerprint = computed(() => {
    const list = this.activeNotices();
    if (!list.length) return '';
    return list.map(n => `${n.tone}:${n.starts_at ?? ''}:${n.ends_at ?? ''}:${n.message}`).join('|');
  });

  constructor() {
    effect(() => {
      const isBrowser = isPlatformBrowser(this.platformId);
      if (!isBrowser) return;

      const initialized = this.noticeService.initialized();
      const fp = this.fingerprint();
      const list = this.activeNotices();

      if (!initialized || !fp || !list.length) {
        this.visible.set(false);
        return;
      }

      if (this.isDismissed(fp)) {
        this.visible.set(false);
      } else {
        this.visible.set(true);
      }
    });
  }

  onDismiss(): void {
    const fp = this.fingerprint();
    if (fp) {
      this.markDismissed(fp);
    }
    this.visible.set(false);
  }

  private isDismissed(fp: string): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (this.inMemoryDismissed.has(fp)) return true;
    try {
      return sessionStorage.getItem(this.DISMISSED_KEY_PREFIX + this.hash(fp)) === 'true';
    } catch {
      return this.inMemoryDismissed.has(fp);
    }
  }

  private markDismissed(fp: string): void {
    this.inMemoryDismissed.add(fp);
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem(this.DISMISSED_KEY_PREFIX + this.hash(fp), 'true');
    } catch {
      // Ignore sessionStorage errors
    }
  }

  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
