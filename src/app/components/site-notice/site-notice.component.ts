import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { SiteNotice, SiteNoticeService } from '../../core/services/site-notice/site-notice.service';

@Component({
  selector: 'app-site-notice',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-notice.component.html',
  styleUrls: ['./site-notice.component.scss'],
})
export class SiteNoticeComponent {
  private router = inject(Router);
  private noticeService = inject(SiteNoticeService);
  private platformId = inject(PLATFORM_ID);

  private notices = this.noticeService.notices;

  /** Lets admin pages render a preview without depending on live notice */
  preview = input<SiteNotice | null>(null);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  notice = computed(() => {
    const p = this.preview();
    if (p) return p;
    const url = this.url();
    if (!url || url.startsWith('/admin') || url.startsWith('/maintenance')) return null;
    return this.notices()[0] ?? null;
  });

  /** Seconds for one loop; roughly constant reading speed */
  duration = computed(() => Math.max(12, Math.round((this.notice()?.message.length ?? 0) * 0.22)));

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (this.preview()) return;
      const h = this.notice() ? '38px' : '0px';
      document.documentElement.style.setProperty('--site-notice-h', h);
    });
  }
}
