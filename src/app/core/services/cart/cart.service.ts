import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CartItem } from '../../../models/cart.model';
import { Product } from '../../../models/product.model';
import { MessageService } from 'primeng/api';
import { ProductService } from '../product/product.service';
import { JourneyService } from '../tracking/journey.service';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly ABANDON_KEY = 'cart_abandon_at';
  private readonly ABANDON_MS = 600000;
  private abandonTimer: any = null;

  cart = signal<CartItem[]>([]);

  getItemPrice(product: Product): number {
    return product.effective_price !== undefined && product.effective_price !== null
      ? product.effective_price
      : product.price;
  }

  getItemSubtotal(item: CartItem): number {
    return this.getItemPrice(item.product) * item.quantity;
  }

  totalItems = computed(() => this.cart().reduce((total, item) => total + item.quantity, 0));
  subTotal = computed(() => this.cart().reduce((total, item) => total + this.getItemSubtotal(item), 0));

  constructor(
    private messageService: MessageService,
    private productService: ProductService,
    private journeyService: JourneyService,
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
        } catch (e) {
          console.error('Failed to load cart', e);
        }
      }
    }
    this.handleAbandonedCart();
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

  addToCart(product: Product, requestedQuantity: number = 1): number {
    const qty = Math.max(1, Math.floor(requestedQuantity || 1));

    // Check global stock first
    if (this.isOutOfStock(product)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Out of Stock',
        detail: 'This product is out of stock',
        life: 2500
      });
      return 0;
    }

    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const isForcedInStock = product.manualStockStatus === 'IN_STOCK';
    const availableStock = product.stock || 0;

    let acceptedQty = qty;
    if (!isForcedInStock && availableStock > 0) {
      const maxAddable = Math.max(0, availableStock - currentQty);
      if (maxAddable === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Stock Limit',
          detail: `Cannot add more than ${availableStock} items`,
          life: 2500
        });
        return 0;
      }
      if (qty > maxAddable) {
        acceptedQty = maxAddable;
      }
    }

    if (existingItem) {
      this.cart.update(items => items.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + acceptedQty } : item
      ));
    } else {
      this.cart.update(items => [...items, { product, quantity: acceptedQty }]);
    }

    this.journeyService.track('add_to_cart', { product_id: String(product.id), quantity: acceptedQty });
    this.saveCart();

    if (acceptedQty < qty) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock Limit',
        detail: `Added ${acceptedQty} items (maximum available is ${availableStock})`,
        life: 2500
      });
    } else {
      const detail = acceptedQty > 1
        ? `${acceptedQty} × ${product.name} added to cart`
        : `${product.name} added to cart`;
      this.messageService.add({
        severity: 'success',
        summary: 'Added to Cart',
        detail,
        life: 2500
      });
    }

    return acceptedQty;
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
      this.messageService.add({
        severity: 'error',
        summary: 'Out of Stock',
        detail: 'This product is no longer available',
        life: 2500
      });
      return;
    }

    const newQuantity = targetItem.quantity + change;

    // Check max stock when increasing
    const isForcedInStock = targetItem.product.manualStockStatus === 'IN_STOCK';
    const availableStock = targetItem.product.stock || 0;
    if (change > 0 && !isForcedInStock && availableStock > 0 && newQuantity > availableStock) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock Limit',
        detail: `Only ${availableStock} items available`,
        life: 2500
      });
      return;
    }

    if (newQuantity <= 0) {
      this.journeyService.track('remove_from_cart', { product_id: String(item.product.id) });
      this.cart.update(items => items.filter(i => i.product.id !== item.product.id));
    } else {
      this.cart.update(items => items.map(i =>
        i.product.id === item.product.id ? { ...i, quantity: newQuantity } : i
      ));
    }
    this.saveCart();
  }

  markCheckoutLeft() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.ABANDON_KEY, String(Date.now()));
    }
  }

  clearAbandonClock() {
    if (this.abandonTimer) {
      clearTimeout(this.abandonTimer);
      this.abandonTimer = null;
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.ABANDON_KEY);
    }
  }

  handleAbandonedCart() {
    if (!isPlatformBrowser(this.platformId)) return;

    const raw = localStorage.getItem(this.ABANDON_KEY);
    if (!raw) return;

    const startedAt = parseInt(raw, 10);
    if (isNaN(startedAt)) {
      localStorage.removeItem(this.ABANDON_KEY);
      return;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed >= this.ABANDON_MS) {
      this.clearAbandonClock();
      if (this.cart().length > 0) {
        this.clearCart();
      }
      return;
    }

    // Timer still running: clear the abandoned cart when it expires.
    if (this.abandonTimer) {
      clearTimeout(this.abandonTimer);
    }
    this.abandonTimer = setTimeout(() => {
      this.abandonTimer = null;
      if (isPlatformBrowser(this.platformId) && localStorage.getItem(this.ABANDON_KEY)) {
        this.clearAbandonClock();
        if (this.cart().length > 0) {
          this.clearCart();
        }
      }
    }, this.ABANDON_MS - elapsed);
  }

  clearCart() {
    this.cart.set([]);
    this.saveCart();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('karukolpo_checkout_draft');
    }
  }
}
