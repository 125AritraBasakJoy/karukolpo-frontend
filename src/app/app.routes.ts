import { Routes } from '@angular/router';
import { maintenanceGuard } from './core/guards/maintenance.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'products/:id',
    loadComponent: () => import('./pages/product-details/product-details.component').then(m => m.ProductDetailsComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'admin',
    loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'track-order',
    loadComponent: () => import('./pages/track-order/track-order.component').then(m => m.TrackOrderComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'category/:id',
    loadComponent: () => import('./pages/category-products/category-products.component').then(m => m.CategoryProductsComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart/cart.component').then(m => m.CartComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: 'maintenance',
    loadComponent: () => import('./pages/maintenance/maintenance.component').then(m => m.MaintenanceComponent),
    canActivate: [maintenanceGuard]
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
    canActivate: [maintenanceGuard]
  }
];
