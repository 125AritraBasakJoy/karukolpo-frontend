import { Component, OnInit, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services';;;
import { ProductService } from '../../../core/services';;;
import { PaymentService } from '../../../core/services';;;
import { Order } from '../../../models/order.model';
import { CartItem } from '../../../models/cart.model';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { NotificationService } from '../../../core/services';;;
import { InvoiceComponent } from '../../../components/invoice/invoice.component';
import { getSavedPageSize, savePageSize, getSavedPageOffset, savePageOffset } from '../../../core/services/api/helpers';

@Component({
  selector: 'app-orders',
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    DialogModule,
    ProgressSpinnerModule,
    SkeletonModule,
    TooltipModule,
    InputTextModule,
    FormsModule,
    ConfirmDialogModule,
    InvoiceComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './orders.component.html',
  standalone: true,
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  @ViewChild('adminInvoice') adminInvoice!: InvoiceComponent;

  // ... signals remain same ...
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  highlightedOrderId = signal<string | null>(null);

  orders = signal<Order[]>([]);
  totalRecords = signal<number>(0); // Initialize to 0, will grow as we fetch
  loading = signal<boolean>(false);
  exportLoading = signal<boolean>(false);
  downloadingOrderId = signal<string | null>(null);
  selectedOrder = signal<Order | null>(null);
  displayOrderDialog = signal(false);
  loadingDetails = signal(false);
  lastOpenedOrderId: string | null = null;
  lastLazyLoadEvent: TableLazyLoadEvent | null = null;

  // Invoice Mapping State
  invoiceOrderData = signal<any>({
    items: [],
    snapshot: {},
    method: '',
    deliveryCharge: 0,
    total: 0,
    discount: 0,
    id: ''
  });

  // Search state
  searchQuery = signal<string>('');
  isSearching = signal<boolean>(false);
  private searchTimeout: any;

  // Dialog item search & filter state
  itemSearchQuery = signal<string>('');

  // Pagination State
  rows: number = 10;
  first: number = 0;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private paymentService: PaymentService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService
  ) { }

  ngOnInit() {
    this.rows = getSavedPageSize('karukolpo_orders_rows', 10);
    this.first = getSavedPageOffset('karukolpo_orders_first', 0);
    this.loadOrders();

    this.activatedRoute.queryParams.subscribe(params => {
      const highlightId = params['highlight'];
      if (highlightId) {
        this.highlightedOrderId.set(highlightId);
        this.openOrderById(highlightId);

        // Clean URL query parameter without triggering full reload or losing state
        setTimeout(() => {
          this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { highlight: null },
            queryParamsHandling: 'merge',
            replaceUrl: true
          });
        }, 1000);
      }
    });
    this.orderService.newOrderNotification$.subscribe(() => {
      this.loadOrders();
    });

    this.notificationService.notificationClicked$.subscribe(notif => {
      if (notif.type === 'order' && notif.data && notif.data.orderId) {
        const orderId = notif.data.orderId.toString();

        // Delegate to openOrderById so the same guard prevents double-open
        // when both the click-subject and the highlight query param fire.
        this.openOrderById(orderId);
      }
    });
  }

  // Data Buffering
  ordersBuffer: Order[] = [];
  readonly BUFFER_SIZE = 100;

  loadOrders(event?: TableLazyLoadEvent) {
    if (this.isSearching()) {
      return; // Table pagination handled by search results
    }
    this.loading.set(true);

    const lazyEvent = event || this.lastLazyLoadEvent || { first: this.first, rows: this.rows };
    this.lastLazyLoadEvent = lazyEvent;

    const first = lazyEvent.first !== undefined ? lazyEvent.first : this.first;
    const rows = lazyEvent.rows || this.rows;

    this.rows = rows;
    this.first = first;
    savePageSize('karukolpo_orders_rows', rows);
    savePageOffset('karukolpo_orders_first', first);

    // Check if we have data in buffer
    let dataMissing = false;
    for (let i = first; i < first + rows; i++) {
      if (!this.ordersBuffer[i]) {
        dataMissing = true;
        break;
      }
    }

    if (!dataMissing) {
      const end = Math.min(first + rows, this.ordersBuffer.length);
      const pageData = this.ordersBuffer.slice(first, end);
      pageData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

      this.orders.set(pageData);
      this.loading.set(false);
      return;
    }

    const chunkStart = Math.floor(first / this.BUFFER_SIZE) * this.BUFFER_SIZE;
    const neededCount = (first - chunkStart) + rows;
    const fetchLimit = Math.max(this.BUFFER_SIZE, neededCount);

    this.orderService.getOrders(chunkStart, fetchLimit).subscribe({
      next: (orders) => {
        // Populate buffer
        orders.forEach((order, index) => {
          this.ordersBuffer[chunkStart + index] = order;
        });

        const currentTotal = chunkStart + orders.length;
        if (orders.length === fetchLimit) {
          this.totalRecords.set(currentTotal + 1);
        } else {
          this.totalRecords.set(currentTotal);
        }

        const end = Math.min(first + rows, this.ordersBuffer.length);
        const pageData = this.ordersBuffer.slice(first, end);

        pageData.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

        this.orders.set(pageData);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading orders in component:', err);
        this.messageService.add({
          life: 2000,
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load orders.'
        });
        this.loading.set(false);
      }
    });
  }

  onSearch(immediate: boolean = false) {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    const query = this.searchQuery().trim();

    if (!query) {
      this.clearSearch();
      return;
    }

    if (!immediate) {
      this.searchTimeout = setTimeout(() => {
        this.performSearch(query);
      }, 500); // 500ms debounce
    } else {
      this.performSearch(query);
    }
  }

  private performSearch(query: string) {
    this.loading.set(true);
    this.isSearching.set(true);

    this.orderService.searchAdminOrders(query).subscribe({
      next: (orders) => {
        this.orders.set(orders || []);
        this.totalRecords.set(orders ? orders.length : 0);
        this.loading.set(false);
        if (!orders || orders.length === 0) {
          this.messageService.add({
            life: 3000,
            severity: 'info',
            summary: 'No Orders Found',
            detail: 'No orders matched the provided phone, order number, or ID.'
          });
        }
      },
      error: (err) => {
        console.error('Admin search failed:', err);
        this.orders.set([]);
        this.totalRecords.set(0);
        this.loading.set(false);
        this.messageService.add({
          life: 3000,
          severity: 'error',
          summary: 'Search Error',
          detail: 'Failed to search orders. Please try again.'
        });
      }
    });
  }

  clearSearch() {
    this.searchQuery.set('');
    this.isSearching.set(false);
    this.refreshOrders();
  }

  refreshOrders() {
    this.orderService.clearCache(); // Clear service-level cache to fetch fresh data from API
    // Clear buffer to force fresh fetch
    this.ordersBuffer = [];
    this.totalRecords.set(0);

    // Reset to first page
    const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
    this.loadOrders(event);
  }

  viewOrder(order: Order) {
    this.itemSearchQuery.set('');
    this.selectedOrder.set(JSON.parse(JSON.stringify(order)));
    this.displayOrderDialog.set(true);
    this.loadingDetails.set(true);

    // Fetch fresh order details from backend to get latest payment info
    this.orderService.getOrderById(order.id!).pipe(
      switchMap((fullOrder: Order | undefined) => {
        const targetOrder = fullOrder || this.selectedOrder()!;
        return this.ensureProductDetails(targetOrder);
      })
    ).subscribe({
      next: (finalOrder: Order) => {
        this.selectedOrder.set(finalOrder);
        this.loadingDetails.set(false);
      },
      error: (err: any) => {
        console.error('Failed to fetch full order details', err);
        // Fallback to existing data if fetch fails
        this.ensureProductDetails(this.selectedOrder()!).subscribe((final: Order) => {
          this.selectedOrder.set(final);
          this.loadingDetails.set(false);
        });
      }
    });
  }

  openOrderById(orderId: string) {
    // Avoid double-open when both the click-subject and the highlight query param fire
    if (this.lastOpenedOrderId === orderId && this.displayOrderDialog()) {
      return;
    }
    this.lastOpenedOrderId = orderId;

    const existingOrder = this.orders().find(o => o.id === orderId || o.orderNumber === orderId);
    if (existingOrder) {
      this.viewOrder(existingOrder);
    } else {
      this.loadingDetails.set(true);
      this.displayOrderDialog.set(true);
      this.orderService.getOrderById(orderId).subscribe({
        next: (order) => {
          if (order) {
            this.viewOrder(order);
          } else {
            // Try searching by orderNumber in cache/buffer if UUID lookup fails
            this.orderService.getOrders(0, 100).subscribe(allOrders => {
              const matched = allOrders.find(o => o.orderNumber === orderId || o.id === orderId);
              if (matched) {
                this.viewOrder(matched);
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Order not found' });
                this.displayOrderDialog.set(false);
              }
              this.loadingDetails.set(false);
            });
          }
        },
        error: (err) => {
          console.error('Failed to load order for highlight', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load order details' });
          this.displayOrderDialog.set(false);
          this.loadingDetails.set(false);
        }
      });
    }
  }

  ensureProductDetails(order: Order): Observable<Order> {
    const validItems = order.items.filter(item => !!item.product?.id);

    if (validItems.length === 0) {
      return of(order);
    }

    const requests = validItems.map(item => {
      const productId = item.product.id;
      return this.productService.getProductById(productId).pipe(
        map(product => ({ item, product })),
        catchError(err => {
          console.error(`Failed to fetch product ${productId}`, err);
          return of({ item, product: null });
        })
      );
    });

    return forkJoin(requests).pipe(
      map(results => {
        const updatedItems = order.items.map(currentItem => {
          const result = results.find(r => r.item.product.id === currentItem.product.id);
          if (result && result.product) {
            const fetched = result.product;
            return {
              ...currentItem,
              product: {
                ...currentItem.product,
                name: currentItem.product.name || fetched.name,
                imageUrl: currentItem.product.imageUrl || fetched.imageUrl,
                code: currentItem.product.code || fetched.code,
                // Preserve catalog price & discount metadata
                price: fetched.price || currentItem.product.price,
                effective_price: fetched.effective_price ?? currentItem.product.effective_price,
                discount_type: fetched.discount_type ?? currentItem.product.discount_type,
                discount_value: fetched.discount_value ?? currentItem.product.discount_value,
                discount_starts_at: fetched.discount_starts_at ?? currentItem.product.discount_starts_at,
                discount_ends_at: fetched.discount_ends_at ?? currentItem.product.discount_ends_at
              }
            };
          } else if (result) {
            return {
              ...currentItem,
              product: {
                ...currentItem.product,
                name: currentItem.product.name || 'Unknown Product (Deleted)'
              }
            };
          }
          return currentItem;
        });

        return {
          ...order,
          items: updatedItems
        };
      })
    );
  }

  updateStatus(order: Order, status: 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled' | 'Completed') {
    console.log('updateStatus called with:', status);
    const proceedWithStatusUpdate = () => {
      this.orderService.updateOrderStatus(order.id!, status as any).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: `Order ${status}` });

          // Force reload to ensure status is persisted and we get latest data
          this.refreshOrders();

          if (this.selectedOrder() && this.selectedOrder()!.id === order.id) {
            this.selectedOrder.update(o => o ? { ...o, status } : o);
          }
        },
        error: (err) => {
          console.error(`Failed to update order status to ${status}`, err);
          const errorMsg = err.error?.detail || 'Failed to update order status.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: errorMsg });
        }
      });
    };

    if (status === 'Completed') {
      this.confirmationService.confirm({
        message: 'Are you sure the order is delivered to the customer?',
        header: 'Confirm Completion',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
          proceedWithStatusUpdate();
        },
        reject: () => {
          // Do nothing
        }
      });
    } else {
      proceedWithStatusUpdate();
    }
  }

  adminConfirmPayment(order: Order) {
    // Use ID as is, don't force parseInt
    const orderId = order.id!;

    // Construct payload for verification
    const verifyPayload = {
      id: order.paymentId || 0,
      order_id: orderId,
      status: 'paid', // Explicitly set status to paid
      transaction_id: order.transactionId || '',
      payment_method: order.paymentMethod ? order.paymentMethod.toLowerCase() : 'bkash'
    };

    // Use specific verify endpoint for bKash (or general admin verification if applicable to all)
    // The user specifically mentioned this for bKash
    if (order.paymentMethod?.toLowerCase() === 'bkash') {
      this.paymentService.verifyPayment(orderId, verifyPayload).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated' });

          // Use status from backend response or default to Paid
          let newPaymentStatus = res.status || 'Paid';

          // Simple formatting if needed (e.g. "bkash_confirmed" -> "Bkash_confirmed")
          // But ideally we trust the backend string as requested.
          // If backend sends "Bkash Confirmed", we use it.

          // Update modal
          if (this.selectedOrder() && this.selectedOrder()!.id === order.id) {
            this.selectedOrder.update(o => o ? { ...o, paymentStatus: newPaymentStatus } : o);
          }

          // Update list locally to avoid stale data from immediate reload
          this.orders.update(currentOrders => currentOrders.map(o =>
            o.id === order.id ? { ...o, paymentStatus: newPaymentStatus } : o
          ));

          // Also confirm the order status if it's still pending
          if (order.status === 'Pending') {
            this.updateStatus(order, 'Confirmed');
          }
        },
        error: (err) => {
          console.error('Admin payment verification failed', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to verify payment' });
        }
      });
    } else {
      // Fallback for COD or others if needed
      this.paymentService.verifyPayment(orderId, verifyPayload).subscribe({
        next: (res) => {
          this.messageService.add({ severity: 'success', summary: 'Payment Verified', detail: 'Payment status updated' });

          const newStatus = res.status || 'Paid';

          // Update modal
          if (this.selectedOrder() && this.selectedOrder()!.id === order.id) {
            this.selectedOrder.update(o => o ? { ...o, paymentStatus: newStatus } : o);
          }

          // Update list locally
          this.orders.update(currentOrders => currentOrders.map(o =>
            o.id === order.id ? { ...o, paymentStatus: newStatus } : o
          ));

          // Also confirm the order status if it's still pending
          if (order.status === 'Pending') {
            this.updateStatus(order, 'Confirmed');
          }
        },
        error: (err) => {
          console.error('Admin payment verification failed', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to verify payment' });
        }
      });
    }
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    switch (status) {
      case 'Confirmed':
        return 'info'; // Changed to info to distinguish from Completed
      case 'Completed':
        return 'success'; // Completed is green
      case 'Shipping':
        return 'info';
      case 'Delivered':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'Cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }

  getPaymentSeverity(status: string | undefined): 'success' | 'warning' | 'danger' | 'info' {
    if (!status) return 'warning';
    const s = status.toLowerCase();
    // Removed 'submitted' from success list so it defaults to warning
    if (s.includes('paid') || s.includes('confirmed') || s.includes('complete') || s.includes('verified')) {
      return 'success';
    }
    return 'warning';
  }

  isPaymentConfirmed(status: string | undefined): boolean {
    if (!status) return false;
    const s = status.toLowerCase();
    // Removed 'submitted' from confirmed list so the button appears
    return s.includes('paid') || s.includes('confirmed') || s.includes('complete') || s.includes('verified');
  }

  filteredOrderItems() {
    const order = this.selectedOrder();
    if (!order || !order.items) return [];
    const q = this.itemSearchQuery().toLowerCase().trim();
    if (!q) return order.items;
    return order.items.filter(item =>
      (item.product?.name && item.product.name.toLowerCase().includes(q)) ||
      (item.product?.code && item.product.code.toLowerCase().includes(q))
    );
  }

  getTotalItemUnits(order: Order | null): number {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  getOrderItemsTooltip(order: Order): string {
    if (!order || !order.items || order.items.length === 0) return 'No items in order';
    return order.items.map(item => `${item.product?.name || 'Item'} (×${item.quantity || 1})`).join(' • ');
  }

  formatProductCode(code: string | undefined | null): string {
    if (!code) return '';
    const trimmed = code.trim();
    
    // Check if it has a long UUID or is formatted as PROD-UUID (e.g. PROD-06a3fac5-94a0-7dbb-8000-75edd0b04229)
    if (trimmed.length > 14 || (trimmed.includes('-') && trimmed.length > 10)) {
      const clean = trimmed.replace(/^PROD-/i, '').replace(/-/g, '');
      if (clean.length >= 4) {
        // Take the trailing 4 characters and pad with '0' to produce 6-character code e.g. '004229' -> 'PROD-004229'
        const last4 = clean.slice(-4);
        const padded = last4.padStart(6, '0');
        return `PROD-${padded}`;
      }
    }
    return trimmed.startsWith('PROD-') ? trimmed : `PROD-${trimmed}`;
  }

  getItemFinalUnitPrice(item: CartItem): number {
    const prod = item.product;
    if (!prod) return Number((item as any).unit_price) || 0;

    // 1. Direct effective_price from product
    if (prod.effective_price !== undefined && prod.effective_price !== null && Number(prod.effective_price) > 0 && Number(prod.effective_price) < Number(prod.price)) {
      return Number(prod.effective_price);
    }

    // 2. Computed from discount_value and discount_type
    if (prod.discount_value !== undefined && prod.discount_value !== null && Number(prod.discount_value) > 0) {
      const regular = Number(prod.price) || 0;
      const dVal = Number(prod.discount_value);
      const dType = (prod.discount_type || '').toUpperCase();
      if (dType === 'PERCENT' || dType === 'PERCENTAGE') {
        return Math.max(0, Math.round((regular - (regular * (dVal / 100))) * 100) / 100);
      }
      return Math.max(0, Math.round((regular - dVal) * 100) / 100);
    }

    // 3. Item-level price_at_purchase / unit_price vs regular catalog price
    const unitPrice = (item as any).unit_price ?? (item as any).price_at_purchase;
    if (unitPrice !== undefined && unitPrice !== null && prod.price && Number(unitPrice) < Number(prod.price)) {
      return Number(unitPrice);
    }

    return Number(prod.price) || Number(unitPrice) || 0;
  }

  getItemRegularUnitPrice(item: CartItem): number {
    const prod = item.product;
    const unitPrice = (item as any).unit_price ?? (item as any).price_at_purchase;
    return Number(prod?.price) || Number(unitPrice) || 0;
  }

  isItemDiscounted(item: CartItem): boolean {
    const regular = this.getItemRegularUnitPrice(item);
    const finalPrice = this.getItemFinalUnitPrice(item);
    return regular > 0 && finalPrice > 0 && finalPrice < regular;
  }

  getItemFinalTotal(item: CartItem): number {
    return this.getItemFinalUnitPrice(item) * (item.quantity || 1);
  }

  getItemRegularTotal(item: CartItem): number {
    return this.getItemRegularUnitPrice(item) * (item.quantity || 1);
  }

  getItemDiscountLabel(item: CartItem): string {
    const prod = item.product;
    if (prod?.discount_value && prod?.discount_type) {
      const dType = prod.discount_type.toUpperCase();
      if (dType === 'PERCENT' || dType === 'PERCENTAGE') {
        return `-${prod.discount_value}%`;
      }
    }
    const regular = this.getItemRegularUnitPrice(item);
    const finalPrice = this.getItemFinalUnitPrice(item);
    if (regular > finalPrice && regular > 0) {
      const pct = Math.round(((regular - finalPrice) / regular) * 100);
      if (pct > 0) {
        return `-${pct}%`;
      }
      return `-৳${(regular - finalPrice).toFixed(0)}`;
    }
    return '';
  }

  getItemSavings(item: CartItem): number {
    const regular = this.getItemRegularTotal(item);
    const finalTotal = this.getItemFinalTotal(item);
    return Math.max(0, regular - finalTotal);
  }

  getCustomerName(order: Order | null): string {
    if (!order) return 'Unknown Customer';
    return order.address?.full_name || order.fullName || 'Unknown Customer';
  }

  getCustomerPhone(order: Order | null): string {
    if (!order) return '';
    return order.address?.phone || order.phoneNumber || '';
  }

  getCustomerFullAddress(order: Order | null): string {
    if (!order) return '';
    if (order.address) {
      const parts = [
        order.address.address_line,
        order.address.subdistrict,
        order.address.district
      ].filter(Boolean);
      return parts.join(', ');
    }
    const parts = [
      order.fullAddress,
      order.subDistrict,
      order.district
    ].filter(Boolean);
    return parts.join(', ');
  }

  getCustomerInitial(order: Order | null): string {
    const name = this.getCustomerName(order);
    return name ? name.trim().charAt(0).toUpperCase() : 'C';
  }

  copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: `${label} copied to clipboard`,
        life: 2000
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  downloadOrders() {
    this.exportLoading.set(true);
    this.messageService.add({ severity: 'info', summary: 'Export Started', detail: 'Fetching all orders for export...' });

    // Fetch all orders (using a large limit to reasonably cover "all")
    this.orderService.getOrders(0, 10000, true).subscribe({
      next: (allOrders) => {
        if (!allOrders || allOrders.length === 0) {
          this.messageService.add({ severity: 'warn', summary: 'No Data', detail: 'No orders available to export' });
          this.exportLoading.set(false);
          return;
        }

        const csvData = allOrders.map(order => ({
          'Order Number': order.orderNumber || order.id,
          'Order ID': order.id,
          'Customer': order.fullName,
          'Phone': order.phoneNumber,
          'District': order.district,
          'Date': new Date(order.orderDate).toLocaleDateString(),
          'Subtotal': order.subtotal ?? 0,
          'Delivery': order.deliveryCharge ?? 0,
          'Total Amount': order.totalAmount,
          'Payment Status': order.paymentStatus || 'Pending',
          'Order Status': order.status
        }));

        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(csvData);
        const wscols = [
          { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = wscols;
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orders');
        XLSX.writeFile(wb, 'all_orders_export.xlsx');

        this.exportLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Export Success', detail: 'All orders exported successfully' });
      },
      error: (err) => {
        console.error('Failed to export all orders:', err);
        this.messageService.add({ severity: 'error', summary: 'Export Failed', detail: 'An error occurred while fetching orders for export' });
        this.exportLoading.set(false);
      }
    });
  }

  downloadAdminInvoice(order: Order) {
    if (!order) return;

    const orderIdStr = order.id ? order.id.toString() : '';
    this.downloadingOrderId.set(orderIdStr);

    // Ensure we have product details (names, codes) before generating the invoice
    this.ensureProductDetails(order).subscribe({
      next: (finalOrder: Order) => {
        // Map order data to common invoice format
        const invoiceData = {
          items: finalOrder.items || [],
          snapshot: {
            fullName: finalOrder.address?.full_name || finalOrder.fullName,
            phoneNumber: finalOrder.address?.phone || finalOrder.phoneNumber,
            fullAddress: finalOrder.address?.address_line || finalOrder.fullAddress,
            subDistrict: finalOrder.address?.subdistrict || finalOrder.subDistrict,
            district: finalOrder.address?.district || finalOrder.district,
            postalCode: finalOrder.postalCode || '',
            email: finalOrder.email || ''
          },
          method: finalOrder.paymentMethod || 'COD',
          deliveryCharge: finalOrder.deliveryCharge || 0,
          total: finalOrder.totalAmount || 0,
          discount: finalOrder.discountAmount || 0,
          id: orderIdStr,
          orderNumber: finalOrder.orderNumber || orderIdStr
        };
        this.invoiceOrderData.set(invoiceData);

        this.adminInvoice.downloadReceipt(invoiceData).then(() => {
          this.downloadingOrderId.set(null);
          this.messageService.add({
            life: 2000,
            severity: 'success',
            summary: 'Success',
            detail: `Invoice for Order ${finalOrder.orderNumber || finalOrder.id} downloaded.`
          });
        }).catch(err => {
          console.error('Admin Invoice download failed:', err);
          this.downloadingOrderId.set(null);
          this.messageService.add({
            life: 2000,
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to generate PDF.'
          });
        });
      },
      error: (err: any) => {
        console.error('Failed to ensure product details for invoice', err);
        this.downloadingOrderId.set(null);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not resolve product names.' });
      }
    });
  }
}
