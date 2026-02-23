import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, BadgeModule],
  template: `
    <div class="header-glass flex justify-content-between align-items-center pl-1 pr-4 sticky top-0 z-5">
      <div class="flex align-items-center gap-2 cursor-pointer h-full" routerLink="/">
        <img src="assets/logo.png" alt="Karukolpo Logo" class="header-logo" />
      </div>
      
      <div class="flex align-items-center gap-2 sm:gap-3">
        <button pButton label="Track Order" icon="pi pi-search" 
          class="p-button-text header-btn hidden sm:inline-flex" 
          routerLink="/track-order"></button>
          
        <div class="relative flex align-items-center">
          <button pButton icon="pi pi-shopping-cart" 
            class="p-button-rounded p-button-text header-cart-btn" 
            (click)="openCart()">
          </button>
          <span *ngIf="cartService.totalItems() > 0" class="cart-badge-new">
            {{ cartService.totalItems() }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .header-glass {
      height: 80px;
      background: rgba(15, 23, 42, 0.8) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1) !important;
    }

    .header-logo {
      height: 80px;
      width: auto;
      object-fit: contain;
      transition: transform 0.3s ease;
      &:hover {
        transform: scale(1.02);
      }
    }

    .header-btn {
      color: var(--text-color-secondary) !important;
      font-weight: 500 !important;
      padding: 0.6rem 1.25rem !important;
      border-radius: 12px !important;
      transition: all 0.3s ease !important;
      
      &:hover {
        background: rgba(255, 255, 255, 0.05) !important;
        color: var(--accent-color) !important;
        transform: translateY(-1px);
      }

      ::ng-deep .p-button-icon {
        font-size: 1.1rem;
        margin-right: 0.5rem;
      }
    }

    .header-cart-btn {
      width: 42px !important;
      height: 42px !important;
      background: rgba(59, 130, 246, 0.1) !important;
      border: 1px solid rgba(59, 130, 246, 0.2) !important;
      color: var(--accent-color) !important;
      transition: all 0.3s ease !important;

      &:hover {
        background: rgba(59, 130, 246, 0.2) !important;
        transform: translateY(-1px) scale(1.05);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2) !important;
      }

      ::ng-deep .p-button-icon {
        font-size: 1.25rem;
      }
    }

    .cart-badge-new {
      position: absolute;
      top: -2px;
      right: -2px;
      background: #ef4444;
      color: white;
      min-width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 1.5px solid #0f172a;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      z-index: 100;
      pointer-events: none;
    }
  `]
})
export class HeaderComponent {
  constructor(
    public cartService: CartService,
    private router: Router
  ) { }

  openCart() {
    this.router.navigate(['/cart']);
  }
}
