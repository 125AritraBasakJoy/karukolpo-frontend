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
    <div class="surface-card shadow-2 flex justify-content-between align-items-center px-4 py-3 sticky top-0 z-5">
      <div class="flex align-items-center gap-2 cursor-pointer" routerLink="/">
        <!-- You can add a logo image here if available -->
        <span class="text-2xl font-bold text-900">Karukolpo</span>
      </div>
      
      <div class="flex align-items-center gap-3">
        <button pButton label="Track Order" icon="pi pi-search" class="p-button-text hidden sm:inline-flex" 
          routerLink="/track-order"></button>
          
        <button pButton icon="pi pi-shopping-cart" class="p-button-rounded p-button-text relative overflow-visible" 
          (click)="openCart()">
          <p-badge *ngIf="cartService.totalItems() > 0" [value]="cartService.totalItems().toString()" severity="danger" 
            styleClass="absolute -top-1 -right-1"></p-badge>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class HeaderComponent {
  constructor(
    public cartService: CartService,
    private router: Router
  ) {}

  openCart() {
    // Navigate to home with checkout query param to trigger the modal
    this.router.navigate(['/'], { queryParams: { checkout: 'true' } });
  }
}
