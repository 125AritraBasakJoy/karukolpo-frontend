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
    path: 'reset-password',
    loadComponent: () => import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'hot-deals',
        loadComponent: () => import('./hot-deals-manager/hot-deals-manager.component').then(m => m.HotDealsManagerComponent)
      },
      {
        path: 'best-selling',
        loadComponent: () => import('./best-seller-manager/best-seller-manager.component').then(m => m.BestSellerManagerComponent)
      },
      { path: '', redirectTo: 'inventory', pathMatch: 'full' },
      { path: 'inventory', loadComponent: () => import('./inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'orders', loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent) },
      { path: 'manage-landing', loadComponent: () => import('./landing-page-manager/landing-page-manager.component').then(m => m.LandingPageManagerComponent) },
      {
        path: 'category-manager',
        loadComponent: () => import('./category-manager/category-manager.component').then(m => m.CategoryManagerComponent)
      },
      {
        path: 'maintenance-control',
        loadComponent: () => import('./maintenance-control/maintenance-control.component').then(m => m.MaintenanceControlComponent)
      },
      {
        path: 'products/add',
        loadComponent: () => import('./products/add-product/add-product.component').then(m => m.AddProductComponent)
      },
      {
        path: 'inventory/edit/:id',
        loadComponent: () => import('./products/edit-product/edit-product.component').then(m => m.EditProductComponent)
      }
    ]
  }
];
