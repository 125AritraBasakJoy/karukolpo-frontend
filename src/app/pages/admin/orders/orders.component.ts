import { Component, OnInit, signal, ViewChild, inject, DestroyRef, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService, OrderQueryOptions } from '../../../core/services';
import { ProductService } from '../../../core/services';
import { PaymentService } from '../../../core/services';
import { Order, OrderAdminUpdate, OrderEditResult } from '../../../models/order.model';
import { Product } from '../../../models/product.model';
import { PaymentTransaction, formatPaymentStatus, PaymentStatusInfo } from '../../../models/payment.model';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { NotificationService } from '../../../core/services';
import { Popover, PopoverModule } from 'primeng/popover';
import { TextareaModule } from 'primeng/textarea';
import { CurrencyPipe } from '@angular/common';
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
    TooltipModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule,
    FormsModule,
    ConfirmDialogModule,
    PopoverModule,
    TextareaModule,
    CurrencyPipe,
    InvoiceComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './orders.component.html',
  standalone: true,
  styleUrls: ['./orders.component.scss', '../admin-styles.scss']
})
export class OrdersComponent implements OnInit {
  @ViewChild('adminInvoice') adminInvoice!: InvoiceComponent;
  @ViewChild('orderActionsPopover') orderActionsPopover?: Popover;

  activeActionOrder = signal<Order | null>(null);
  allCatalogProducts = signal<Product[]>([]);
  catalogProductsLoading = signal<boolean>(false);
  selectedAddProductId: string | null = null;
  manualPaymentSaving = signal<boolean>(false);

  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  highlightedOrderId = signal<string | null>(null);

  orders = signal<Order[]>([]);
  totalRecords = signal<number>(0);
  loading = signal<boolean>(false);
  exportLoading = signal<boolean>(false);
  downloadingOrderId = signal<string | null>(null);
  selectedOrder = signal<Order | null>(null);
  displayOrderDialog = signal(false);
  loadingDetails = signal(false);
  lastOpenedOrderId: string | null = null;
  lastLazyLoadEvent: TableLazyLoadEvent | null = null;

  isMobile = signal<boolean>(typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false);

