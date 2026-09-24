import { Component, signal, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { CartService } from '../../core/services/cart/cart.service';
import { CategoryService } from '../../core/services/category/category.service';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, BadgeModule, NgOptimizedImage],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  searchQuery = '';
  isShopMenuOpen = signal<boolean>(false);
  isCollectionsMenuOpen = signal<boolean>(false);
  isMobileMenuOpen = signal<boolean>(false);

  constructor(
    public cartService: CartService,
    public categoryService: CategoryService,
    private router: Router,
    private elementRef: ElementRef
  ) { }

  openCart() {
    this.router.navigate(['/cart']);
  }

  onSearchSubmit() {
    const q = this.searchQuery.trim();
    if (q) {
      this.router.navigate(['/all-products'], { queryParams: { q: q } });
      this.isMobileMenuOpen.set(false);
    } else {
      this.router.navigate(['/all-products']);
    }
  }

  toggleShopMenu(event: Event) {
    event.stopPropagation();
    this.isCollectionsMenuOpen.set(false);
    this.isShopMenuOpen.set(!this.isShopMenuOpen());
  }

  toggleCollectionsMenu(event: Event) {
    event.stopPropagation();
    this.isShopMenuOpen.set(false);
    this.isCollectionsMenuOpen.set(!this.isCollectionsMenuOpen());
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  closeAllMenus() {
    this.isShopMenuOpen.set(false);
    this.isCollectionsMenuOpen.set(false);
    this.isMobileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeAllMenus();
    }
  }
}
