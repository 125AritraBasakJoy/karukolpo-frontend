import { Component, OnInit, Inject, PLATFORM_ID, isDevMode } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrderService } from './core/services/order/order.service';
import { NotificationService } from './core/services/notification/notification.service';
import { VersionService } from './core/services/version/version.service';
import { TrackingService } from './core/services/tracking/tracking.service';
import { MaintenanceService } from './core/services/maintenance/maintenance.service';
import { PwaInstallService } from './core/services/pwa/pwa-install.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LoadingComponent } from './components/loading/loading.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, FooterComponent, HeaderComponent, CommonModule, LoadingComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'karukolpo-frontend';
  isAdminRoute = false;

  constructor(
    private orderService: OrderService,
    private messageService: MessageService,
    private _notificationService: NotificationService,
    private router: Router,
    private versionService: VersionService,
    private trackingService: TrackingService,
    private maintenanceService: MaintenanceService,
    private pwaInstallService: PwaInstallService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Programmatically unregister any old/leftover service worker in development mode
      if (isDevMode() && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister().then(() => {
              console.log('Unregistered active service worker in development mode');
            });
          }
        });
      }

      // Defer non-critical background work until the browser is idle,
      // so it doesn't compete with the home page's first paint / initial data.
      const defer = (fn: () => void) => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => fn(), { timeout: 4000 });
        } else {
          setTimeout(fn, 3000);
        }
      };
      defer(() => {
        this.versionService.checkForUpdates();
        this.trackingService.trackVisit();
        // Keep storefront maintenance state in sync with the backend
        this.maintenanceService.startPolling();
        this.initGoogleAnalyticsOnIdle();
      });
    }

    // Check if current route is admin - using window.location.pathname for initial load robustness
    this.isAdminRoute = window.location.pathname.startsWith('/admin');

    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkRoute(event.urlAfterRedirects || event.url);
    });

    // Notification logic consolidated in NotificationService
  }

  private gaInitialized = false;

  private initGoogleAnalyticsOnIdle() {
    if (!isPlatformBrowser(this.platformId) || this.gaInitialized) return;
    if (window.location.pathname.startsWith('/admin')) return;

    // Fire on the first user interaction, or after the window fully loads
    // (whichever comes first), so gtag never competes with the critical render.
    const fire = () => {
      if (this.gaInitialized) return;
      this.gaInitialized = true;
      window.removeEventListener('pointerdown', fire);
      window.removeEventListener('touchstart', fire);
      window.removeEventListener('keydown', fire);
      window.removeEventListener('load', fire);
      this.initGoogleAnalytics();
    };

    window.addEventListener('pointerdown', fire, { passive: true, once: true });
    window.addEventListener('touchstart', fire, { passive: true, once: true });
    window.addEventListener('keydown', fire, { once: true });
    window.addEventListener('load', fire, { once: true });
  }

  private initGoogleAnalytics() {
    if (isPlatformBrowser(this.platformId) && !window.location.pathname.startsWith('/admin')) {
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-2LZ6GZQF66';
      document.head.appendChild(script1);

      const script2 = document.createElement('script');
      script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', 'G-2LZ6GZQF66');
      `;
      document.head.appendChild(script2);
    }
  }

  private checkRoute(url: string): void {
    // Hide footer/header on admin routes
    this.isAdminRoute = url.includes('/admin');
  }
}
