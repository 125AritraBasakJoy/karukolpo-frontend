import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { Order } from '../models/order.model';
import { ProductService } from './product.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly STORAGE_KEY = 'orders';
  private orders: Order[] = [];
  private newOrderSubject = new Subject<string>();
  private channel = new BroadcastChannel('karukolpo_orders');

  newOrderNotification$ = this.newOrderSubject.asObservable();

  constructor(private productService: ProductService) {
    this.loadOrders();

    // Listen for broadcast messages from other tabs
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_ORDER') {
        console.log('OrderService: Received broadcast for new order', event.data.orderId);
        this.loadOrders(false); // Sync data without triggering internal notify logic
        this.notifyAdmin(event.data.orderId);
      }
    };

    // Listen for changes from other tabs (backup/sync)
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY) {
        console.log('OrderService: storage event received');
        this.loadOrders(false); // Changed to false, rely on BroadcastChannel for notification
      }
    });
  }

  private loadOrders(notify = false) {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      const parsed: Order[] = JSON.parse(saved);
      // Filter out invalid orders (missing ID or Name)
      const validOrders = parsed.filter(o => o.id && o.fullName);

      if (notify && validOrders.length > this.orders.length) {
        // Assuming new order added
        const latest = validOrders[validOrders.length - 1];
        if (latest && latest.id) {
          this.notifyAdmin(latest.id);
        }
      }

      this.orders = validOrders;

      // If we removed invalid data, update storage
      if (this.orders.length !== parsed.length) {
        this.saveToStorage();
      }
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.orders));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // Storage full, remove oldest orders until it fits
        if (this.orders.length > 0) {
          // Remove roughly 10% of old orders or at least 1 to try to free space
          const removeCount = Math.max(1, Math.floor(this.orders.length * 0.1));
          this.orders.splice(0, removeCount);
          console.warn(`Storage quota exceeded. Removed ${removeCount} oldest orders to make space.`);
          this.saveToStorage(); // Retry recursively
        }
      } else {
        console.error('Error saving to storage', e);
      }
    }
  }

  createOrder(order: Omit<Order, 'id'>): Observable<string> {
    const newOrder: Order = {
      ...order,
      id: this.generateOrderId()
    };
    this.orders.push(newOrder);
    this.saveToStorage();
    this.notifyAdmin(newOrder.id!);

    // Broadcast to other tabs
    this.channel.postMessage({ type: 'NEW_ORDER', orderId: newOrder.id });

    return of(newOrder.id!);
  }

  getOrders(): Observable<Order[]> {
    return of([...this.orders]);
  }

  reloadOrders() {
    this.loadOrders();
    return this.getOrders();
  }

  getOrderById(id: string): Observable<Order | undefined> {
    const normalizedId = id.trim().toUpperCase();
    return of(this.orders.find(o => o.id?.toUpperCase() === normalizedId));
  }

  getOrderByPhone(phone: string): Observable<Order | undefined> {
    // Find orders with this phone number
    const matches = this.orders.filter(o => o.phoneNumber === phone);
    // Return the most recent one (last in array)
    return of(matches.length > 0 ? matches[matches.length - 1] : undefined);
  }

  updateOrderStatus(id: string, status: 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled'): Observable<void> {
    const index = this.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      // If status is changing to Cancelled
      if (status === 'Cancelled' && this.orders[index].status !== 'Cancelled') {
        this.productService.restoreStock(this.orders[index].items).subscribe({
          error: (err) => console.error('Failed to restore stock', err)
        });
      }
      this.orders[index].status = status;
      this.saveToStorage();
    }
    return of(void 0);
  }

  updateOrderPayment(id: string, method: 'COD' | 'bKash', status: 'Pending' | 'Paid'): Observable<void> {
    const index = this.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      this.orders[index].paymentMethod = method;
      this.orders[index].paymentStatus = status;
      this.saveToStorage();
    }
    return of(void 0);
  }

  notifyAdmin(orderId: string) {
    console.log('OrderService: notifyAdmin called for', orderId);
    this.newOrderSubject.next(orderId);
  }

  private generateOrderId(): string {
    return 'KU-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
}
