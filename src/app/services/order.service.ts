import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Order } from '../models/order.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

export interface PaymentCreate {
  payment_method: string;
  amount: number;
  transaction_id?: string;
}

export interface PaymentConfirm {
  transaction_id: string;
  gateway_response?: any;
}

/**
 * OrderService - Backend API Integration
 * Connects to: https://karukolpo-backend.onrender.com/orders
 */
@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private newOrderSubject = new Subject<string>();
  newOrderNotification$ = this.newOrderSubject.asObservable();

  constructor(private apiService: ApiService) { }

  /**
   * Create new order
   * POST /orders
   */
  createOrder(order: Omit<Order, 'id'>): Observable<string> {
    const backendOrder = this.mapFrontendToBackend(order);
    console.log('Creating order with payload:', backendOrder);

    return this.apiService.post<any>(API_ENDPOINTS.ORDERS.CREATE, backendOrder).pipe(
      tap({
        next: (response) => console.log('Order created successfully:', response),
        error: (err) => console.error('Order creation failed:', err)
      }),
      map(response => {
        const orderId = response.id?.toString() || '';
        // Notify admin of new order
        this.notifyAdmin(orderId);
        return orderId;
      })
    );
  }

  /**
   * Get all orders
   * GET /orders
   */
  getOrders(skip = 0, limit = 100): Observable<Order[]> {
    const query = buildListQuery(skip, limit);
    return this.apiService.get<any[]>(`${API_ENDPOINTS.ORDERS.LIST}${query}`).pipe(
      tap(orders => console.log('Raw orders from backend:', orders)),
      map(orders => orders.map(order => this.mapBackendToFrontend(order)))
    );
  }

  /**
   * Reload orders (alias for getOrders)
   */
  reloadOrders(): Observable<Order[]> {
    return this.getOrders();
  }

  /**
   * Get order by ID
   * GET /orders/{id}
   */
  getOrderById(id: number | string): Observable<Order | undefined> {
    const orderId = typeof id === 'string' ? parseInt(id, 10) : id;

    // Handle non-numeric IDs (legacy localStorage IDs like "KU-xxxx")
    if (isNaN(orderId)) {
      return new Observable<Order | undefined>(observer => {
        observer.next(undefined);
        observer.complete();
      });
    }

    return this.apiService.get<any>(API_ENDPOINTS.ORDERS.GET_BY_ID(orderId)).pipe(
      map(order => this.mapBackendToFrontend(order))
    );
  }

  /**
   * Get order by phone number (search across all orders)
   */
  getOrderByPhone(phone: string): Observable<Order | undefined> {
    return this.getOrders().pipe(
      map(orders => {
        const matches = orders.filter(o => o.phoneNumber === phone);
        return matches.length > 0 ? matches[matches.length - 1] : undefined;
      })
    );
  }

  /**
   * Track orders by phone number
   * GET /orders/track?phone={phone}
   */
  trackOrdersByPhone(phone: string): Observable<Order[]> {
    return this.apiService.get<any[]>(API_ENDPOINTS.ORDERS.TRACK_BY_PHONE(phone)).pipe(
      map(orders => orders.map(order => this.mapBackendToFrontend(order)))
    );
  }

  /**
   * Cancel an order (Customer/Public endpoint)
   * PATCH /orders/{id}/cancel
   */
  cancelOrder(id: number | string): Observable<Order> {
    const orderId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.CANCEL(orderId), {}).pipe(
      map(order => this.mapBackendToFrontend(order))
    );
  }

  /**
   * Admin: Confirm Order
   * PATCH /admin/orders/{id}/confirm
   */
  adminConfirmOrder(id: number | string): Observable<Order> {
    const orderId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CONFIRM(orderId), {}).pipe(
      map(order => this.mapBackendToFrontend(order)),
      catchError((err: any) => {
        console.error('Admin Confirm Order Failed. Status:', err.status);
        console.error('Error Body:', err.error);
        throw err;
      })
    );
  }

  /**
   * Admin: Cancel Order
   * PATCH /admin/orders/{id}/cancel
   */
  adminCancelOrder(id: number | string): Observable<Order> {
    const orderId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CANCEL(orderId), {}).pipe(
      map(order => this.mapBackendToFrontend(order))
    );
  }

  /**
   * Create Payment for an Order
   * POST /orders/{order_id}/payments
   */
  createPayment(orderId: number | string, paymentData: PaymentCreate): Observable<any> {
    const id = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.CREATE(id), paymentData);
  }

  /**
   * Confirm Payment for an Order
   * PATCH /orders/{order_id}/payments/{payment_id}/confirm
   */
  confirmPayment(orderId: number | string, paymentId: number | string, confirmData: PaymentConfirm): Observable<any> {
    const oId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
    const pId = typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
    return this.apiService.patch<any>(API_ENDPOINTS.PAYMENTS.CONFIRM(oId, pId), confirmData);
  }

  /**
   * Submit Transaction ID (bKash flow)
   * POST /orders/{order_id}/payment/submit
   */
  submitTrx(orderId: number | string, data: any): Observable<any> {
    const id = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.SUBMIT_TRX(id), data);
  }

  /**
   * Submit COD Selection (Auto-confirm flow)
   * POST /orders/{order_id}/payment/submit
   */
  submitCOD(orderId: number | string): Observable<any> {
    const id = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.SUBMIT_TRX(id), {
      transaction_id: 'COD_AUTO_CONFIRMED',
      sender_phone: 'COD'
    });
  }

  /**
   * Update order status
   */
  updateOrderStatus(id: string, status: 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled'): Observable<void> {
    const orderId = parseInt(id, 10);

    if (status === 'Cancelled') {
      // Use Admin Cancel endpoint
      return this.adminCancelOrder(orderId).pipe(map(() => void 0));
    } else if (status === 'Confirmed') {
      // Use Admin Confirm endpoint
      return this.adminConfirmOrder(orderId).pipe(map(() => void 0));
    }

    // For other statuses, we'd need additional backend endpoints
    console.warn(`Status update to ${status} not supported by backend yet`);
    return new Observable<void>(observer => {
      observer.next();
      observer.complete();
    });
  }

  /**
   * Update payment info
   * Note: Backend has separate payment endpoints
   */
  updateOrderPayment(id: string, method: 'COD' | 'bKash', status: 'Pending' | 'Paid'): Observable<void> {
    console.warn('Payment update should use payment endpoints');
    return new Observable<void>(observer => {
      observer.next();
      observer.complete();
    });
  }

  /**
   * Notify admin of new order
   */
  notifyAdmin(orderId: string): void {
    this.newOrderSubject.next(orderId);
  }

  /**
   * Map frontend order format to backend format
   */
  private mapFrontendToBackend(order: Omit<Order, 'id'>): any {
    const payload = {
      address: {
        full_name: order.fullName,
        phone: order.phoneNumber,
        district: order.district,
        subdistrict: order.subDistrict || '',
        address_line: order.fullAddress,
        additional_info: order.additionalInfo || '' // Schema requires string, null causes 422
      },
      items: order.items.map(item => ({
        product_id: typeof item.product.id === 'string' ? parseInt(item.product.id, 10) : item.product.id,
        quantity: item.quantity
      })),
      // strictly use lowercase 'bkash'
      payment_method: order.paymentMethod ? (order.paymentMethod.toLowerCase() === 'bkash' ? 'bkash' : order.paymentMethod) : null
    };

    console.log('Final Order Payload:', JSON.stringify(payload, null, 2));
    return payload;
  }

  /**
   * Map backend order format to frontend format
   */
  private mapBackendToFrontend(backendOrder: any): Order {
    // Robust payment method extraction
    let paymentMethod = null; // Default to null instead of 'COD'
    if (backendOrder.payment_method) {
      paymentMethod = backendOrder.payment_method;
    } else if (backendOrder.payment && backendOrder.payment.payment_method) {
      paymentMethod = backendOrder.payment.payment_method;
    } else if (backendOrder.paymentMethod) {
      paymentMethod = backendOrder.paymentMethod;
    }

    // Robust payment status extraction
    let rawPaymentStatus: string | undefined;
    if (backendOrder.payment_status) {
      rawPaymentStatus = backendOrder.payment_status;
    } else if (backendOrder.payment && backendOrder.payment.status) {
      rawPaymentStatus = backendOrder.payment.status;
    } else if (backendOrder.paymentStatus) {
      rawPaymentStatus = backendOrder.paymentStatus;
    }

    let paymentStatus = 'Pending'; // Default
    if (rawPaymentStatus) {
      const statusLower = rawPaymentStatus.toLowerCase().trim();
      if (['paid', 'completed', 'complete', 'verified', 'success', 'confirmed'].includes(statusLower)) {
        paymentStatus = 'Paid';
      } else {
        // Capitalize first letter for others (e.g., 'cod confirmed' -> 'Cod confirmed', later fixed in UI?)
        // Actually, let's preserve 'COD Confirmed' casing if possible or Title Case it.
        // Simple capitalization:
        paymentStatus = rawPaymentStatus.charAt(0).toUpperCase() + rawPaymentStatus.slice(1);
      }
    }

    // Extract transaction ID
    let transactionId = undefined;
    if (backendOrder.payment && backendOrder.payment.transaction_id) {
      transactionId = backendOrder.payment.transaction_id;
    } else if (backendOrder.transaction_id) {
      transactionId = backendOrder.transaction_id;
    }

    return {
      id: backendOrder.id?.toString() || '',
      fullName: backendOrder.address?.full_name || '',
      email: backendOrder.address?.email || '',
      phoneNumber: backendOrder.address?.phone || '',
      district: backendOrder.address?.district || '',
      subDistrict: backendOrder.address?.subdistrict || '',
      postalCode: backendOrder.address?.postal_code || backendOrder.address?.additional_info || '',
      fullAddress: backendOrder.address?.address_line || '',
      additionalInfo: backendOrder.address?.additional_info || '',
      items: backendOrder.items?.map((item: any) => ({
        product: {
          id: item.product_id?.toString() || '',
          name: '', // We'd need to fetch product details separately
          price: item.price_at_purchase || 0,
          code: '',
          description: '',
          imageUrl: ''
        },
        quantity: item.quantity
      })) || [],
      totalAmount: this.calculateTotal(backendOrder.items || []),
      status: this.mapBackendStatus(backendOrder.status),
      paymentMethod: paymentMethod as 'COD' | 'bKash' | null, // Allow null
      paymentStatus: paymentStatus as 'Pending' | 'Paid',
      paymentId: backendOrder.payment_id || (backendOrder.payment ? backendOrder.payment.id : undefined),
      transactionId: transactionId,
      orderDate: new Date(backendOrder.created_at || Date.now())
    };
  }

  /**
   * Calculate total from order items
   */
  private calculateTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + (item.price_at_purchase * item.quantity), 0);
  }

  /**
   * Map backend status to frontend status
   */
  private mapBackendStatus(status: string): 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled' {
    const statusMap: Record<string, any> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'shipping': 'Shipping',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return statusMap[status?.toLowerCase()] || 'Pending';
  }
}
