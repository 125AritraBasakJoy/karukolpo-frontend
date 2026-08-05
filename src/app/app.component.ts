import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrderService, NotificationService, VersionService, TrackingService } from './core/services';;
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
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.versionService.checkForUpdates();
        this.trackingService.trackVisit();
      }, 2000);
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

  private checkRoute(url: string): void {
    // Hide footer/header on admin routes
    this.isAdminRoute = url.includes('/admin');
  }
}
