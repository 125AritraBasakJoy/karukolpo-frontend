import { Injectable, signal, computed } from '@angular/core';
import { CartItem } from '../models/cart.model';
import { Product } from '../models/product.model';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  cart = signal<CartItem[]>([]);

  totalItems = computed(() => this.cart().reduce((total, item) => total + item.quantity, 0));
  subTotal = computed(() => this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0));

  constructor(private messageService: MessageService) {
    // Load cart from localStorage if needed (optional enhancement)
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        this.cart.set(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to load cart', e);
      }
    }
  }

  private saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.cart()));
  }

  addToCart(product: Product) {
    // Check global stock first
    if (this.isOutOfStock(product)) {
      this.messageService.add({ severity: 'error', summary: 'Out of Stock', detail: 'This product is out of stock' });
      return;
    }

    const currentCart = this.cart();
    const existingItem = currentCart.find(item => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity + 1 > (product.stock || 0)) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${product.stock} items` });
        return;
      }
      // Create new array reference for signal update
      this.cart.update(items => items.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      if (1 > (product.stock || 0)) {
        this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Cannot add more than ${product.stock} items` });
        return;
      }
      this.cart.update(items => [...items, { product, quantity: 1 }]);
    }
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `${product.name} added to cart` });
    this.saveCart();
  }

  isOutOfStock(product: Product): boolean {
    if (product.manualStockStatus === 'OUT_OF_STOCK') return true;
    if (product.manualStockStatus === 'IN_STOCK') return false;
    return (product.stock || 0) <= 0;
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
    if (change > 0 && newQuantity > (targetItem.product.stock || 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Stock Limit', detail: `Only ${targetItem.product.stock} items available` });
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
