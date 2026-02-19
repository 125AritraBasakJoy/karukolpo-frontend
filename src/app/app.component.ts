import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrderService } from './services/order.service';
import { NotificationService } from './services/notification.service';
import { FooterComponent } from './components/footer/footer.component';
import { HeaderComponent } from './components/header/header.component';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from './components/loading/loading.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, FooterComponent, HeaderComponent, CommonModule, LoadingComponent],
  template: `
    <div class="app-layout">
      <app-loading></app-loading>
      <app-header *ngIf="!isAdminRoute"></app-header>
      <div class="main-content">
        <router-outlet></router-outlet>
      </div>
      <app-footer *ngIf="!isAdminRoute"></app-footer>
      <p-toast position="top-right"></p-toast>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'karukolpo-frontend';
  isAdminRoute = false;

  constructor(
    private orderService: OrderService,
    private messageService: MessageService,
    private _notificationService: NotificationService,
    private router: Router
  ) { }

  ngOnInit() {
    // Check if current route is admin
    this.checkRoute(this.router.url);

    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkRoute(event.url);
    });

    this.orderService.newOrderNotification$.subscribe(orderId => {
      this.messageService.add({
        severity: 'info',
        summary: 'New Order Placed',
        detail: `Order ID: ${orderId} has been created.`,
        life: 5000
      });
    });
  }

  private checkRoute(url: string): void {
    // Hide footer/header on admin routes
    this.isAdminRoute = url.startsWith('/admin');
  }
}