  // Invoice Mapping State
  invoiceOrderData = signal<any>({
    items: [],
    snapshot: {},
    method: '',
    deliveryCharge: 0,
    total: 0,
    discount: 0,
    id: '',
    payment_status: 'unpaid',
    amount_due: 0,
    created_at: ''
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

  // Cache product details across dialog opens (D4)
  private productDetailCache = new Map<string, any>();

  // Payment Action Modals
  displayVerifyDialog = signal(false);
  verifyAmount = signal<string>('');
  verifyConfirmPending = signal<boolean>(true);

  displayRejectDialog = signal(false);
  rejectReason = signal<string>('');

  displayManualPaymentDialog = signal(false);
  manualPaymentKind = signal<'payment' | 'refund'>('payment');
  manualPaymentMethod = signal<string>('bkash');
  manualPaymentAmount = signal<string>('');
  manualPaymentReference = signal<string>('');
  manualPaymentNote = signal<string>('');

  displayVoidDialog = signal(false);
  voidEntryId = signal<string | null>(null);
  voidReason = signal<string>('');

  displayCancelDialog = signal(false);
  orderToCancel = signal<Order | null>(null);
  cancelReason = signal<string>('');

  displayCompleteDialog = signal(false);
  orderToComplete = signal<Order | null>(null);
  completeCollectedVia = signal<string>('cod');

  paymentMethodOptions = [
    { label: 'bKash', value: 'bkash' },
    { label: 'Cash on Delivery (COD)', value: 'cod' },
    { label: 'Cash', value: 'cash' },
    { label: 'Nagad', value: 'nagad' },
    { label: 'Bank Transfer', value: 'bank' },
    { label: 'Other', value: 'other' }
  ];

  // Online Order Editing State (A5)
  displayEditOrderDialog = signal(false);
  editBasketItems = signal<Array<{
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    code?: string;
  }>>([]);
  editAddress = signal<{
    full_name?: string;
    phone?: string;
    email?: string;
    district?: string;
    subdistrict?: string;
    address_line?: string;
    additional_info?: string;
  }>({});
  editReason = signal<string>('');
  editPreviewResult = signal<OrderEditResult | null>(null);
  editPreviewLoading = signal<boolean>(false);
  editSaving = signal<boolean>(false);

  editProductSearchQuery = signal<string>('');
  editProductSearchResults = signal<any[]>([]);
  editSearchingProducts = signal<boolean>(false);
  private editSearchTimeout: any;

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private paymentService: PaymentService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService
  ) { }

  @HostListener('window:resize')
  onResize() {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.matchMedia('(max-width: 768px)').matches);
    }
  }

  ngOnInit() {
    this.rows = getSavedPageSize('karukolpo_orders_rows', 10);
    this.first = getSavedPageOffset('karukolpo_orders_first', 0);
    this.loadOrders();

    this.activatedRoute.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const highlightId = params['highlight'];
      if (highlightId) {
        this.highlightedOrderId.set(highlightId);
        this.openOrderById(highlightId);

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

    this.orderService.newOrderNotification$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadOrders();
    });
  }

  loadOrders(event?: TableLazyLoadEvent) {
    this.loading.set(true);

    const lazyEvent = event || this.lastLazyLoadEvent || { first: this.first, rows: this.rows };
    this.lastLazyLoadEvent = lazyEvent;

    const first = lazyEvent.first !== undefined ? lazyEvent.first : this.first;
    const rows = lazyEvent.rows || this.rows;

    this.rows = rows;
    this.first = first;
    savePageSize('karukolpo_orders_rows', rows);
    savePageOffset('karukolpo_orders_first', first);

    const query = this.searchQuery().trim();
    const options: OrderQueryOptions = {
      skip: first,
      limit: rows,
      q: query || undefined
    };

    if (this.orderService.getOrdersWithCount) {
      this.orderService.getOrdersWithCount(options).subscribe({
        next: (res) => {
          this.orders.set(res.items);
          this.totalRecords.set(res.total);
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
      return;
    }

    // Fallback for tests providing only mocked getOrders
    this.orderService.getOrders(first, rows).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        const currentTotal = first + orders.length;
        if (orders.length === rows) {
          this.totalRecords.set(currentTotal + 1);
        } else {
          this.totalRecords.set(currentTotal);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onSearchInput(event: any) {
    const val = typeof event === 'string' ? event : event?.target?.value || '';
    this.searchQuery.set(val);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.first = 0;
      this.isSearching.set(!!val.trim());
      this.loadOrders();
    }, 350);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.isSearching.set(false);
    this.first = 0;
    this.loadOrders();
  }

  refreshOrders() {
    this.first = 0;
    this.loadOrders();
  }

  viewOrder(order: Order) {
    this.itemSearchQuery.set('');
    this.selectedOrder.set(JSON.parse(JSON.stringify(order)));
    this.displayOrderDialog.set(true);
    this.loadingDetails.set(true);

    if (order.id) {
      this.orderService.getOrderById(order.id).pipe(
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
          this.ensureProductDetails(this.selectedOrder()!).subscribe((final: Order) => {
            this.selectedOrder.set(final);
            this.loadingDetails.set(false);
          });
        }
      });
    } else {
      this.loadingDetails.set(false);
    }
  }

  openOrderById(orderId: string) {
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
            this.orderService.getOrdersWithCount({ q: orderId, limit: 1 }).subscribe(res => {
              if (res.items.length > 0) {
                this.viewOrder(res.items[0]);
              } else {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Order not found' });
                this.displayOrderDialog.set(false);
              }
              this.loadingDetails.set(false);
            });
          }
        },
        error: (err) => {
          console.error('Failed to load order', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load order details' });
          this.displayOrderDialog.set(false);
          this.loadingDetails.set(false);
        }
      });
    }
  }

  ensureProductDetails(order: Order): Observable<Order> {
    const validItems = (order.items || []).filter(item => !!item.product?.id || !!item.product_id);

    if (validItems.length === 0) {
      return of(order);
    }

    const uniqueProductIds = Array.from(new Set(
      validItems.map(item => item.product?.id || item.product_id).filter(Boolean)
    )) as string[];

    const missingIds = uniqueProductIds.filter(id => !this.productDetailCache.has(id));

    if (missingIds.length === 0) {
      return of(this.applyCachedProducts(order));
    }

    const fetches = missingIds.map(id =>
      this.productService.getProductById(id).pipe(
        tap(prod => {
          if (prod) this.productDetailCache.set(id, prod);
        }),
        catchError(() => of(null))
      )
    );

    return forkJoin(fetches).pipe(
      map(() => this.applyCachedProducts(order))
    );
  }

  private applyCachedProducts(order: Order): Order {
    const updatedItems = (order.items || []).map(item => {
      const pid = item.product?.id || item.product_id;
      const cached = pid ? this.productDetailCache.get(pid) : null;
      if (cached) {
        return {
          ...item,
          product: {
            ...item.product,
            name: cached.name || item.product?.name || item.name,
            code: cached.code || item.product?.code,
            imageUrl: cached.imageUrl || item.product?.imageUrl
          }
        };
      }
      return item;
    });
    return { ...order, items: updatedItems };
  }

  getPaymentStatusInfo(order: Order | null): PaymentStatusInfo {
    if (!order) return { label: 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
    return formatPaymentStatus(
      order.payment_status || order.paymentStatus,
      order.amount_due || 0,
      order.paymentMethod
    );
  }

  getPaymentSeverity(status: string | undefined): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    if (!status) return 'warn';
    return formatPaymentStatus(status).severity;
  }

  isPaymentConfirmed(status: string | undefined): boolean {
    if (!status) return false;
    return status.toLowerCase().trim() === 'paid';
  }

  getSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    switch (status) {
      case 'Confirmed':
        return 'info';
      case 'Completed':
        return 'success';
      case 'Shipping':
        return 'info';
      case 'Delivered':
        return 'success';
      case 'Pending':
        return 'warn';
      case 'Cancelled':
        return 'danger';
      default:
        return 'info';
    }
  }

  getFulfillmentLabel(fulfillment?: string | null): string {
    if (fulfillment === 'handover') return 'Handover';
    if (fulfillment === 'delivery') return 'Delivery';
    return 'Needs review';
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

  copyToClipboard(text: string, label: string) {
    if (!navigator.clipboard) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Clipboard not supported.' });
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      this.messageService.add({
        severity: 'info',
        summary: 'Copied',
        detail: `${label} copied to clipboard`,
        life: 2000
      });
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  getItemFinalUnitPrice(item: any): number {
    return item.unit_price ?? item.price_at_purchase ?? item.product?.effective_price ?? item.product?.price ?? 0;
  }

  getItemRegularUnitPrice(item: any): number {
    return item.regular_price ?? item.price_at_purchase ?? item.product?.price ?? 0;
  }

  isItemDiscounted(item: any): boolean {
    const regular = this.getItemRegularUnitPrice(item);
    const finalPrice = this.getItemFinalUnitPrice(item);
    return regular > finalPrice;
  }

  getItemDiscountLabel(item: any): string {
    const regular = this.getItemRegularUnitPrice(item);
    const finalPrice = this.getItemFinalUnitPrice(item);
    if (regular <= finalPrice) return '';
    const pct = Math.round(((regular - finalPrice) / regular) * 100);
    return `${pct}% OFF`;
  }

  getItemFinalTotal(item: any): number {
    return this.getItemFinalUnitPrice(item) * (item.quantity || 1);
  }

  getItemSavings(item: any): number {
    const regular = this.getItemRegularUnitPrice(item);
    const finalPrice = this.getItemFinalUnitPrice(item);
    return Math.max(0, (regular - finalPrice) * (item.quantity || 1));
  }

  getCustomerInitial(order: Order | null): string {
    if (!order) return '?';
    const name = this.getCustomerName(order);
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  getCustomerName(order: Order | null): string {
    if (!order) return 'Customer';
    return order.address?.full_name || order.fullName || 'Customer';
  }

  getCustomerPhone(order: Order | null): string {
    if (!order) return '';
    return order.address?.phone || order.phoneNumber || '';
  }

  getCustomerFullAddress(order: Order | null): string {
    if (!order) return '';
    if (order.address?.address_line) {
      const parts = [order.address.address_line, order.address.subdistrict, order.address.district].filter(Boolean);
      return parts.join(', ');
    }
    return order.fullAddress || '';
  }

  // Status transitions
  updateStatus(order: Order, status: 'Confirmed' | 'Cancelled' | 'Completed') {
    if (status === 'Cancelled') {
      this.openCancelDialog(order);
    } else if (status === 'Completed') {
      this.openCompleteDialog(order);
    } else if (status === 'Confirmed') {
      this.confirmationService.confirm({
        message: `Confirm order ${order.orderNumber || order.id}?`,
        header: 'Confirm Order',
        icon: 'pi pi-question-circle',
        accept: () => {
          this.orderService.adminConfirmOrder(order.id!).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Confirmed', detail: 'Order confirmed successfully.' });
              if (this.selectedOrder() && this.selectedOrder()!.id === order.id) {
                this.orderService.getOrderById(order.id!).subscribe(refreshed => {
                  if (refreshed) this.selectedOrder.set(refreshed);
                });
              }
              this.loadOrders();
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to confirm order.' });
            }
          });
        }
      });
    }
  }

  // Cancel Dialog
  openCancelDialog(order: Order) {
    this.orderToCancel.set(order);
    this.cancelReason.set('');
    this.displayCancelDialog.set(true);
  }

  confirmCancelOrder() {
    const order = this.orderToCancel();
    if (!order || !order.id) return;
    const reason = this.cancelReason().trim() || undefined;

    this.orderService.adminCancelOrder(order.id, reason).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Cancelled', detail: 'Order cancelled successfully.' });
        this.displayCancelDialog.set(false);
        const targetId = order.id;
        if (targetId && this.selectedOrder() && this.selectedOrder()!.id === targetId) {
          this.orderService.getOrderById(targetId).subscribe(refreshed => {
            if (refreshed) this.selectedOrder.set(refreshed);
          });
        }
        this.loadOrders();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to cancel order.' });
      }
    });
  }

  // Complete / Deliver Dialog
  openCompleteDialog(order: Order) {
    this.orderToComplete.set(order);
    const defaultMethod = (order.paymentMethod?.toLowerCase() === 'cod' || (order.amount_due || 0) > 0) ? 'cod' : 'cash';
    this.completeCollectedVia.set(defaultMethod);
    this.displayCompleteDialog.set(true);
  }

  confirmCompleteOrder() {
    const order = this.orderToComplete();
    if (!order || !order.id) return;
    const method = this.completeCollectedVia();

    this.orderService.adminCompleteOrder(order.id, method).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Delivered', detail: 'Order marked as completed.' });
        this.displayCompleteDialog.set(false);
        const targetId = order.id;
        if (targetId && this.selectedOrder() && this.selectedOrder()!.id === targetId) {
          this.orderService.getOrderById(targetId).subscribe(refreshed => {
            if (refreshed) this.selectedOrder.set(refreshed);
          });
        }
        this.loadOrders();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to mark completed.' });
      }
    });
  }

  // Verify bKash Claim Dialog
  openVerifyDialog(order: Order) {
    const askAmt = order.payments?.amount ?? order.totalAmount;
    this.verifyAmount.set(askAmt ? askAmt.toString() : '');
    this.verifyConfirmPending.set(order.status === 'Pending');
    this.displayVerifyDialog.set(true);
  }

  confirmVerifyPayment() {
    const order = this.selectedOrder();
    if (!order || !order.id) return;

    const amt = this.verifyAmount().trim() || undefined;
    this.paymentService.verifyPayment(order.id, {
      amount: amt,
      confirm: this.verifyConfirmPending()
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Verified', detail: 'bKash payment verified.' });
        this.displayVerifyDialog.set(false);
        this.orderService.getOrderById(order.id!).subscribe(refreshed => {
          if (refreshed) this.selectedOrder.set(refreshed);
          this.loadOrders();
        });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to verify payment.' });
      }
    });
  }

  // Reject bKash Claim Dialog
  openRejectDialog() {
    this.rejectReason.set('');
    this.displayRejectDialog.set(true);
  }

  confirmRejectPayment() {
    const order = this.selectedOrder();
    if (!order || !order.id) return;

    this.paymentService.rejectPayment(order.id, {
      reason: this.rejectReason().trim() || undefined
    }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Rejected', detail: 'bKash payment claim rejected.' });
        this.displayRejectDialog.set(false);
        this.orderService.getOrderById(order.id!).subscribe(refreshed => {
          if (refreshed) this.selectedOrder.set(refreshed);
          this.loadOrders();
        });
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to reject payment.' });
      }
    });
  }

  // Record Manual Payment / Refund
  openManualPaymentDialog(kind: 'payment' | 'refund' = 'payment') {
    this.manualPaymentKind.set(kind);
    this.manualPaymentMethod.set('bkash');
    const order = this.selectedOrder();
    if (kind === 'refund' && order && (order.amount_due || 0) < 0) {
      this.manualPaymentAmount.set(Math.abs(order.amount_due!).toString());
    } else if (kind === 'payment' && order && (order.amount_due || 0) > 0) {
      this.manualPaymentAmount.set(order.amount_due!.toString());
    } else {
      this.manualPaymentAmount.set('');
    }
    this.manualPaymentReference.set('');
    this.manualPaymentNote.set('');
    this.displayManualPaymentDialog.set(true);
  }

  confirmManualPayment() {
    const order = this.selectedOrder();
    if (!order || !order.id) return;

    const amt = parseFloat(this.manualPaymentAmount().trim());
    if (isNaN(amt) || amt <= 0) {
      this.messageService.add({ severity: 'error', summary: 'Invalid Amount', detail: 'Amount must be greater than 0.' });
      return;
    }

    this.manualPaymentSaving.set(true);
    this.paymentService.recordManualPayment(order.id, {
      kind: this.manualPaymentKind(),
      method: this.manualPaymentMethod(),
      amount: amt.toFixed(2),
      reference: this.manualPaymentReference().trim() || undefined,
      note: this.manualPaymentNote().trim() || undefined
    }).subscribe({
      next: (detail) => {
        this.manualPaymentSaving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Recorded',
          detail: `${this.manualPaymentKind() === 'payment' ? 'Payment' : 'Refund'} recorded successfully.`
        });
        this.displayManualPaymentDialog.set(false);
        const mapped = this.orderService.mapBackendOrder(detail);
        this.selectedOrder.set(mapped);
        this.loadOrders();
      },
      error: (err) => {
        this.manualPaymentSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to record entry.' });
      }
    });
  }

  // Void Ledger Entry Dialog
  openVoidDialog(tx: PaymentTransaction) {
    this.voidEntryId.set(tx.id);
    this.voidReason.set('');
    this.displayVoidDialog.set(true);
  }

  confirmVoidEntry() {
    const order = this.selectedOrder();
    const entryId = this.voidEntryId();
    if (!order || !order.id || !entryId) return;

    this.paymentService.voidPaymentEntry(order.id, entryId, this.voidReason().trim() || undefined).subscribe({
      next: (detail) => {
        this.messageService.add({ severity: 'success', summary: 'Voided', detail: 'Ledger entry voided.' });
        this.displayVoidDialog.set(false);
        const mapped = this.orderService.mapBackendOrder(detail);
        this.selectedOrder.set(mapped);
        this.loadOrders();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to void entry.' });
      }
    });
  }

  // Can Void Check
  canVoidTransaction(tx: PaymentTransaction): boolean {
    if (tx.voided_at) return false;
    const s = (tx.source || '').toLowerCase();
    return s === 'manual' || s === 'delivery_collection' || s === 'backfill';
  }

  // Online Order Editing (A5)
  canEditOrder(order: Order | null): boolean {
    if (!order) return false;
    if (order.channel === 'offline') return false;
    return order.status === 'Pending' || order.status === 'Confirmed';
  }

  confirmDirectOrder(order: Order) {
    this.updateStatus(order, 'Confirmed');
  }

  completeDirectOrder(order: Order) {
    this.updateStatus(order, 'Completed');
  }

  cancelDirectOrder(order: Order) {
    this.updateStatus(order, 'Cancelled');
  }

  openEditOrderModalDirect(order: Order) {
    this.selectedOrder.set(order);
    this.openEditOrderModal();
  }

  openOrderActionMenu(event: Event, order: Order) {
    event.stopPropagation();
    this.activeActionOrder.set(order);
    this.orderActionsPopover?.toggle(event);
  }

  executeOrderAction(action: (order: Order) => void) {
    const order = this.activeActionOrder();
    this.orderActionsPopover?.hide();
    if (order) {
      action(order);
    }
  }

  loadCatalogProductsIfNeeded() {
    if (this.allCatalogProducts().length > 0 || this.catalogProductsLoading()) return;
    this.catalogProductsLoading.set(true);
    this.productService.getProducts(0, 500, undefined, true).subscribe({
      next: (prods) => {
        this.allCatalogProducts.set(prods || []);
        this.catalogProductsLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed to load catalog products for dropdown', err);
        this.catalogProductsLoading.set(false);
      }
    });
  }

  onAddProductDropdownChange(productId: string | null) {
    if (!productId) return;
    const prod = this.allCatalogProducts().find(p => p.id === productId);
    if (prod) {
      this.addEditProduct(prod);
    }
    this.selectedAddProductId = null;
  }

  openEditOrderModal() {
    const order = this.selectedOrder();
    if (!order) return;

    this.loadCatalogProductsIfNeeded();

    const basket = (order.items || []).map(item => ({
      product_id: item.product?.id || item.product_id || '',
      name: item.product?.name || item.name || 'Product',
      price: item.unit_price ?? item.price_at_purchase ?? 0,
      quantity: item.quantity || 1,
      imageUrl: item.product?.imageUrl || '',
      code: item.product?.code || ''
    }));

    this.editBasketItems.set(basket);
    this.selectedAddProductId = null;
    this.editAddress.set({
      full_name: order.address?.full_name || order.fullName || '',
      phone: order.address?.phone || order.phoneNumber || '',
      email: order.address?.email || order.email || '',
      district: order.address?.district || order.district || '',
      subdistrict: order.address?.subdistrict || order.subDistrict || '',
      address_line: order.address?.address_line || order.fullAddress || '',
      additional_info: order.address?.additional_info || order.additionalInfo || ''
    });
    this.editReason.set('');
    this.editPreviewResult.set(null);
    this.editProductSearchQuery.set('');
    this.editProductSearchResults.set([]);
    this.displayEditOrderDialog.set(true);

    this.fetchEditPreview();
  }

  onEditProductSearch(query: string) {
    this.editProductSearchQuery.set(query);
    clearTimeout(this.editSearchTimeout);
    if (!query.trim()) {
      this.editProductSearchResults.set([]);
      return;
    }
    this.editSearchTimeout = setTimeout(() => {
      this.editSearchingProducts.set(true);
      this.productService.getProductsWithCount({ q: query.trim(), view: 'card', limit: 10 }).subscribe({
        next: (res) => {
          this.editProductSearchResults.set(res.items);
          this.editSearchingProducts.set(false);
        },
        error: () => {
          this.editSearchingProducts.set(false);
        }
      });
    }, 300);
  }

  addEditProduct(prod: any) {
    const current = this.editBasketItems();
    const existing = current.find(i => i.product_id === prod.id);
    if (existing) {
      existing.quantity += 1;
      this.editBasketItems.set([...current]);
    } else {
      this.editBasketItems.set([
        ...current,
        {
          product_id: prod.id,
          name: prod.name,
          price: prod.effective_price ?? prod.price,
          quantity: 1,
          imageUrl: prod.imageUrl,
          code: prod.code
        }
      ]);
    }
    this.editProductSearchQuery.set('');
    this.editProductSearchResults.set([]);
    this.fetchEditPreview();
  }

  updateEditItemQuantity(index: number, delta: number) {
    const items = [...this.editBasketItems()];
    const newQty = items[index].quantity + delta;
    if (newQty <= 0) {
      items.splice(index, 1);
    } else {
      items[index].quantity = Math.min(1000, newQty);
    }
    this.editBasketItems.set(items);
    this.fetchEditPreview();
  }

  removeEditItem(index: number) {
    const items = [...this.editBasketItems()];
    items.splice(index, 1);
    this.editBasketItems.set(items);
    this.fetchEditPreview();
  }

  private buildEditPayload(): OrderAdminUpdate {
    const addr = this.editAddress();
    const cleanAddress: any = {};
    if (addr.full_name?.trim()) cleanAddress.full_name = addr.full_name.trim();
    if (addr.phone?.trim()) cleanAddress.phone = addr.phone.trim();
    if (addr.email?.trim()) cleanAddress.email = addr.email.trim();
    if (addr.district?.trim()) cleanAddress.district = addr.district.trim();
    if (addr.subdistrict?.trim()) cleanAddress.subdistrict = addr.subdistrict.trim();
    if (addr.address_line?.trim()) cleanAddress.address_line = addr.address_line.trim();
    if (addr.additional_info !== undefined) cleanAddress.additional_info = addr.additional_info;

    return {
      items: this.editBasketItems().map(i => ({
        product_id: i.product_id,
        quantity: i.quantity
      })),
      address: Object.keys(cleanAddress).length > 0 ? cleanAddress : undefined,
      reason: this.editReason().trim() || undefined
    };
  }

  fetchEditPreview() {
    const order = this.selectedOrder();
    if (!order || !order.id || this.editBasketItems().length === 0) return;

    this.editPreviewLoading.set(true);
    const payload = this.buildEditPayload();

    this.orderService.editOrder(order.id, payload, true).subscribe({
      next: (result) => {
        this.editPreviewResult.set(result);
        this.editPreviewLoading.set(false);
      },
      error: (err) => {
        console.error('Edit preview failed', err);
        this.editPreviewLoading.set(false);
      }
    });
  }

  confirmSaveEditOrder() {
    const order = this.selectedOrder();
    if (!order || !order.id) return;
    if (this.editBasketItems().length === 0) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Basket cannot be empty.' });
      return;
    }

    this.editSaving.set(true);
    const payload = this.buildEditPayload();

    this.orderService.editOrder(order.id, payload, false).subscribe({
      next: (result) => {
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Order updated successfully.' });
        this.editSaving.set(false);
        this.displayEditOrderDialog.set(false);
        const mapped = this.orderService.mapBackendOrder(result.order);
        this.selectedOrder.set(mapped);
        this.loadOrders();
      },
      error: (err) => {
        this.editSaving.set(false);
        console.error('Save edit order failed', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to save order edit.' });
      }
    });
  }

  // Export CSV (B2)
  downloadOrders() {
    this.exportLoading.set(true);
    this.messageService.add({ severity: 'info', summary: 'Export Started', detail: 'Generating orders export CSV...' });

    const query = this.searchQuery().trim();
    this.orderService.exportOrdersCsv({ q: query || undefined }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date().toISOString().slice(0, 10);
        a.download = `orders-export-${now}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.exportLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Export Complete', detail: 'Orders CSV downloaded successfully.' });
      },
      error: (err) => {
        console.error('Failed to export orders:', err);
        this.exportLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Export Failed', detail: 'Could not export orders CSV.' });
      }
    });
  }

  // Invoice Download (A2 & B10)
  downloadAdminInvoice(order: Order) {
    if (!order) return;

    const orderIdStr = order.id ? order.id.toString() : '';
    this.downloadingOrderId.set(orderIdStr);

    this.ensureProductDetails(order).subscribe({
      next: (finalOrder: Order) => {
        const invoiceData = {
          items: finalOrder.items || [],
          snapshot: {
            fullName: finalOrder.address?.full_name || finalOrder.fullName || '',
            phoneNumber: finalOrder.address?.phone || finalOrder.phoneNumber || '',
            fullAddress: finalOrder.address?.address_line || finalOrder.address?.address || finalOrder.fullAddress || '',
            subDistrict: finalOrder.address?.subdistrict || finalOrder.subDistrict || '',
            district: finalOrder.address?.district || finalOrder.district || '',
            postalCode: finalOrder.address?.postal_code || finalOrder.postalCode || '',
            email: finalOrder.address?.email || finalOrder.email || ''
          },
          method: finalOrder.paymentMethod || 'COD',
          deliveryCharge: finalOrder.deliveryCharge || 0,
          total: finalOrder.totalAmount || 0,
          discount: finalOrder.discountAmount || 0,
          id: orderIdStr,
          orderNumber: finalOrder.orderNumber || orderIdStr,
          payment_status: finalOrder.payment_status || finalOrder.paymentStatus || 'unpaid',
          amount_due: finalOrder.amount_due ?? 0,
          created_at: finalOrder.created_at || finalOrder.orderDate?.toISOString()
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
        }).catch((err: any) => {
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
