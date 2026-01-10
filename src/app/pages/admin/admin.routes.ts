import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isAuthenticated()) {
    return true;
  }
  return router.parseUrl('/admin/login');
};

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'inventory', pathMatch: 'full' },
      { path: 'inventory', loadComponent: () => import('./inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'orders', loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent) },
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'manage-landing', loadComponent: () => import('./landing-page-manager/landing-page-manager.component').then(m => m.LandingPageManagerComponent) },
      {
        path: 'payment-management',
        loadComponent: () => import('./payment-management/payment-management.component').then(m => m.PaymentManagementComponent)
      },
      {
        path: 'delivery-management',
        loadComponent: () => import('./delivery-management/delivery-management.component').then(m => m.DeliveryManagementComponent)
      },
      {
        path: 'category-manager',
        loadComponent: () => import('./category-manager/category-manager.component').then(m => m.CategoryManagerComponent)
      }
    ]
  }
];
