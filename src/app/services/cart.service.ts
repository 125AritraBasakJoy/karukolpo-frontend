import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';
import { MessageService } from 'primeng/api';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  cart = signal<CartItem[]>([]);

  totalItems = computed(() => this.cart().reduce((total, item) => total + item.quantity, 0));
  subTotal = computed(() => this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0));

  constructor(
    private messageService: MessageService,
    private productService: ProductService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Load cart from localStorage if needed (optional enhancement)
    if (isPlatformBrowser(this.platformId)) {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          // Normalize loaded data for robustness
          const normalizedItems = items.map((item: any) => {
            if (item.product) {
              // Ensure manualStockStatus is uppercase
              if (typeof item.product.manualStockStatus === 'string') {
                item.product.manualStockStatus = item.product.manualStockStatus.toUpperCase();
              }
              // Force recalculate isInStock if it's missing or if stock logic changed
              if (item.product.isInStock === undefined) {
                const stock = parseInt(String(item.product.stock || 0), 10);
                const status = item.product.manualStockStatus;
                item.product.isInStock = status === 'IN_STOCK' ? true : (status === 'OUT_OF_STOCK' ? false : stock > 0);
              }
            }
            return item;
          });
          this.cart.set(normalizedItems);
          this.refreshCartProducts();
        } catch (e) {
          console.error('Failed to load cart', e);
        }
      }
    }
  }

  refreshCartProducts() {
    if (this.cart().length === 0) return;

    this.productService.getProducts().subscribe({
      next: (products) => {
        let cartUpdated = false;
        const updatedItems = this.cart().map(item => {
          const freshProduct = products.find(p => p.id === item.product.id);
          if (freshProduct && JSON.stringify(freshProduct) !== JSON.stringify(item.product)) {
            cartUpdated = true;
            return { ...item, product: freshProduct };
          }
          return item;
        });

        if (cartUpdated) {
          this.cart.set(updatedItems);
          this.saveCart();
        }
      },
      error: (err) => console.error('Failed to refresh cart products', err)
    });
  }

  private saveCart() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cart', JSON.stringify(this.cart()));
    }
  }

  addToCart(product: Product) {
    console.log('CartService: Adding product to cart', product.name);
    // Check global stock first
    if (this.isOutOfStock(product)) {
      this.messageService.add({ severity: 'error', summary: 'Out of Stock', detail: 'This product is out of stock' });
      return;
    }

    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);

    if (existingItem) {
      const isForcedInStock = product.manualStockStatus === 'IN_STOCK';
      const availableStock = product.stock || 0;

      // Only enforce limit if we have a positive stock count and not forced
      if (!isForcedInStock && availableStock > 0 && existingItem.quantity + 1 > availableStock) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${availableStock} items` });
        return;
      }
      // Create new array reference for signal update
      this.cart.update(items => items.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      const isForcedInStock = product.manualStockStatus === 'IN_STOCK';
      const availableStock = product.stock || 0;

      if (!isForcedInStock && availableStock > 0 && 1 > availableStock) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${availableStock} items` });
        return;
      }
      this.cart.update(items => [...items, { product, quantity: 1 }]);
    }
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `${product.name} added to cart` });
    this.saveCart();
  }

  isOutOfStock(product: Product): boolean {
    return !product.isInStock;
  }

  updateQuantity(item: CartItem, change: number) {
    const currentCart = this.cart();
    const targetItem = currentCart.find(i => i.product.id === item.product.id);

    if (!targetItem) return;

    // If increasing, check if still in stock (manual status could have changed)
    if (change > 0 && this.isOutOfStock(targetItem.product)) {
      this.messageService.add({ severity: 'error', summary: 'Out of Stock', detail: 'This product is no longer available' });
      return;
    }

    const newQuantity = targetItem.quantity + change;

    // Check max stock when increasing
    const isForcedInStock = targetItem.product.manualStockStatus === 'IN_STOCK';
    const availableStock = targetItem.product.stock || 0;
    if (change > 0 && !isForcedInStock && availableStock > 0 && newQuantity > availableStock) {
      this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Only ${availableStock} items available` });
      return;
    }

    if (newQuantity <= 0) {
      this.cart.update(items => items.filter(i => i.product.id !== item.product.id));
    } else {
      this.cart.update(items => items.map(i =>
        i.product.id === item.product.id ? { ...i, quantity: newQuantity } : i
      ));
    }
    this.saveCart();
  }

  clearCart() {
    this.cart.set([]);
    this.saveCart();
  }
}
