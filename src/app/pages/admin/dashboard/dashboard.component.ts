import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { NotificationService } from '../../../services/notification.service';
import { filter } from 'rxjs/operators';

interface SidebarMenuItem {
  label: string;
  icon: string;
  route: string;
  section?: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterOutlet, RouterLink, ButtonModule, ToastModule, TooltipModule, BreadcrumbModule],

  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);
  isMobile = signal<boolean>(false);
  currentRoute = signal<string>('');
  expandedSections = signal<Set<string>>(new Set(['Main']));

  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/inventory' };

  private notificationService = inject(NotificationService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  menuItems: SidebarMenuItem[] = [
    { label: 'Inventory', icon: 'pi pi-box', route: 'inventory', section: 'Main' },
    { label: 'Orders', icon: 'pi pi-shopping-cart', route: 'orders', section: 'Main' },
    { label: 'Categories', icon: 'pi pi-tags', route: 'category-manager', section: 'Main' },
    { label: 'Maintenance Control', icon: 'pi pi-cog', route: 'maintenance-control', section: 'Main' },
    { label: 'Add Product', icon: 'pi pi-plus-circle', route: 'products/add', section: 'Products' },
    { label: 'Landing Page', icon: 'pi pi-image', route: 'manage-landing', section: 'Settings' }
  ];

  constructor(
    private authService: AuthService,
    public themeService: ThemeService
  ) { }

  ngOnInit() {
    this.notificationService.init(this.messageService);
    this.checkScreenSize();
    this.updateCurrentRoute(this.router.url);

    // Listen to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateCurrentRoute(event.url);
      if (this.isMobile()) {
        this.mobileMenuOpen.set(false);
      }
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    const wasMobile = this.isMobile();
    this.isMobile.set(window.innerWidth < 768);

    // Auto-collapse sidebar on mobile
    if (this.isMobile() && !wasMobile) {
      this.mobileMenuOpen.set(false);
    }
  }

  private updateCurrentRoute(url: string) {
    // Extract the last segment of the URL
    const segments = url.split('/').filter(s => s);
    const lastSegment = segments[segments.length - 1] || 'dashboard';
    this.currentRoute.set(lastSegment);

    // Build breadcrumb items
    this.breadcrumbItems = [];
    let currentPath = '';

    // Handle breadcrumbs for admin routes
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Skip 'admin' itself as a clickable breadcrumb if it's the first segment
      if (segment === 'admin' && index === 0) return;

      const menuItem = this.menuItems.find(item => item.route === segment || item.route.includes(segment));

      this.breadcrumbItems.push({
        label: menuItem ? menuItem.label : this.formatRouteName(segment),
        routerLink: currentPath
      });
    });

    // Auto-expand the section containing the active route
    const activeItem = this.menuItems.find(item => url.includes(item.route));
    if (activeItem && activeItem.section) {
      this.expandSection(activeItem.section);
    }
  }

  expandSection(section: string) {
    if (!this.expandedSections().has(section)) {
      this.expandedSections.update(set => {
        const newSet = new Set(set);
        newSet.add(section);
        return newSet;
      });
    }
  }

  toggleSidebar() {
    if (this.isMobile()) {
      this.mobileMenuOpen.update(v => !v);
    } else {
      const isCollapsing = !this.sidebarCollapsed();
      this.sidebarCollapsed.set(isCollapsing);

      // If we are expanding, ensure the active section is open
      if (!isCollapsing) {
        this.updateCurrentRoute(this.router.url);
      }
    }
  }

  closeMobileMenu() {
    if (this.isMobile()) {
      this.mobileMenuOpen.set(false);
    }
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.includes(route);
  }

  getMenuSections(): string[] {
    return [...new Set(this.menuItems.map(item => item.section || 'Other'))];
  }

  getItemsBySection(section: string): SidebarMenuItem[] {
    return this.menuItems.filter(item => (item.section || 'Other') === section);
  }

  isSectionExpanded(section: string): boolean {
    return this.expandedSections().has(section);
  }

  toggleSection(section: string) {
    this.expandedSections.update(set => {
      const newSet = new Set(set);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }

  getBreadcrumb(): string {
    const url = this.router.url;
    const segments = url.split('/').filter(s => s);
    const lastSegment = segments[segments.length - 1] || 'dashboard';

    // Find matching menu item
    const item = this.menuItems.find(m => {
      const route = m.route.toLowerCase();
      return lastSegment.toLowerCase().includes(route) || route.includes(lastSegment.toLowerCase());
    });

    return item ? item.label : this.formatRouteName(lastSegment);
  }

  private formatRouteName(route: string): string {
    return route
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  logout() {
    this.authService.logout();
  }
}
