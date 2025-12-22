import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrderService } from '../../../services/order.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, ButtonModule, MenuModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="admin-layout">
      <div class="sidebar">
        <div class="logo">Karukolpo Admin</div>
        <p-menu [model]="menuItems"></p-menu>
        <div class="logout-button">
            <p-button label="Logout" icon="pi pi-sign-out" (click)="logout()" styleClass="p-button-danger"></p-button>
        </div>
      </div>
      <div class="content">
        <router-outlet></router-outlet>
      </div>
    </div>
    <p-toast position="top-right"></p-toast>
  `,
  styles: [`
    .admin-layout {
      display: flex;
      height: 100vh;
    }
    .sidebar {
      width: 250px;
      background-color: #2a323d;
      color: #fff;
      padding: 1rem;
      display: flex;
      flex-direction: column;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 2rem;
      text-align: center;
    }
    .content {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
      background-color: #f4f4f4;
    }
    .logout-button {
        margin-top: auto;
    }
  `]
})
export class DashboardComponent implements OnInit {
  menuItems: MenuItem[];
  private orderSubscription!: Subscription;

  constructor(
    private authService: AuthService, 
    private orderService: OrderService,
    private messageService: MessageService
  ) {
    this.menuItems = [
      { label: 'Inventory', icon: 'pi pi-box', routerLink: 'inventory' },
      { label: 'Orders', icon: 'pi pi-shopping-cart', routerLink: 'orders' },
      { label: 'Settings', icon: 'pi pi-cog', routerLink: 'settings' }
    ];
  }

  ngOnInit() {
      this.orderSubscription = this.orderService.newOrderNotification$.subscribe(orderId => {
          this.messageService.add({
              severity: 'info',
              summary: 'New Order Received',
              detail: `Order #${orderId} has been placed.`,
              life: 10000
          });
      });
  }

  ngOnDestroy() {
      if (this.orderSubscription) {
          this.orderSubscription.unsubscribe();
      }
  }

  logout() {
    this.authService.logout();
  }
}
