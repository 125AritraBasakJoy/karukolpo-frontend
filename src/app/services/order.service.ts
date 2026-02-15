import { Injectable } from '@angular/core';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
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
  private ordersCache: Order[] | null = null;

  constructor(private apiService: ApiService) { }

  /**
   * Clear orders cache
   */
  clearCache() {
    this.ordersCache = null;
  }

  /**
   * Create new order
   * POST /orders
   */
  createOrder(order: Omit<Order, 'id'>): Observable<string> {
    const backendOrder = this.mapFrontendToBackend(order);
    return this.apiService.post<any>(API_ENDPOINTS.ORDERS.CREATE, backendOrder).pipe(
      tap({
        next: () => this.clearCache(), // Invalidate cache on new order
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
   * Note: Fetches details for each order to ensure accurate status
   */
  getOrders(skip = 0, limit = 100, forceRefresh = false): Observable<Order[]> {
    if (!forceRefresh && this.ordersCache && skip === 0) {
      return of(this.ordersCache);
    }

    const query = buildListQuery(skip, limit);
    return this.apiService.get<any>(`${API_ENDPOINTS.ORDERS.LIST}${query}`).pipe(
      map(response => {
        // Handle direct array or wrapped object { data: [], orders: [], etc }
        let rawOrders: any[] = [];
        if (Array.isArray(response)) {
          rawOrders = response;
        } else if (response && typeof response === 'object') {
          rawOrders = response.data || response.orders || response.results || [];
        }

        if (!rawOrders || rawOrders.length === 0) {
          return [];
        }
        return rawOrders.map(order => this.mapBackendToFrontend(order));
      }),
      tap(orders => {
        if (skip === 0) {
          this.ordersCache = orders;
        }
      }),
      catchError(err => {
        console.error('Failed to fetch orders:', err);
        throw err;
      })
    );
  }

  /**
   * Reload orders (alias for getOrders)
   */
  reloadOrders(): Observable<Order[]> {
    return this.getOrders(0, 100, true);
  }

  /**
   * Get order by ID
   * GET /orders/{id}
   */
  getOrderById(id: number | string): Observable<Order | undefined> {
    // Use ID as is
    const orderId = id;

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
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.CANCEL(id), {}).pipe(
      tap(() => {
        this.clearCache();
        this.notifyAdmin(id.toString());
      }),
      map(order => this.mapBackendToFrontend(order))
    );
  }

  /**
   * Admin: Confirm Order
   * PATCH /admin/orders/{id}/confirm
   */
  adminConfirmOrder(id: number | string): Observable<Order> {
    // Use the specific admin confirm endpoint as requested
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CONFIRM(id), { status: 'confirmed' }).pipe(
      tap(() => this.clearCache()),
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
   * Uses PATCH /admin/orders/{id}/cancel
   * Using admin endpoint to allow cancelling confirmed orders (which customer endpoint rejects with 400)
   */
  adminCancelOrder(id: number | string): Observable<Order> {
    // Try admin cancel endpoint first
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CANCEL(id), {}).pipe(
      tap(() => this.clearCache()),
      map(order => this.mapBackendToFrontend(order)),
      catchError((err: any) => {
        console.warn('Admin Cancel Order Failed. Trying Customer Cancel Endpoint as fallback.', err);
        // Fallback to customer cancel endpoint
        return this.cancelOrder(id);
      })
    );
  }

  /**
   * Admin: Complete Order
   * Uses PATCH /admin/orders/{id} with status: 'completed'
   * Since /confirm endpoint only accepts pending orders
   */
  adminCompleteOrder(id: number | string): Observable<Order> {
    // Use the specific admin complete endpoint
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_COMPLETE(id), { status: 'completed' }).pipe(
      tap(() => this.clearCache()),
      map(order => this.mapBackendToFrontend(order)),
      catchError((err: any) => {
        console.error('Admin Complete Order Failed. Status:', err.status);
        console.error('Error Body:', err.error);
        throw err;
      })
    );
  }

  /**
   * Create Payment for an Order
   * POST /orders/{order_id}/payments
   */
  createPayment(orderId: number | string, paymentData: PaymentCreate): Observable<any> {
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.CREATE(orderId), paymentData).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Confirm Payment for an Order
   * PATCH /orders/{order_id}/payments/{payment_id}/confirm
   */
  confirmPayment(orderId: number | string, paymentId: number | string, confirmData: PaymentConfirm): Observable<any> {
    return this.apiService.patch<any>(API_ENDPOINTS.PAYMENTS.CONFIRM(orderId, paymentId), confirmData).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Submit Transaction ID (bKash flow)
   * POST /orders/{order_id}/payment/submit
   */
  submitTrx(orderId: number | string, data: any): Observable<any> {
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.SUBMIT_TRX(orderId), data).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Submit COD Selection (Auto-confirm flow)
   * POST /orders/{order_id}/payment/submit
   */
  submitCOD(orderId: number | string): Observable<any> {
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.SUBMIT_TRX(orderId), {
      transaction_id: 'COD_AUTO_CONFIRMED',
      sender_phone: 'COD'
    }).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Update order status
   * Uses specific endpoints for Confirmed/Cancelled/Completed
   */
  updateOrderStatus(id: string, status: 'Confirmed' | 'Cancelled' | 'Completed'): Observable<void> {
    // Pass ID directly, do not parse
    if (status === 'Confirmed') {
      return this.adminConfirmOrder(id).pipe(map(() => void 0));
    } else if (status === 'Cancelled') {
      return this.adminCancelOrder(id).pipe(map(() => void 0));
    } else if (status === 'Completed') {
      return this.adminCompleteOrder(id).pipe(map(() => void 0));
    }

    // Fallback for unexpected statuses
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
        product_id: item.product.id,
        quantity: item.quantity
      })),
      // strictly use lowercase 'bkash'
      payment_method: order.paymentMethod ? (order.paymentMethod.toLowerCase() === 'bkash' ? 'bkash' : order.paymentMethod) : null,
      payment_status: order.paymentStatus ? order.paymentStatus : 'Pending'
    };


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

    // Check payments (plural) first as it seems to be the new structure
    if (backendOrder.payments && backendOrder.payments.status) {
      rawPaymentStatus = backendOrder.payments.status;
    } else if (backendOrder.payment && backendOrder.payment.status) { // Prioritize nested payment object status
      rawPaymentStatus = backendOrder.payment.status;
    } else if (backendOrder.payment_status) {
      rawPaymentStatus = backendOrder.payment_status;
    } else if (backendOrder.paymentStatus) {
      rawPaymentStatus = backendOrder.paymentStatus;
    }

    let paymentStatus = 'Pending'; // Default
    if (rawPaymentStatus) {
      // Do not hardcode "Paid" mapping. Use the backend status directly.
      // Just capitalize the first letter for display.
      const statusLower = rawPaymentStatus.toLowerCase().trim();
      paymentStatus = rawPaymentStatus.charAt(0).toUpperCase() + rawPaymentStatus.slice(1);
    }

    // Force COD Confirmed if method is COD and status is Pending (Backend doesn't handle COD auto-confirm)
    if (paymentMethod && paymentMethod.toLowerCase() === 'cod' && paymentStatus === 'Pending') {
      paymentStatus = 'COD Confirmed';
    }

    // Map backend status first
    const orderStatus = this.mapBackendStatus(backendOrder.status);

    // Removed hardcoded bKash mapping to allow backend to dictate status text
    // The backend should return 'Bkash Confirmed' or similar if that's the desired status.

    // Extract transaction ID with robust checks
    let transactionId = undefined;

    // Check nested payment object first
    if (backendOrder.payment) {
      if (backendOrder.payment.transaction_id) {
        transactionId = backendOrder.payment.transaction_id;
      } else if (backendOrder.payment.trx_id) {
        transactionId = backendOrder.payment.trx_id;
      } else if (backendOrder.payment.bkash_trx_id) {
        transactionId = backendOrder.payment.bkash_trx_id;
      }
    }

    // Fallback to root object if not found in payment object
    if (!transactionId) {
      if (backendOrder.transaction_id) {
        transactionId = backendOrder.transaction_id;
      } else if (backendOrder.trx_id) {
        transactionId = backendOrder.trx_id;
      } else if (backendOrder.bkash_trx_id) {
        transactionId = backendOrder.bkash_trx_id;
      }
    }

    // Handle created_at timestamp
    let orderDate = new Date();
    if (backendOrder.created_at) {
      let dateStr = backendOrder.created_at;
      // If the string doesn't end with Z and doesn't have an offset, append Z to treat as UTC
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
        dateStr += 'Z';
      }
      orderDate = new Date(dateStr);
    }

    return {
      id: (backendOrder.id !== undefined && backendOrder.id !== null) ? backendOrder.id.toString() : '',
      fullName: backendOrder.address?.full_name || backendOrder.fullName || '',
      email: backendOrder.address?.email || backendOrder.email || '',
      phoneNumber: backendOrder.address?.phone || backendOrder.phoneNumber || backendOrder.phone || '',
      district: backendOrder.address?.district || backendOrder.district || '',
      subDistrict: backendOrder.address?.subdistrict || backendOrder.subDistrict || '',
      postalCode: backendOrder.address?.postal_code || backendOrder.address?.additional_info || backendOrder.postalCode || '',
      fullAddress: backendOrder.address?.address_line || backendOrder.fullAddress || backendOrder.address || '',
      additionalInfo: backendOrder.address?.additional_info || backendOrder.additionalInfo || '',
      items: (backendOrder.items || []).map((item: any) => ({
        product: {
          id: (item.product_id !== undefined && item.product_id !== null) ? item.product_id.toString() : (item.product?.id?.toString() || ''),
          name: item.product?.name || item.name || '',
          price: (item.price_at_purchase !== undefined && item.price_at_purchase !== null) ? item.price_at_purchase : (item.price || 0),
          code: item.product?.code || item.code || '',
          description: item.product?.description || '',
          imageUrl: item.product?.imageUrl || item.product?.image_url || item.imageUrl || ''
        },
        quantity: item.quantity || 0
      })),
      totalAmount: backendOrder.total != null ? parseFloat(backendOrder.total) :
        (backendOrder.total_amount != null ? parseFloat(backendOrder.total_amount) :
          (backendOrder.totalAmount != null ? parseFloat(backendOrder.totalAmount) :
            this.calculateTotal(backendOrder.items || []))),
      subtotal: backendOrder.subtotal != null ? parseFloat(backendOrder.subtotal) : undefined,
      deliveryCharge: backendOrder.delivery_charge != null ? parseFloat(backendOrder.delivery_charge) :
        (backendOrder.deliveryCharge != null ? parseFloat(backendOrder.deliveryCharge) : 0),
      discountAmount: backendOrder.discount_amount != null ? parseFloat(backendOrder.discount_amount) :
        (backendOrder.discountAmount != null ? parseFloat(backendOrder.discountAmount) : 0),
      couponCode: backendOrder.coupon_code || backendOrder.couponCode || undefined,
      status: orderStatus,
      paymentMethod: paymentMethod as 'COD' | 'bKash' | null,
      paymentStatus: paymentStatus as 'Pending' | 'Paid',
      paymentId: (backendOrder.payment_id !== undefined && backendOrder.payment_id !== null) ? backendOrder.payment_id :
        (backendOrder.payment?.id !== undefined && backendOrder.payment?.id !== null) ? backendOrder.payment.id : undefined,
      transactionId: transactionId,
      bkashNumber: backendOrder.sender_phone || backendOrder.payment?.sender_phone || backendOrder.bkashNumber,
      orderDate: orderDate,

      // Pass through raw objects for detailed display
      address: backendOrder.address,
      payments: backendOrder.payments || backendOrder.payment,
      created_at: backendOrder.created_at
    };
  }

  /**
   * Calculate total from order items
   */
  private calculateTotal(items: any[]): number {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const price = (item.price_at_purchase !== undefined && item.price_at_purchase !== null) ? item.price_at_purchase : (item.price || 0);
      const quantity = item.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }

  /**
   * Map backend status to frontend status
   */
  private mapBackendStatus(status: string): 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled' | 'Completed' {
    const statusMap: Record<string, any> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'cod_confirmed': 'Confirmed', // Map cod_confirmed to Confirmed
      'cod_processing': 'Confirmed', // Map cod_processing to Confirmed
      'paid': 'Confirmed', // Map paid to Confirmed (if order status is paid, it's confirmed)
      'shipping': 'Shipping',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'completed': 'Completed'
    };
    return statusMap[status?.toLowerCase()] || 'Pending';
  }
}
