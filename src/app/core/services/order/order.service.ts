import { Injectable } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Order, OrderAdminUpdate, OrderEditResult } from '../../../models/order.model';
import { PaymentStatus } from '../../../models/payment.model';
import { ApiService } from '../api/api.service';
import { ORDERS_API } from './order.api';
import { PAYMENTS_API } from '../payment/payment.api';

const API_ENDPOINTS = {
  ORDERS: ORDERS_API,
  PAYMENTS: PAYMENTS_API
} as const;

export interface PaymentCreate {
  payment_method: string;
  amount: number;
  transaction_id?: string;
}

export type OrderNotificationType = 'new' | 'update' | 'cancel';

export interface OrderNotification {
  id: string;
  type: OrderNotificationType;
}

export interface PaymentConfirm {
  transaction_id: string;
  gateway_response?: any;
}

export interface OrderQueryOptions {
  skip?: number;
  limit?: number;
  status?: string;
  channel?: 'all' | 'online' | 'offline' | string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}

export interface OrdersResponse {
  items: Order[];
  total: number;
}

/**
 * OrderService - Backend API Integration
 * URL configured in src/environments/environment.ts
 */
@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private newOrderSubject = new Subject<OrderNotification>();
  newOrderNotification$ = this.newOrderSubject.asObservable();

  constructor(private apiService: ApiService) { }

  /**
   * Clear orders cache (kept for backwards-compatibility)
   */
  clearCache() {
    // No-op: cache removed to avoid stale limits/queries
  }

  buildOrderQueryParams(options: OrderQueryOptions = {}): string {
    const params = new URLSearchParams();
    if (options.skip !== undefined && options.skip !== null) {
      params.append('skip', options.skip.toString());
    }
    if (options.limit !== undefined && options.limit !== null) {
      params.append('limit', options.limit.toString());
    }
    if (options.status && options.status.trim()) {
      params.append('status', options.status.trim());
    }
    if (options.channel && options.channel.trim()) {
      params.append('channel', options.channel.trim());
    }
    if (options.paymentMethod && options.paymentMethod.trim()) {
      params.append('payment_method', options.paymentMethod.trim());
    }
    if (options.dateFrom && options.dateFrom.trim()) {
      params.append('date_from', options.dateFrom.trim());
    }
    if (options.dateTo && options.dateTo.trim()) {
      params.append('date_to', options.dateTo.trim());
    }
    if (options.q && options.q.trim()) {
      params.append('q', options.q.trim());
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Create new order
   * POST /orders
   */
  createOrder(order: Omit<Order, 'id'>, idempotencyKey?: string): Observable<Order> {
    const backendOrder = this.mapFrontendToBackend(order);
    const options = idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined;
    return this.apiService.post<any>(API_ENDPOINTS.ORDERS.CREATE, backendOrder, options).pipe(
      tap({
        error: (err) => console.error('Order creation failed:', err)
      }),
      map(response => {
        const mappedOrder = this.mapBackendOrder(response);
        this.notifyAdmin(mappedOrder.id || '', 'new');
        return mappedOrder;
      })
    );
  }

  /**
   * Get orders with total count from X-Total-Count header.
   */
  getOrdersWithCount(options: OrderQueryOptions = {}): Observable<OrdersResponse> {
    const qs = this.buildOrderQueryParams(options);
    return this.apiService.getResponse<any[]>(`${API_ENDPOINTS.ORDERS.LIST}${qs}`).pipe(
      map(res => {
        const rawOrders = Array.isArray(res.body) ? res.body : [];
        const items = rawOrders.map(order => this.mapBackendOrder(order));
        const totalHeader = res.headers.get('x-total-count') || res.headers.get('X-Total-Count');
        const total = totalHeader ? parseInt(totalHeader, 10) : items.length;
        return { items, total };
      }),
      catchError(err => {
        console.error('Failed to fetch orders:', err);
        throw err;
      })
    );
  }

  /**
   * Get all orders
   * GET /orders
   */
  getOrders(
    optionsOrSkip: OrderQueryOptions | number = 0,
    limit = 100,
    forceRefresh = false
  ): Observable<Order[]> {
    if (typeof optionsOrSkip === 'object') {
      return this.getOrdersWithCount(optionsOrSkip).pipe(map(res => res.items));
    }
    return this.getOrdersWithCount({ skip: optionsOrSkip, limit }).pipe(map(res => res.items));
  }

  /**
   * Reload orders
   */
  reloadOrders(): Observable<Order[]> {
    return this.getOrders(0, 100, true);
  }

  /**
   * Export all orders matching filters as streaming CSV
   * GET /orders/export.csv
   */
  exportOrdersCsv(filters: OrderQueryOptions = {}): Observable<Blob> {
    const { skip, limit, ...filterOpts } = filters;
    const qs = this.buildOrderQueryParams(filterOpts);
    return this.apiService.getBlob(`${API_ENDPOINTS.ORDERS.EXPORT_CSV}${qs}`).pipe(
      map(res => {
        if (!res.body) {
          throw new Error('Empty CSV response');
        }
        return res.body;
      })
    );
  }

  /**
   * Get order by ID
   * GET /orders/{id}
   */
  getOrderById(id: number | string): Observable<Order | undefined> {
    return this.apiService.get<any>(API_ENDPOINTS.ORDERS.GET_BY_ID(id)).pipe(
      map(order => this.mapBackendOrder(order)),
      catchError(err => {
        console.error(`Failed to load order ${id}`, err);
        return of(undefined);
      })
    );
  }

  /**
   * Find order by phone using server-side query
   */
  getOrderByPhone(phone: string): Observable<Order | undefined> {
    return this.getOrdersWithCount({ q: phone.trim(), limit: 20 }).pipe(
      map(res => {
        const matches = res.items.filter(o => o.phoneNumber === phone || o.phoneNumber.includes(phone.trim()));
        return matches.length > 0 ? matches[0] : res.items[0];
      })
    );
  }

  /**
   * Normalize phone number to 11 digits (01XXXXXXXXX)
   */
  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    let norm = cleaned;
    if (norm.startsWith('88')) {
      norm = norm.substring(2);
    }
    if (!norm.startsWith('0') && norm.length === 10) {
      norm = '0' + norm;
    }
    return norm;
  }

  /**
   * Track orders by phone number
   * GET /orders/track?phone={phone}
   */
  trackOrdersByPhone(phone: string): Observable<Order[]> {
    const norm = this.normalizePhone(phone);
    return this.apiService.get<any[]>(API_ENDPOINTS.ORDERS.TRACK_BY_PHONE(norm)).pipe(
      map(orders => (orders || []).map(order => this.mapBackendOrder(order)))
    );
  }

  /**
   * Track orders by human-readable order number
   * GET /orders/track?order_number={order_number}
   */
  trackOrdersByOrderNumber(orderNumber: string): Observable<Order[]> {
    return this.apiService.get<any[]>(API_ENDPOINTS.ORDERS.TRACK_BY_ORDER_NUMBER(orderNumber.trim())).pipe(
      map(orders => (orders || []).map(order => this.mapBackendOrder(order)))
    );
  }

  /**
   * Smart order search for Admin:
   * Uses indexed GET /orders?q= to return full admin rows
   */
  searchAdminOrders(query: string): Observable<Order[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return of([]);
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      return this.getOrderById(trimmed).pipe(
        map(order => order ? [order] : []),
        catchError(() => of([]))
      );
    }

    return this.getOrdersWithCount({ q: trimmed, limit: 100 }).pipe(
      map(res => res.items),
      catchError(err => {
        console.error('searchAdminOrders failed:', err);
        return of([]);
      })
    );
  }

  /**
   * Track order by human-readable order number
   * GET /orders/order-number/{order_number}
   */
  trackOrderByNumber(orderNumber: string, phone?: string): Observable<Order> {
    const cleanNo = (orderNumber || '').trim().replace(/^#/, '');
    let url = API_ENDPOINTS.ORDERS.TRACK_BY_NUMBER(cleanNo);
    if (phone) {
      url += `?phone=${encodeURIComponent(phone.trim())}`;
    }
    return this.apiService.get<any>(url).pipe(
      map(order => this.mapBackendOrder(order))
    );
  }

  /**
   * Cancel an order (Customer/Public endpoint)
   * PATCH /orders/{id}/cancel?phone={phone}
   */
  cancelOrder(id: number | string, phone?: string, data?: any): Observable<Order> {
    let url = API_ENDPOINTS.ORDERS.CANCEL(id);
    if (phone) {
      url += `?phone=${encodeURIComponent(phone)}`;
    }
    const body = data || null;
    return this.apiService.patch<any>(url, body).pipe(
      tap(() => {
        this.notifyAdmin(id.toString(), 'cancel');
      }),
      map(order => this.mapBackendOrder(order))
    );
  }

  /**
   * Admin: Confirm Order
   * PATCH /admin/orders/{id}/confirm
   */
  adminConfirmOrder(id: number | string): Observable<any> {
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CONFIRM(id), {}).pipe(
      tap(() => this.notifyAdmin(id.toString(), 'update'))
    );
  }

  /**
   * Admin: Cancel Order
   * PATCH /admin/orders/{id}/cancel { "reason": "..." }
   */
  adminCancelOrder(id: number | string, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_CANCEL(id), body).pipe(
      tap(() => this.notifyAdmin(id.toString(), 'cancel'))
    );
  }

  /**
   * Admin: Complete Order (Mark Delivered)
   * PATCH /admin/orders/{id}/complete { "collected_via": "..." }
   */
  adminCompleteOrder(id: number | string, collectedVia?: string): Observable<any> {
    const body = collectedVia ? { collected_via: collectedVia } : {};
    return this.apiService.patch<any>(API_ENDPOINTS.ORDERS.ADMIN_COMPLETE(id), body).pipe(
      tap(() => this.notifyAdmin(id.toString(), 'update'))
    );
  }

  /**
   * Admin: Edit an Online Order
   * PATCH /admin/orders/{id}?dry_run=true|false
   */
  editOrder(id: number | string, update: OrderAdminUpdate, dryRun: boolean = false): Observable<OrderEditResult> {
    return this.apiService.patch<OrderEditResult>(API_ENDPOINTS.ORDERS.ADMIN_EDIT(id, dryRun), update).pipe(
      tap(() => {
        if (!dryRun) {
          this.notifyAdmin(id.toString(), 'update');
        }
      })
    );
  }

  /**
   * Create Payment for an Order
   * POST /orders/{order_id}/payments
   */
  createPayment(orderId: number | string, paymentData: PaymentCreate): Observable<any> {
    return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.CREATE(orderId), paymentData);
  }

  /**
   * Confirm Payment for an Order
   * PATCH /orders/{order_id}/payments/{payment_id}/confirm
   */
  confirmPayment(orderId: number | string, paymentId: number | string, confirmData: PaymentConfirm): Observable<any> {
    return this.apiService.patch<any>(API_ENDPOINTS.PAYMENTS.CONFIRM(orderId, paymentId), confirmData);
  }

  /**
   * Submit Transaction ID (bKash flow)
   * POST /orders/{order_id}/payment/submit
   */
  submitTrx(orderId: number | string, data: any, phone: string): Observable<any> {
    const url = `${API_ENDPOINTS.PAYMENTS.SUBMIT_TRX(orderId)}?phone=${encodeURIComponent(phone)}`;
    return this.apiService.post<any>(url, data);
  }

  updateOrderStatus(id: string, status: 'Confirmed' | 'Cancelled' | 'Completed', reason?: string, collectedVia?: string): Observable<void> {
    let updateObs: Observable<any>;

    if (status === 'Confirmed') {
      updateObs = this.adminConfirmOrder(id);
    } else if (status === 'Cancelled') {
      updateObs = this.adminCancelOrder(id, reason);
    } else if (status === 'Completed') {
      updateObs = this.adminCompleteOrder(id, collectedVia);
    } else {
      return of(void 0);
    }

    return updateObs.pipe(
      map(() => void 0)
    );
  }

  /**
   * Notify admin of order event
   */
  notifyAdmin(orderId: string, type: OrderNotificationType): void {
    this.newOrderSubject.next({ id: orderId, type });
  }

  /**
   * Map frontend order format to backend format
   */
  private mapFrontendToBackend(order: Omit<Order, 'id'>): any {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const payload = {
      address: {
        full_name: order.fullName,
        phone: order.phoneNumber,
        district: order.district,
        subdistrict: order.subDistrict || '',
        address_line: order.fullAddress,
        additional_info: order.additionalInfo || '',
        email: order.email ? order.email : null
      },
      items: order.items.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      })),
      payment_method: order.paymentMethod ? (order.paymentMethod.toLowerCase() === 'bkash' ? 'bkash' : order.paymentMethod) : null,
      payment_status: order.payment_status || order.paymentStatus || 'unpaid',
      utm_source: urlParams ? urlParams.get('utm_source') : null,
      utm_medium: urlParams ? urlParams.get('utm_medium') : null,
      utm_campaign: urlParams ? urlParams.get('utm_campaign') : null,
      referrer: typeof window !== 'undefined' ? (document.referrer || null) : null
    };

    return payload;
  }

  /**
   * Map backend order format to frontend format
   */
  mapBackendOrder(backendOrder: any): Order {
    let paymentMethod = null;
    if (backendOrder.payment_method) {
      paymentMethod = backendOrder.payment_method;
    } else if (backendOrder.payment && backendOrder.payment.payment_method) {
      paymentMethod = backendOrder.payment.payment_method;
    } else if (backendOrder.payments && backendOrder.payments.payment_method) {
      paymentMethod = backendOrder.payments.payment_method;
    } else if (backendOrder.paymentMethod) {
      paymentMethod = backendOrder.paymentMethod;
    }

    // Root payment_status is authoritative from backend
    const rawPaymentStatus: PaymentStatus = (
      backendOrder.payment_status ||
      (backendOrder.payments?.status === 'verified' ? 'paid' : 'unpaid')
    ).toLowerCase().trim() as PaymentStatus;

    const amountPaid = backendOrder.amount_paid != null ? parseFloat(backendOrder.amount_paid) : 0;
    const amountRefunded = backendOrder.amount_refunded != null ? parseFloat(backendOrder.amount_refunded) : 0;
    const amountDue = backendOrder.amount_due != null ? parseFloat(backendOrder.amount_due) : 0;

    const orderStatus = this.mapBackendStatus(backendOrder.status);

    let transactionId = undefined;
    const p = backendOrder.payments || backendOrder.payment;
    if (p) {
      transactionId = p.transaction_id || p.trx_id || p.bkash_trx_id || p.transactionId;
    }
    if (!transactionId) {
      transactionId = backendOrder.transaction_id || backendOrder.trx_id || backendOrder.bkash_trx_id || backendOrder.transactionId;
    }

    let orderDate = new Date();
    if (backendOrder.created_at) {
      let dateStr = backendOrder.created_at;
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
        dateStr += 'Z';
      }
      orderDate = new Date(dateStr);
    }

    return {
      id: (backendOrder.id !== undefined && backendOrder.id !== null) ? backendOrder.id.toString() : '',
      orderNumber: backendOrder.order_number || '',
      fullName: backendOrder.address?.full_name || backendOrder.fullName || '',
      email: backendOrder.address?.email || backendOrder.email || '',
      phoneNumber: backendOrder.address?.phone || backendOrder.phoneNumber || backendOrder.phone || '',
      district: backendOrder.address?.district || backendOrder.district || '',
      subDistrict: backendOrder.address?.subdistrict || backendOrder.address?.subDistrict || backendOrder.subDistrict || '',
      postalCode: backendOrder.address?.postal_code || backendOrder.address?.postalCode || backendOrder.postalCode || '',
      fullAddress: backendOrder.address?.address_line || backendOrder.address?.address || backendOrder.fullAddress || (typeof backendOrder.address === 'string' ? backendOrder.address : '') || '',
      additionalInfo: backendOrder.address?.additional_info || backendOrder.address?.additionalInfo || backendOrder.additionalInfo || '',
      items: (backendOrder.items || []).map((item: any) => {
        const grossPrice = (item.price_at_purchase !== undefined && item.price_at_purchase !== null)
          ? parseFloat(item.price_at_purchase)
          : ((item.regular_price !== undefined && item.regular_price !== null)
            ? parseFloat(item.regular_price)
            : (item.product?.price !== undefined && item.product?.price !== null
              ? parseFloat(item.product.price)
              : (item.price ? parseFloat(item.price) : 0)));

        const unitDiscount = (item.discount_per_unit !== undefined && item.discount_per_unit !== null)
          ? parseFloat(item.discount_per_unit)
          : (item.discount !== undefined && item.discount !== null ? parseFloat(item.discount) : 0);

        const itemPrice = (item.unit_price !== undefined && item.unit_price !== null)
          ? parseFloat(item.unit_price)
          : ((item.price_at_purchase !== undefined && item.price_at_purchase !== null)
            ? Math.max(0, Math.round((grossPrice - unitDiscount) * 100) / 100)
            : (item.price ? parseFloat(item.price) : 0));

        const rawProduct = item.product || {};
        const catalogPrice = (rawProduct.price !== undefined && rawProduct.price !== null)
          ? parseFloat(rawProduct.price)
          : ((item.regular_price !== undefined && item.regular_price !== null)
            ? parseFloat(item.regular_price)
            : (grossPrice > 0 ? grossPrice : itemPrice));

        const effectivePrice = (rawProduct.effective_price !== undefined && rawProduct.effective_price !== null)
          ? parseFloat(rawProduct.effective_price)
          : ((item.effective_price !== undefined && item.effective_price !== null)
            ? parseFloat(item.effective_price)
            : (itemPrice < catalogPrice ? itemPrice : undefined));

        return {
          ...item,
          product: {
            ...rawProduct,
            id: (item.product_id !== undefined && item.product_id !== null) ? item.product_id.toString() : (rawProduct.id?.toString() || ''),
            name: rawProduct.name || item.name || '',
            price: catalogPrice,
            effective_price: effectivePrice,
            discount_type: rawProduct.discount_type || item.discount_type || null,
            discount_value: rawProduct.discount_value ?? item.discount_value ?? null,
            code: rawProduct.code || item.code || '',
            description: rawProduct.description || '',
            imageUrl: rawProduct.imageUrl || rawProduct.image_url || item.imageUrl || ''
          },
          quantity: item.quantity || 0,
          unit_price: itemPrice,
          regular_price: catalogPrice,
          price_at_purchase: grossPrice,
          discount_per_unit: unitDiscount,
          unit_cost: (item.unit_cost !== undefined && item.unit_cost !== null) ? parseFloat(item.unit_cost) : undefined,
          product_id: (item.product_id !== undefined && item.product_id !== null) ? item.product_id.toString() : (rawProduct.id?.toString() || '')
        };
      }),
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
      paymentStatus: rawPaymentStatus,
      payment_status: rawPaymentStatus,
      amount_paid: amountPaid,
      amount_refunded: amountRefunded,
      amount_due: amountDue,
      paymentId: (backendOrder.payments?.id || backendOrder.payment?.id || backendOrder.payment_id || '')?.toString() || undefined,
      transactionId: transactionId,
      bkashNumber: backendOrder.payments?.sender_phone || backendOrder.payment?.sender_phone || backendOrder.sender_phone || backendOrder.bkashNumber,
      orderDate: orderDate,

      // Pass through raw objects for detailed display
      address: backendOrder.address,
      payments: backendOrder.payments || backendOrder.payment || null,
      payment_transactions: backendOrder.payment_transactions || [],
      revisions: backendOrder.revisions || [],
      edited_at: backendOrder.edited_at || null,
      edited_by: backendOrder.edited_by || null,
      created_at: backendOrder.created_at,
      channel: backendOrder.channel || 'online',
      note: backendOrder.note || undefined,
      source: backendOrder.source ?? null,
      fulfillment: backendOrder.fulfillment ?? 'delivery',
      rawStatus: backendOrder.status,
      isVoided: !!backendOrder.is_voided,
      completedAt: backendOrder.completed_at ?? null
    };
  }

  private calculateTotal(items: any[]): number {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const gross = (item.price_at_purchase !== undefined && item.price_at_purchase !== null)
        ? parseFloat(item.price_at_purchase)
        : (item.price ? parseFloat(item.price) : 0);
      const discount = (item.discount_per_unit !== undefined && item.discount_per_unit !== null)
        ? parseFloat(item.discount_per_unit)
        : (item.discount !== undefined && item.discount !== null ? parseFloat(item.discount) : 0);
      const price = (item.unit_price !== undefined && item.unit_price !== null)
        ? parseFloat(item.unit_price)
        : ((item.price_at_purchase !== undefined && item.price_at_purchase !== null)
          ? Math.max(0, Math.round((gross - discount) * 100) / 100)
          : (item.price ? parseFloat(item.price) : 0));
      const quantity = item.quantity || 0;
      return sum + (price * quantity);
    }, 0);
  }

  private mapBackendStatus(status: string): 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled' | 'Completed' {
    const statusMap: Record<string, any> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'cod_confirmed': 'Confirmed',
      'cod_processing': 'Confirmed',
      'paid': 'Confirmed',
      'shipping': 'Shipping',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'completed': 'Completed'
    };
    return statusMap[status?.toLowerCase()] || 'Pending';
  }
}
