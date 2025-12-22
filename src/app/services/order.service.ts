import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { Order } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly STORAGE_KEY = 'orders';
  private orders: Order[] = [];
  private newOrderSubject = new Subject<string>();

  newOrderNotification$ = this.newOrderSubject.asObservable();

  constructor() {
    this.loadOrders();
  }

  private loadOrders() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      const parsed: Order[] = JSON.parse(saved);
      // Filter out invalid orders (missing ID or Name)
      this.orders = parsed.filter(o => o.id && o.fullName);

      // If we removed invalid data, update storage
      if (this.orders.length !== parsed.length) {
        this.saveToStorage();
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.orders));
  }

  createOrder(order: Omit<Order, 'id'>): Observable<string> {
    const newOrder: Order = {
      ...order,
      id: this.generateOrderId()
    };
    this.orders.push(newOrder);
    this.saveToStorage();
    return of(newOrder.id!);
  }

  getOrders(): Observable<Order[]> {
    return of([...this.orders]);
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

  updateOrderStatus(id: string, status: 'Approved' | 'Delivered' | 'Completed' | 'Deleted'): Observable<void> {
    const index = this.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      this.orders[index].status = status;
      this.saveToStorage();
    }
    return of(void 0);
  }

  notifyAdmin(orderId: string) {
    this.newOrderSubject.next(orderId);
  }

  private generateOrderId(): string {
    return 'KU-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
}
