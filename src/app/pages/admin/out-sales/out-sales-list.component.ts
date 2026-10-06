import { Component, OnInit, signal, Inject, PLATFORM_ID, ViewChildren, QueryList, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule, Calendar } from 'primeng/calendar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { OutSalesService, ProductService, OrderService } from '../../../core/services';
import { Product } from '../../../models/product.model';
import { Order } from '../../../models/order.model';
import { District, districts } from '../../../data/bangladesh-data';
import { ThermalInvoiceComponent } from '../../../components/thermal-invoice/thermal-invoice.component';
import { finalize, catchError, tap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

interface SaleItemRow {
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  discount: number;
  unit_cost: number | null;
  regular_price?: number | null;
}

const HANDOVER_PAYMENT_METHODS = [
  { label: 'Cash (Stall)', value: 'cash' },
  { label: 'bKash', value: 'bkash' }
];

const DELIVERY_PAYMENT_METHODS = [
  { label: 'Cash on Delivery (COD)', value: 'cod' },
  { label: 'bKash', value: 'bkash' }
];

export type OutSalesFilterType = 'all' | 'awaiting' | 'review' | 'delivered' | 'handover' | 'cancelled';

@Component({
  selector: 'app-out-sales-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    RippleModule,
    TooltipModule,
    TagModule,
    DialogModule,
    ConfirmDialogModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    DropdownModule,
    CalendarModule,
    ProgressSpinnerModule,
    SkeletonModule,
    CurrencyPipe,
    ThermalInvoiceComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './out-sales-list.component.html',
  styleUrls: ['./out-sales-list.component.scss', '../admin-styles.scss']
})
export class OutSalesListComponent implements OnInit {
  @ViewChildren(Calendar) calendars!: QueryList<Calendar>;
  @ViewChild('classifyCalendar') classifyCalendar?: Calendar;
  @ViewChild('thermalInvoice') thermalInvoice?: ThermalInvoiceComponent;

  // Sales Table State
  sales = signal<Order[]>([]);
  filteredSales = signal<Order[]>([]);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedFilter = signal<OutSalesFilterType>('all');
  reviewCount = signal<number>(0);
  voidingSaleId = signal<string | null>(null);

  // Thermal Receipt Modal State
  thermalPreviewModalVisible = signal<boolean>(false);
  selectedSaleForInvoice = signal<Order | null>(null);
  isDownloadingThermal = signal<boolean>(false);
  isPrintingThermal = signal<boolean>(false);

  // Edit Modal State
  editDialogVisible = signal<boolean>(false);
  editingSale = signal<Order | null>(null);
  saving = signal<boolean>(false);

  // Classify / Change Type Modal State
  classifyDialogVisible = signal<boolean>(false);
  classifyingSale = signal<Order | null>(null);
  classifyChoice: 'handover' | 'delivered' | 'awaiting' = 'handover';
  classifyDeliveredAt: Date | null = null;
  classifyPaymentMethod: string = 'cod';
  classifyHandoverPaymentMethod: string | null = null;
  classifyDeliveredPaymentMethod: string | null = null;
  classifyCustomer = {
    name: '',
    phone: '',
    district: null as string | null,
    subdistrict: null as string | null,
    address_line: ''
  };
  classifySubDistricts: string[] = [];
  savingClassification = signal<boolean>(false);

  // Mark Delivered Modal State (Single & Bulk)
  markDeliveredModalVisible = signal<boolean>(false);
  targetDeliverySales = signal<Order[]>([]);
  markDeliveredAt: Date | null = null;
  submittingMarkDelivered = signal<boolean>(false);
  selectedSales: Order[] = [];

  // Cancel Order Modal State
  cancelDialogVisible = signal<boolean>(false);
  cancellingSale = signal<Order | null>(null);
  cancelReason: string = 'Customer refused the parcel';
  cancelling = signal<boolean>(false);

  // Products & Dropdowns for Edit Modal
  products = signal<Product[]>([]);
  productsLoading = signal<boolean>(false);
  readonly handoverPaymentMethods = HANDOVER_PAYMENT_METHODS;
  readonly deliveredPaymentMethods = DELIVERY_PAYMENT_METHODS;
  readonly awaitingPaymentMethods = DELIVERY_PAYMENT_METHODS;
  maxDate: Date = new Date();

  districts: District[] = districts;
  subDistricts: string[] = [];

  // Edit Form Fields
  editItems: SaleItemRow[] = [];
  editPaymentMethod = 'cash';
  editSoldAt: Date = new Date();
  editDeliveryCharge = 0;
  editNote = '';
  editSource = '';
  editCustomer = {
    name: '',
    phone: '',
    district: null as string | null,
    subdistrict: null as string | null,
    address_line: ''
  };

  get editPaymentMethods() {
    if (this.editingSale()?.fulfillment === 'delivery') {
      return DELIVERY_PAYMENT_METHODS;
    }
    return HANDOVER_PAYMENT_METHODS;
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor(
    private outSalesService: OutSalesService,
    private orderService: OrderService,
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadSales();
    this.loadProducts();
  }

  loadSales() {
    this.loading.set(true);
    this.outSalesService.listSales(0, 200).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (sales) => {
        const list = sales || [];
        this.sales.set(list);
        this.applyFilter();
        this.ensureProductsForSales(list);
        this.loadReviewQueueCount();
      },
      error: (err) => {
        console.error('Failed to load offline sales', err);
        this.messageService.add({
          life: 3000,
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load offline sales list.'
        });
      }
    });
  }

  loadReviewQueueCount() {
    this.outSalesService.listSales(0, 200, 'completed', 'unreviewed').subscribe({
      next: (unreviewed) => {
        this.reviewCount.set((unreviewed || []).length);
      },
      error: (err) => {
        console.warn('Failed to fetch review queue count', err);
      }
    });
  }

  setFilter(filter: OutSalesFilterType) {
    this.selectedFilter.set(filter);
    this.applyFilter();
  }

  private ensureProductsForSales(sales: Order[]) {
    const missingIds = new Set<string>();
    for (const s of sales) {
      for (const it of (s.items || [])) {
        const pid = it.product?.id ? it.product.id.toString() : ((it as any).product_id ? (it as any).product_id.toString() : null);
        if (pid && !this.findProduct(pid)) {
          missingIds.add(pid);
        }
      }
    }

    if (missingIds.size > 0 && this.products().length === 0) {
      this.loadProducts();
    }
  }

  private loadProducts() {
    this.productsLoading.set(true);
    this.productService.getProducts(0, 500, undefined, true).pipe(
      finalize(() => this.productsLoading.set(false))
    ).subscribe({
      next: (prods) => {
        this.products.set(prods || []);
      },
      error: (err) => {
        console.warn('Failed to load catalog products', err);
      }
    });
  }

  onSearchChange() {
    this.applyFilter();
  }

  clearSearch() {
    this.searchQuery.set('');
    this.applyFilter();
  }

  getStatusInfo(sale: Order): { label: string; severity: 'secondary' | 'danger' | 'warning' | 'success' | 'info' } {
    const raw = (sale.rawStatus || sale.status || '').toLowerCase().trim();
    const fulfillment = sale.fulfillment || 'unreviewed';
    const isVoided = !!sale.isVoided;

    if (raw === 'cancelled' && isVoided) {
      return { label: 'Voided', severity: 'secondary' };
    }
    if (raw === 'cancelled') {
      return { label: 'Cancelled / Returned', severity: 'danger' };
    }
    if (raw === 'cod_processing') {
      return { label: 'Awaiting delivery · COD', severity: 'warning' };
    }
    if (raw === 'paid') {
      return { label: 'Awaiting delivery · Prepaid', severity: 'warning' };
    }
    if (raw === 'completed') {
      if (fulfillment === 'delivery') {
        return { label: 'Delivered', severity: 'success' };
      }
      if (fulfillment === 'handover') {
        return { label: 'Handed over', severity: 'success' };
      }
      return { label: 'Needs review', severity: 'info' };
    }
    if (raw === 'pending') {
      return { label: 'Pending', severity: 'warning' };
    }
    return { label: sale.status || 'Confirmed', severity: 'info' };
  }

  getPaymentMethodLabel(method?: string | null): string {
    if (!method) return 'Cash (Stall)';
    const m = method.toLowerCase().trim();
    if (m === 'cash') return 'Cash (Stall)';
    if (m === 'cod') return 'COD';
    if (m === 'bkash') return 'bKash';
    return method;
  }

  isAwaitingDelivery(sale?: Order | null): boolean {
    if (!sale) return false;
    const raw = (sale.rawStatus || sale.status || '').toLowerCase();
    return raw === 'cod_processing' || raw === 'paid';
  }

  isCompletedSale(sale?: Order | null): boolean {
    if (!sale) return false;
    const raw = (sale.rawStatus || sale.status || '').toLowerCase();
    return raw === 'completed';
  }

  isCancelledSale(sale?: Order | null): boolean {
    if (!sale) return false;
    const raw = (sale.rawStatus || sale.status || '').toLowerCase();
    return raw === 'cancelled';
  }

  needsReview(sale?: Order | null): boolean {
    if (!sale) return false;
    const raw = (sale.rawStatus || sale.status || '').toLowerCase();
    const fulfillment = sale.fulfillment || 'unreviewed';
    return raw === 'completed' && fulfillment === 'unreviewed';
  }

  private applyFilter() {
    const filter = this.selectedFilter();
    const q = this.searchQuery().toLowerCase().trim();

    let list = this.sales();

    // 1. Chip Filter
    if (filter !== 'all') {
      list = list.filter(sale => {
        const raw = (sale.rawStatus || sale.status || '').toLowerCase();
        const f = sale.fulfillment || 'unreviewed';

        if (filter === 'awaiting') {
          return raw === 'cod_processing' || raw === 'paid';
        }
        if (filter === 'review') {
          return raw === 'completed' && f === 'unreviewed';
        }
        if (filter === 'delivered') {
          return raw === 'completed' && f === 'delivery';
        }
        if (filter === 'handover') {
          return raw === 'completed' && f === 'handover';
        }
        if (filter === 'cancelled') {
          return raw === 'cancelled';
        }
        return true;
      });
    }

    // 2. Search Query
    if (q) {
      list = list.filter(sale => {
        const orderNo = (sale.orderNumber || sale.id || '').toLowerCase();
        const customer = (sale.fullName || '').toLowerCase();
        const phone = (sale.phoneNumber || '').toLowerCase();
        const payment = (sale.paymentMethod || '').toLowerCase();
        const status = (sale.status || '').toLowerCase();
        const statusInfo = this.getStatusInfo(sale);
        const derivedStatus = statusInfo.label.toLowerCase();
        const fulfillment = (sale.fulfillment || '').toLowerCase();
        const source = (sale.source || (sale as any).utm_source || '').toLowerCase();

        return orderNo.includes(q) ||
          source.includes(q) ||
          customer.includes(q) ||
          phone.includes(q) ||
          payment.includes(q) ||
          status.includes(q) ||
          derivedStatus.includes(q) ||
          fulfillment.includes(q);
      });
    }

    this.filteredSales.set(list);
  }

  findProduct(productId?: string | number | null, productName?: string | null): Product | undefined {
    if (!this.products().length) return undefined;
    const prods = this.products();
    if (productId != null) {
      const pidStr = productId.toString().trim();
      const byId = prods.find(p => p.id === pidStr || p.id?.toString() === pidStr);
      if (byId) return byId;
    }
    if (productName) {
      const cleanName = productName.toLowerCase().trim();
      const byName = prods.find(p => p.name && p.name.toLowerCase().trim() === cleanName);
      if (byName) return byName;
    }
    return undefined;
  }

  getSaleTotal(sale: Order): number {
    return sale.totalAmount != null ? sale.totalAmount : 0;
  }

  // ===== ROW ACTION & BULK ACTION: MARK DELIVERED =====
  confirmMarkDelivered(sale: Order) {
    if (!sale || !sale.id) return;
    this.closeAllCalendarOverlays();
    this.maxDate = new Date();
    this.targetDeliverySales.set([sale]);
    this.markDeliveredAt = null;
    this.markDeliveredModalVisible.set(true);
  }

  confirmBulkMarkDelivered() {
    if (!this.selectedSales.length) return;
    this.closeAllCalendarOverlays();
    this.maxDate = new Date();
    this.targetDeliverySales.set([...this.selectedSales]);
    this.markDeliveredAt = null;
    this.markDeliveredModalVisible.set(true);
  }

  submitMarkDelivered() {
    const targets = this.targetDeliverySales();
    if (!targets.length) return;

    let deliveredAtIso: string | undefined;
    if (this.markDeliveredAt) {
      const parsed = this.safeParseDate(this.markDeliveredAt);
      if (!parsed) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Date',
          detail: 'Please enter a valid delivered date and time or leave blank.'
        });
        return;
      }
      deliveredAtIso = parsed.toISOString();
    }

    this.submittingMarkDelivered.set(true);

    if (targets.length === 1) {
      const sale = targets[0];
      if (!sale.id) return;
      const request$ = deliveredAtIso
        ? this.outSalesService.setFulfillment(sale.id, { fulfillment: 'delivery', delivered: true, delivered_at: deliveredAtIso })
        : (this.isAwaitingDelivery(sale)
            ? this.orderService.adminCompleteOrder(sale.id)
            : this.outSalesService.setFulfillment(sale.id, { fulfillment: 'delivery', delivered: true }));

      request$.pipe(
        finalize(() => this.submittingMarkDelivered.set(false))
      ).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Delivered',
            detail: `Sale #${sale.orderNumber || sale.id} marked as delivered.`
          });
          this.markDeliveredModalVisible.set(false);
          this.selectedSales = this.selectedSales.filter(s => s.id !== sale.id);
          this.loadSales();
        },
        error: (err) => {
          console.error('Failed to mark delivered', err);
          const detail = err.error?.detail || err.message || 'Failed to complete delivery sale.';
          this.messageService.add({ severity: 'error', summary: 'Delivery Failed', detail });
        }
      });
      return;
    }

    // Bulk delivery execution
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    const calls = targets.filter(sale => !!sale.id).map(sale => {
      const obs$ = deliveredAtIso
        ? this.outSalesService.setFulfillment(sale.id!, { fulfillment: 'delivery', delivered: true, delivered_at: deliveredAtIso })
        : (this.isAwaitingDelivery(sale)
            ? this.orderService.adminCompleteOrder(sale.id!)
            : this.outSalesService.setFulfillment(sale.id!, { fulfillment: 'delivery', delivered: true }));

      return obs$.pipe(
        tap(() => successCount++),
        catchError((err) => {
          failCount++;
          const msg = err.error?.detail || err.message || 'Failed';
          errors.push(`#${sale.orderNumber || sale.id}: ${msg}`);
          return of(null);
        })
      );
    });

    forkJoin(calls).pipe(
      finalize(() => this.submittingMarkDelivered.set(false))
    ).subscribe(() => {
      if (successCount > 0) {
        this.messageService.add({
          severity: 'success',
          summary: 'Bulk Delivery Complete',
          detail: `${successCount} sale(s) marked as delivered.`
        });
      }
      if (failCount > 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Some Deliveries Failed',
          detail: `${failCount} failed: ${errors.slice(0, 3).join(', ')}`
        });
      }
      this.markDeliveredModalVisible.set(false);
      this.selectedSales = [];
      this.loadSales();
    });
  }

  // ===== ROW ACTION: CANCEL (REFUSED / RETURNED) =====
  openCancelModal(sale: Order) {
    this.cancellingSale.set(sale);
    this.cancelReason = 'Customer refused the parcel';
    this.cancelDialogVisible.set(true);
  }

  submitCancelSale() {
    const sale = this.cancellingSale();
    if (!sale || !sale.id) return;

    this.cancelling.set(true);
    this.orderService.adminCancelOrder(sale.id, this.cancelReason.trim()).pipe(
      finalize(() => this.cancelling.set(false))
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Order Cancelled',
          detail: 'Sale has been cancelled and inventory units restocked.'
        });
        this.cancelDialogVisible.set(false);
        this.cancellingSale.set(null);
        this.loadSales();
      },
      error: (err) => {
        console.error('Failed to cancel order', err);
        const detail = err.error?.detail || err.message || 'Failed to cancel order.';
        this.messageService.add({ severity: 'error', summary: 'Cancel Failed', detail });
      }
    });
  }

  // ===== ROW ACTION & REVIEW QUEUE: CLASSIFY / CHANGE TYPE =====
  private safeParseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value as string | number);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private closeAllCalendarOverlays() {
    if (this.classifyCalendar?.overlayVisible) {
      try {
        this.classifyCalendar.hideOverlay();
      } catch {
        // no-op
      }
    }
    if (this.calendars) {
      this.calendars.forEach(cal => {
        if (cal?.overlayVisible) {
          try {
            cal.hideOverlay();
          } catch {
            // no-op
          }
        }
      });
    }
  }

  onSelectClassifyChoice(choice: 'handover' | 'delivered' | 'awaiting') {
    if (this.classifyChoice !== choice) {
      this.closeAllCalendarOverlays();
      this.classifyChoice = choice;
    }
  }

  closeClassifyDialog() {
    this.closeAllCalendarOverlays();
    this.classifyDialogVisible.set(false);
  }

  onClassifyDialogHide() {
    this.closeAllCalendarOverlays();
    if (!this.savingClassification()) {
      this.classifyingSale.set(null);
    }
  }

  openClassifyModal(sale: Order, choice?: 'handover' | 'delivered' | 'awaiting') {
    this.closeAllCalendarOverlays();
    this.maxDate = new Date();
    this.savingClassification.set(false);
    this.classifyingSale.set(sale);
    this.classifyChoice = choice || (sale.fulfillment === 'delivery' ? 'delivered' : 'handover');
    this.classifyDeliveredAt = this.safeParseDate(sale.completedAt);

    const currentMethod = (sale.paymentMethod || '').toLowerCase().trim();
    if (currentMethod === 'cash' || currentMethod === 'bkash') {
      this.classifyHandoverPaymentMethod = currentMethod;
    } else {
      this.classifyHandoverPaymentMethod = 'cash';
    }

    if (currentMethod === 'cod' || currentMethod === 'bkash') {
      this.classifyDeliveredPaymentMethod = currentMethod;
      this.classifyPaymentMethod = currentMethod;
    } else {
      this.classifyDeliveredPaymentMethod = 'cod';
      this.classifyPaymentMethod = 'cod';
    }

    const address = sale.address;
    this.classifyCustomer = {
      name: address?.full_name || sale.fullName || '',
      phone: address?.phone || sale.phoneNumber || '',
      district: address?.district || sale.district || null,
      subdistrict: address?.subdistrict || sale.subDistrict || null,
      address_line: address?.address_line || sale.fullAddress || ''
    };

    if (this.classifyCustomer.district) {
      const d = this.districts.find(item => item.name === this.classifyCustomer.district);
      this.classifySubDistricts = d ? d.subDistricts : [];
    } else {
      this.classifySubDistricts = [];
    }

    this.classifyDialogVisible.set(true);
  }

  onClassifyDistrictChange(event: any) {
    const selectedDistrictName = typeof event === 'object' && event !== null && 'value' in event ? event.value : event;
    const districtObj = this.districts.find(d => d.name === selectedDistrictName);
    if (districtObj) {
      this.classifySubDistricts = districtObj.subDistricts;
      if (!this.classifySubDistricts.includes(this.classifyCustomer.subdistrict || '')) {
        this.classifyCustomer.subdistrict = null;
      }
    } else {
      this.classifySubDistricts = [];
      this.classifyCustomer.subdistrict = null;
    }
  }

  quickClassifyHandover(sale: Order) {
    if (!sale || !sale.id) return;
    const currentMethod = (sale.paymentMethod || '').toLowerCase().trim();
    const payload: any = { fulfillment: 'handover' };
    if (currentMethod !== 'bkash') {
      payload.payment_method = 'cash';
    }
    this.outSalesService.setFulfillment(sale.id, payload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Classified',
          detail: 'Sale classified as Handed Over.'
        });
        this.loadSales();
        this.loadReviewQueueCount();
      },
      error: (err) => {
        const detail = err.error?.detail || err.message || 'Failed to classify sale.';
        this.messageService.add({ severity: 'error', summary: 'Failed', detail });
      }
    });
  }

  submitClassification() {
    const sale = this.classifyingSale();
    if (!sale || !sale.id) return;

    this.savingClassification.set(true);

    if (this.classifyChoice === 'handover') {
      if (!this.classifyHandoverPaymentMethod) {
        this.savingClassification.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing Payment Method',
          detail: 'Please select a payment method for the store handover.'
        });
        return;
      }
      this.outSalesService.setFulfillment(sale.id, {
        fulfillment: 'handover',
        payment_method: this.classifyHandoverPaymentMethod
      }).pipe(
        finalize(() => this.savingClassification.set(false))
      ).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Classified',
            detail: 'Sale marked as Handed Over.'
          });
          this.closeClassifyDialog();
          this.loadSales();
          this.loadReviewQueueCount();
        },
        error: (err) => {
          const detail = err.error?.detail || err.message || 'Classification failed.';
          this.messageService.add({ severity: 'error', summary: 'Failed', detail });
        }
      });
      return;
    }

    if (this.classifyChoice === 'delivered') {
      if (!this.classifyDeliveredPaymentMethod) {
        this.savingClassification.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing Payment Method',
          detail: 'Please select a payment method for the delivery sale.'
        });
        return;
      }

      let deliveredAtIso: string | undefined;
      if (this.classifyDeliveredAt) {
        const parsed = this.safeParseDate(this.classifyDeliveredAt);
        if (!parsed) {
          this.savingClassification.set(false);
          this.messageService.add({
            severity: 'warn',
            summary: 'Invalid Date',
            detail: 'Please enter a valid completion date and time or clear the field.'
          });
          return;
        }
        deliveredAtIso = parsed.toISOString();
      }

      const body: any = {
        fulfillment: 'delivery',
        delivered: true,
        payment_method: this.classifyDeliveredPaymentMethod
      };
      if (deliveredAtIso) {
        body.delivered_at = deliveredAtIso;
      }

      this.outSalesService.setFulfillment(sale.id, body).pipe(
        finalize(() => this.savingClassification.set(false))
      ).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Classified',
            detail: 'Sale marked as Delivered.'
          });
          this.closeClassifyDialog();
          this.loadSales();
          this.loadReviewQueueCount();
        },
        error: (err) => {
          const detail = err.error?.detail || err.message || 'Classification failed.';
          this.messageService.add({ severity: 'error', summary: 'Failed', detail });
        }
      });
      return;
    }

    if (this.classifyChoice === 'awaiting') {
      if (!this.classifyPaymentMethod) {
        this.savingClassification.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing Payment Method',
          detail: 'Please select a payment method (COD or bKash).'
        });
        return;
      }
      if (!this.classifyCustomer.name?.trim() || !this.classifyCustomer.phone?.trim() || !this.classifyCustomer.address_line?.trim()) {
        this.savingClassification.set(false);
        this.messageService.add({
          severity: 'warn',
          summary: 'Missing Delivery Details',
          detail: 'Name, phone and address line are required for parcel delivery.'
        });
        return;
      }

      const custPayload = {
        name: this.classifyCustomer.name.trim(),
        phone: this.classifyCustomer.phone.trim(),
        district: this.classifyCustomer.district,
        subdistrict: this.classifyCustomer.subdistrict,
        address_line: this.classifyCustomer.address_line.trim()
      };

      // Save customer details first if needed, then set fulfillment
      this.outSalesService.updateSale(sale.id, { customer: custPayload }).subscribe({
        next: () => {
          this.outSalesService.setFulfillment(sale.id!, {
            fulfillment: 'delivery',
            delivered: false,
            payment_method: this.classifyPaymentMethod
          }).pipe(
            finalize(() => this.savingClassification.set(false))
          ).subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Sale Reclassified',
                detail: 'Sale moved to Awaiting Delivery.'
              });
              this.closeClassifyDialog();
              this.loadSales();
              this.loadReviewQueueCount();
            },
            error: (err) => {
              const detail = err.error?.detail || err.message || 'Failed to reclassify sale.';
              this.messageService.add({ severity: 'error', summary: 'Failed', detail });
            }
          });
        },
        error: (err) => {
          this.savingClassification.set(false);
          const detail = err.error?.detail || err.message || 'Failed to update customer delivery details.';
          this.messageService.add({ severity: 'error', summary: 'Update Failed', detail });
        }
      });
    }
  }

  // ===== EDIT MODAL LOGIC =====
  openEditModal(sale: Order) {
    this.closeAllCalendarOverlays();
    this.maxDate = new Date();
    this.editingSale.set(sale);

    this.syncEditItems(sale);

    if (this.products().length === 0) {
      this.loadProducts();
    }

    this.editPaymentMethod = (sale.paymentMethod || 'cash').toLowerCase();
    if (sale.fulfillment === 'delivery' && this.editPaymentMethod === 'cash') {
      this.editPaymentMethod = 'cod';
    } else if (sale.fulfillment === 'handover' && this.editPaymentMethod === 'cod') {
      this.editPaymentMethod = 'cash';
    }
    this.editSoldAt = this.safeParseDate(sale.orderDate) || new Date();
    this.editDeliveryCharge = sale.deliveryCharge || 0;
    this.editSource = sale.source || (sale as any).utm_source || '';
    this.editNote = sale.note || '';

    const address = sale.address;
    this.editCustomer = {
      name: address?.full_name || sale.fullName || '',
      phone: address?.phone || sale.phoneNumber || '',
      district: address?.district || sale.district || null,
      subdistrict: address?.subdistrict || sale.subDistrict || null,
      address_line: address?.address_line || sale.fullAddress || ''
    };

    if (this.editCustomer.district) {
      const d = this.districts.find(item => item.name === this.editCustomer.district);
      this.subDistricts = d ? d.subDistricts : [];
    } else {
      this.subDistricts = [];
    }

    this.editDialogVisible.set(true);
  }

  addItem() {
    this.editItems.push({ product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null });
  }

  removeItem(index: number) {
    if (this.editItems.length > 1) {
      this.editItems.splice(index, 1);
    } else {
      this.editItems[0] = { product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null };
    }
  }

  onDistrictChange(event: any) {
    const selectedDistrictName = typeof event === 'object' && event !== null && 'value' in event ? event.value : event;
    const districtObj = this.districts.find(d => d.name === selectedDistrictName);
    if (districtObj) {
      this.subDistricts = districtObj.subDistricts;
      if (!this.subDistricts.includes(this.editCustomer.subdistrict || '')) {
        this.editCustomer.subdistrict = null;
      }
    } else {
      this.subDistricts = [];
      this.editCustomer.subdistrict = null;
    }
  }

  getProductCatalogDiscount(prod: Product | undefined | null): number {
    if (!prod) return 0;
    const catalogPrice = Number(prod.price) || 0;
    if (prod.effective_price != null && prod.effective_price < catalogPrice) {
      return Math.max(0, Math.round((catalogPrice - Number(prod.effective_price)) * 100) / 100);
    }
    if (prod.discount_value != null && Number(prod.discount_value) > 0) {
      const dType = (prod.discount_type || '').toUpperCase();
      if (dType === 'PERCENT' || dType === 'PERCENTAGE') {
        return Math.max(0, Math.round((catalogPrice * (Number(prod.discount_value) / 100)) * 100) / 100);
      }
      return Math.max(0, Math.min(catalogPrice, Math.round(Number(prod.discount_value) * 100) / 100));
    }
    return 0;
  }

  onProductSelect(row: SaleItemRow, productId: string) {
    const product = this.findProduct(productId);
    if (product) {
      row.product_id = product.id;
      const catalogPrice = Number(product.price) || 0;
      const catalogDiscount = this.getProductCatalogDiscount(product);
      row.regular_price = catalogPrice;
      row.discount = catalogDiscount;
      row.unit_price = catalogDiscount > 0 ? Math.max(0, catalogPrice - catalogDiscount) : catalogPrice;
      row.unit_cost = product.cost ?? null;
    } else {
      row.unit_price = null;
      row.discount = 0;
      row.regular_price = null;
      row.unit_cost = null;
    }
  }

  private syncEditItems(sale: Order) {
    if (sale.items && sale.items.length > 0) {
      this.editItems = sale.items.map(item => {
        const pid = item.product?.id ? item.product.id.toString() : ((item as any).product_id ? (item as any).product_id.toString() : null);
        const prod = this.findProduct(pid, item.product?.name);
        const resolvedId = prod?.id || pid;
        const anyItem = item as any;
        const catalogPrice = prod ? (Number(prod.price) || 0) : (anyItem.regular_price || anyItem.unit_price || item.product?.price || 0);
        const unitP = anyItem.unit_price != null ? Number(anyItem.unit_price) : (item.product?.price != null ? Number(item.product.price) : 0);
        let disc = 0;
        if (catalogPrice > unitP) {
          disc = Math.round((catalogPrice - unitP) * 100) / 100;
        }

        return {
          product_id: resolvedId,
          quantity: item.quantity || 1,
          unit_price: unitP,
          discount: disc,
          unit_cost: (item as any).unit_cost != null ? Number((item as any).unit_cost) : (prod?.cost ?? null),
          regular_price: catalogPrice
        };
      });
    } else {
      this.editItems = [{ product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null }];
    }
  }

  getItemRegularPrice(item: SaleItemRow): number {
    if (item.regular_price != null && item.regular_price > 0) {
      return item.regular_price;
    }
    if (item.product_id) {
      const prod = this.findProduct(item.product_id);
      if (prod && Number(prod.price) > 0) {
        return Number(prod.price);
      }
    }
    const unitPrice = item.unit_price || 0;
    const discount = item.discount || 0;
    return unitPrice + discount;
  }

  getItemDiscount(item: SaleItemRow): number {
    const regular = this.getItemRegularPrice(item);
    const unitPrice = item.unit_price || 0;
    if (regular > unitPrice) {
      return Math.round((regular - unitPrice) * 100) / 100;
    }
    return 0;
  }

  get regularTotal(): number {
    return this.editItems.reduce((sum, item) => sum + (this.getItemRegularPrice(item) * (item.quantity || 0)), 0);
  }

  get subtotal(): number {
    return this.editItems.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0);
  }

  get totalDiscount(): number {
    return this.editItems.reduce((sum, item) => sum + (this.getItemDiscount(item) * (item.quantity || 0)), 0);
  }

  get grandTotal(): number {
    const total = this.subtotal + (this.editDeliveryCharge || 0);
    return Math.max(0, total);
  }

  isFormValid(): boolean {
    if (!this.editItems.length) return false;
    const itemsValid = this.editItems.every(item => item.product_id && (item.quantity || 0) > 0 && (item.unit_price || 0) >= 0);
    if (!itemsValid) return false;

    const currentSale = this.editingSale();
    const isAwaiting = this.isAwaitingDelivery(currentSale);
    if (isAwaiting) {
      if (!this.editCustomer.name?.trim() || !this.editCustomer.phone?.trim() || !this.editCustomer.address_line?.trim()) {
        return false;
      }
    }
    return true;
  }

  saveEditedSale() {
    const currentSale = this.editingSale();
    if (!currentSale || !currentSale.id) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid sale selected for editing.' });
      return;
    }

    if (!this.isFormValid()) {
      const isAwaiting = this.isAwaitingDelivery(currentSale);
      const detail = (isAwaiting && (!this.editCustomer.name?.trim() || !this.editCustomer.phone?.trim() || !this.editCustomer.address_line?.trim()))
        ? 'A sale awaiting delivery requires customer name, phone, and address line.'
        : 'Each item must have a product, quantity, and unit price.';
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete Form',
        detail
      });
      return;
    }

    let soldAtIso: string | null = null;
    if (this.editSoldAt) {
      const parsed = this.safeParseDate(this.editSoldAt);
      if (!parsed) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Date',
          detail: 'Please enter a valid sale date and time.'
        });
        return;
      }
      soldAtIso = parsed.toISOString();
    }

    this.saving.set(true);

    const hasCustomerInfo = this.editCustomer.name || this.editCustomer.phone || this.editCustomer.district || this.editCustomer.subdistrict || this.editCustomer.address_line;

    const payload = {
      items: this.editItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
        unit_cost: item.unit_cost ?? null
      })),
      payment_method: this.editPaymentMethod,
      sold_at: soldAtIso,
      delivery_charge: this.editDeliveryCharge || 0,
      customer: hasCustomerInfo ? {
        name: this.editCustomer.name || null,
        phone: this.editCustomer.phone || null,
        district: this.editCustomer.district || null,
        subdistrict: this.editCustomer.subdistrict || null,
        address_line: this.editCustomer.address_line?.trim() || null
      } : null,
      note: this.editNote.trim() ? this.editNote.trim() : null,
      source: this.editSource.trim() ? this.editSource.trim() : null
    };

    this.outSalesService.updateSale(currentSale.id, payload).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => {
        this.messageService.add({
          life: 3000,
          severity: 'success',
          summary: 'Sale Updated',
          detail: 'Offline sale has been updated successfully.'
        });
        this.editDialogVisible.set(false);
        this.loadSales();
      },
      error: (err) => {
        console.error('Failed to update sale', err);
        const detail = err.error?.detail || err.message || 'Failed to update sale.';
        this.messageService.add({
          life: 5000,
          severity: 'error',
          summary: 'Update Failed',
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail)
        });
      }
    });
  }

  confirmVoidSale(sale: Order) {
    if (!sale || !sale.id) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to void offline sale "${sale.orderNumber || sale.id}"? This will restock deducted units and mark the sale cancelled.`,
      header: 'Confirm Void Sale',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Void Sale',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.voidSale(sale.id!);
      }
    });
  }

  private voidSale(saleId: string) {
    this.voidingSaleId.set(saleId);
    this.outSalesService.voidSale(saleId).pipe(
      finalize(() => this.voidingSaleId.set(null))
    ).subscribe({
      next: () => {
        this.messageService.add({
          life: 3000,
          severity: 'success',
          summary: 'Sale Voided',
          detail: 'Offline sale has been voided and units restocked.'
        });
        this.loadSales();
      },
      error: (err) => {
        console.error('Failed to void sale', err);
        const detail = err.error?.detail || 'Failed to void sale.';
        this.messageService.add({
          life: 4000,
          severity: 'error',
          summary: 'Void Failed',
          detail: typeof detail === 'string' ? detail : JSON.stringify(detail)
        });
      }
    });
  }

  openThermalInvoice(sale: Order) {
    const enrichedItems = (sale.items || []).map((item: any) => {
      const pid = item.product_id || item.product?.id;
      const rawName = item.product?.name || item.name;
      const matched = this.findProduct(pid, rawName);
      
      const isIdLike = (str: string) => !str || /^PROD-[a-f0-9-]+$/i.test(str) || /^[a-f0-9-]{12,}$/i.test(str);
      let bestName = matched?.name;
      if (!bestName && rawName && !isIdLike(rawName)) {
        bestName = rawName;
      }
      if (!bestName) {
        bestName = 'Item';
      }

      const anyItem = item as any;
      const regularPrice = anyItem.regular_price || item.product?.price || anyItem.unit_price || 0;
      const effectivePrice = anyItem.unit_price != null ? anyItem.unit_price : (item.product?.price || 0);
      const itemDiscount = anyItem.discount || (regularPrice > effectivePrice ? regularPrice - effectivePrice : 0);

      return {
        ...item,
        name: bestName,
        product: {
          ...(item.product || {}),
          name: bestName,
          code: item.product?.code || matched?.code || ''
        },
        regular_price: regularPrice,
        effective_price: effectivePrice,
        discount: itemDiscount
      };
    });

    const enrichedSale: Order = {
      ...sale,
      items: enrichedItems
    };

    this.selectedSaleForInvoice.set(enrichedSale);
    this.thermalPreviewModalVisible.set(true);
  }

  async onPrintBluetoothThermalInvoice() {
    if (this.isPrintingThermal() || !this.thermalInvoice) return;
    this.isPrintingThermal.set(true);
    try {
      const res = await this.thermalInvoice.printViaBluetooth();
      if (!res.success && res.message && !res.message.includes('cancelled')) {
        alert(res.message);
      }
    } finally {
      this.isPrintingThermal.set(false);
    }
  }

  async onPrintUsbThermalInvoice() {
    return this.onPrintBluetoothThermalInvoice();
  }

  async onDownloadThermalInvoice() {
    if (this.isDownloadingThermal()) return;
    this.isDownloadingThermal.set(true);
    try {
      await this.thermalInvoice?.downloadReceipt();
    } finally {
      this.isDownloadingThermal.set(false);
    }
  }

  closeThermalPreview() {
    this.thermalPreviewModalVisible.set(false);
    this.selectedSaleForInvoice.set(null);
  }
}
