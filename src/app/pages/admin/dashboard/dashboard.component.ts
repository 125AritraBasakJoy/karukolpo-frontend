import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services';;;
import { ThemeService } from '../../../core/services';;;
import { PwaInstallService } from '../../../core/services';;;
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { DialogModule } from 'primeng/dialog';
import { NotificationService } from '../../../core/services';;;
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { AdminChatbotComponent } from '../chatbot/admin-chatbot.component';
import { filter } from 'rxjs/operators';

interface SidebarMenuItemChild {
  label: string;
  icon?: string;
  route: string;
}

interface SidebarMenuItem {
  label: string;
  icon: string;
  route: string;
  section?: string;
  children?: SidebarMenuItemChild[];
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterOutlet, RouterLink, ButtonModule, ToastModule, TooltipModule, BreadcrumbModule, DialogModule, NotificationButtonComponent, AdminChatbotComponent],

  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss', '../admin-styles.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  sidebarCollapsed = signal<boolean>(false);
  mobileMenuOpen = signal<boolean>(false);
  isMobile = signal<boolean>(false);
  currentRoute = signal<string>('');
  expandedSections = signal<Set<string>>(new Set(['Main']));
  expandedSubmenus = signal<Set<string>>(new Set(['Out Sales']));

  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/admin/inventory' };

  private notificationService = inject(NotificationService);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private pwaInstallService = inject(PwaInstallService);
  displayIosInstallDialog = false;

  menuItems: SidebarMenuItem[] = [
    { label: 'Analytics', icon: 'pi pi-chart-bar', route: 'analytics', section: 'Main' },
    { label: 'Inventory', icon: 'pi pi-box', route: 'inventory', section: 'Main' },
    { label: 'Orders', icon: 'pi pi-shopping-cart', route: 'orders', section: 'Main' },
    { label: 'Categories', icon: 'pi pi-tags', route: 'category-manager', section: 'Main' },
    { label: 'Maintenance Control', icon: 'pi pi-cog', route: 'maintenance-control', section: 'Main' },
    {
      label: 'Out Sales',
      icon: 'pi pi-receipt',
      route: 'out-sales',
      section: 'Main',
      children: [
        { label: 'Create Out Sales', icon: 'pi pi-plus-circle', route: 'out-sales/create' },
        { label: 'Edit Out Sales', icon: 'pi pi-pencil', route: 'out-sales/edit' }
      ]
    },
    { label: 'Add Product', icon: 'pi pi-plus-circle', route: 'products/add', section: 'Products' },
    { label: 'Control Hot Deals', icon: 'pi pi-bolt', route: 'hot-deals', section: 'Main' },
    { label: 'Best Selling', icon: 'pi pi-star', route: 'best-selling', section: 'Main' },
    { label: 'Landing Page', icon: 'pi pi-image', route: 'manage-landing', section: 'Settings' }
  ];

  constructor(
    private authService: AuthService,
    public themeService: ThemeService
  ) { }

  get unreadOrderCount(): number {
    const unreadList = this.notificationService.notificationsSignal().filter(n => !(n.is_read || n.read) && (n.type === 'order' || n.type === 'order_placed'));
    if (unreadList.length === 0 && this.notificationService.unreadCountSignal() > 0) {
      return this.notificationService.unreadCountSignal();
    }
    return unreadList.length;
  }

  ngOnInit() {
    this.notificationService.init(this.messageService);
    this.checkScreenSize();
    
    // Expand all menu sections by default so options are visible immediately
    this.expandedSections.set(new Set(this.getMenuSections()));
    
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

  ngOnDestroy(): void {
    this.notificationService.stop();
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

      let menuItem = this.menuItems.find(item => item.route === segment || item.route.includes(segment));

      // Also check child menu items
      if (!menuItem) {
        for (const parent of this.menuItems) {
          if (parent.children) {
            const child = parent.children.find(c => c.route === segment || c.route.includes(segment) || c.route.endsWith('/' + segment));
            if (child) {
              menuItem = { label: child.label, icon: child.icon || parent.icon, route: child.route };
              break;
            }
          }
        }
      }

      this.breadcrumbItems.push({
        label: menuItem ? menuItem.label : this.formatRouteName(segment),
        routerLink: currentPath
      });
    });

    // Auto-expand the section containing the active route
    const activeItem = this.menuItems.find(item => url.includes(item.route));
    if (activeItem) {
      if (activeItem.section) {
        this.expandSection(activeItem.section);
      }
      if (activeItem.children) {
        this.expandedSubmenus.update(set => new Set(set).add(activeItem.label));
      }
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

  isChildActiveRoute(childRoute: string): boolean {
    return this.router.url.endsWith('/' + childRoute) || this.router.url.includes('/' + childRoute);
  }

  isSubmenuExpanded(label: string): boolean {
    return this.expandedSubmenus().has(label);
  }

  toggleSubmenu(item: SidebarMenuItem, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.sidebarCollapsed() && !this.isMobile()) {
      if (item.children && item.children.length > 0) {
        this.router.navigate([`/admin/dashboard/${item.children[0].route}`]);
      }
      return;
    }

    this.expandedSubmenus.update(set => {
      const newSet = new Set(set);
      if (newSet.has(item.label)) {
        newSet.delete(item.label);
      } else {
        newSet.add(item.label);
      }
      return newSet;
    });
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

    // Find matching menu item (including child submenus)
    for (const item of this.menuItems) {
      if (item.children) {
        const childMatch = item.children.find(c =>
          c.route.toLowerCase().includes(lastSegment.toLowerCase()) ||
          lastSegment.toLowerCase().includes(c.route.toLowerCase())
        );
        if (childMatch) return childMatch.label;
      }
      const route = item.route.toLowerCase();
      if (lastSegment.toLowerCase().includes(route) || route.includes(lastSegment.toLowerCase())) {
        return item.label;
      }
    }

    return this.formatRouteName(lastSegment);
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

  canShowInstallButton(): boolean {
    if (this.pwaInstallService.isStandalone()) return false;
    return this.pwaInstallService.canInstall() || this.pwaInstallService.isIOS();
  }

  installApp() {
    if (this.pwaInstallService.isIOS()) {
      this.displayIosInstallDialog = true;
      return;
    }
    this.pwaInstallService.promptInstall();
  }
}
