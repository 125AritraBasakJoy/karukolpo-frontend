import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MessageService } from 'primeng/api';
import { Product } from '../../../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private readonly STORAGE_KEY = 'karukolpo_wishlist_ids';
  wishlistIds = signal<Set<string>>(new Set<string>());

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private messageService: MessageService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromStorage();
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.wishlistIds.set(new Set(parsed));
        }
      }
    } catch (e) {
      console.warn('Failed to load wishlist from storage', e);
    }
  }

  private saveToStorage() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const arr = Array.from(this.wishlistIds());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Failed to save wishlist to storage', e);
    }
  }

  isWishlisted(productId: string | number): boolean {
    return this.wishlistIds().has(String(productId));
  }

  isInWishlist(productId: string | number): boolean {
    return this.isWishlisted(productId);
  }

  toggleWishlist(product: Product, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const id = String(product.id);
    const current = new Set(this.wishlistIds());
    if (current.has(id)) {
      current.delete(id);
      this.wishlistIds.set(current);
      this.saveToStorage();
      this.messageService.add({
        severity: 'info',
        summary: 'Wishlist',
        detail: `Removed "${product.name}" from your wishlist.`,
        life: 2500
      });
    } else {
      current.add(id);
      this.wishlistIds.set(current);
      this.saveToStorage();
      this.messageService.add({
        severity: 'success',
        summary: 'Wishlist',
        detail: `Added "${product.name}" to your wishlist!`,
        life: 2500
      });
    }
  }
}
