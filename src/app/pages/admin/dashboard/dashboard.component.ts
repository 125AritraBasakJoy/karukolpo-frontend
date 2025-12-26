import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { NotificationService } from '../../../services/notification.service';


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
        
        <div class="mt-auto">
            <div class="mb-3">
                <p-button [label]="themeService.currentTheme() === 'light' ? 'Dark Mode' : 'Light Mode'" 
                          [icon]="themeService.currentTheme() === 'light' ? 'pi pi-moon' : 'pi pi-sun'" 
                          (onClick)="themeService.toggleTheme()" 
                          styleClass="p-button-outlined p-button-secondary w-full"></p-button>
            </div>
            <p-button label="Logout" icon="pi pi-sign-out" (click)="logout()" styleClass="p-button-danger w-full"></p-button>
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
      background-color: var(--surface-overlay);
      color: var(--text-color);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--surface-border);
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 2rem;
      text-align: center;
      color: var(--text-color);
    }
    .content {
      flex: 1;
      padding: 2rem;
      overflow-y: auto;
      background-color: var(--surface-0);
      color: var(--text-color);
    }
    .logout-button {
      margin-top: auto;
    }
  `]
})
export class DashboardComponent implements OnInit {
  menuItems: MenuItem[];
  private notificationService = inject(NotificationService);
  private messageService = inject(MessageService);

  constructor(
    private authService: AuthService,
    public themeService: ThemeService
  ) {
    this.menuItems = [
      { label: 'Inventory', icon: 'pi pi-box', routerLink: 'inventory' },
      { label: 'Orders', icon: 'pi pi-shopping-cart', routerLink: 'orders' },
      { label: 'Manage Landing', icon: 'pi pi-image', routerLink: 'manage-landing' },
      { label: 'Payment Mgmt', icon: 'pi pi-wallet', routerLink: '/admin/dashboard/payment-management' },
      { label: 'Delivery Charges', icon: 'pi pi-truck', routerLink: '/admin/dashboard/delivery-management' },
      { label: 'Settings', icon: 'pi pi-cog', routerLink: 'settings' }
    ];
  }

  ngOnInit() {
    // Initialize Notification Service Global Listeners
    this.notificationService.init(this.messageService); // Pass local MessageService
  }

  logout() {
    this.authService.logout();
  }
}

