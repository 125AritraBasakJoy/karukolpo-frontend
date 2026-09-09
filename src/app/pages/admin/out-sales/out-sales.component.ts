import { Component, OnInit, signal, Inject, PLATFORM_ID, ViewChildren, QueryList, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule, Calendar } from 'primeng/calendar';
import { MessageService } from 'primeng/api';
import { OutSalesService, ProductService } from '../../../core/services';
import { Product } from '../../../models/product.model';
import { District, districts } from '../../../data/bangladesh-data';
import { finalize } from 'rxjs/operators';

interface SaleItemRow {
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  regular_price: number | null;
  unit_cost: number | null;
}

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'bKash', value: 'bkash' },
  { label: 'Nagad', value: 'nagad' },
  { label: 'Bank', value: 'bank' },
  { label: 'Other', value: 'other' }
];

@Component({
  selector: 'app-out-sales',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ToastModule,
    TooltipModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    DropdownModule,
    CalendarModule,
    CurrencyPipe
  ],
  templateUrl: './out-sales.component.html',
  styleUrls: ['./out-sales.component.scss']
})
export class OutSalesComponent implements OnInit, OnDestroy {
  @ViewChildren(Calendar) calendars!: QueryList<Calendar>;
  private scrollListener: any;

  products = signal<Product[]>([]);
  productsLoading = signal<boolean>(false);
  saving = signal<boolean>(false);

  items: SaleItemRow[] = [];
  paymentMethod = 'cash';
  soldAt: Date = new Date();

  get currentDate(): Date {
    return new Date();
  }
  deliveryCharge = 0;
  note = '';
  source = '';
  customer = { name: '', phone: '', district: null as string | null, subdistrict: null as string | null, address_line: '' };
  districts: District[] = districts;
  subDistricts: string[] = [];

  readonly paymentMethods = PAYMENT_METHODS;

  constructor(
    private outSalesService: OutSalesService,
    private productService: ProductService,
    private messageService: MessageService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    this.resetForm();
    this.loadProducts();

    if (isPlatformBrowser(this.platformId)) {
      this.scrollListener = (event: Event) => {
        const target = event.target;
        // Only close on scroll from the main content area, not from datepicker internals
        const isContentScroll = (target instanceof HTMLElement && target.classList.contains('content-body')) ||
          target === document ||
          target === document.documentElement;
        if (isContentScroll) {
          if (this.calendars) {
            this.calendars.forEach(calendar => {
              if (calendar.overlayVisible) {
                calendar.hideOverlay();
              }
            });
          }
        }
      };
      window.addEventListener('scroll', this.scrollListener, true);
    }
  }

  ngOnDestroy() {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
  }

  private loadProducts() {
    this.productsLoading.set(true);
    this.productService.getProducts(0, 500, undefined, true).subscribe({
      next: (products) => this.products.set(products),
      error: (err) => {
        console.error('Failed to load products', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products.' });
      },
      complete: () => this.productsLoading.set(false)
    });
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

  onDistrictChange(event: any) {
    const selectedDistrictName = typeof event === 'object' && event !== null && 'value' in event ? event.value : event;
    const districtObj = this.districts.find(d => d.name === selectedDistrictName);
    if (districtObj) {
      this.subDistricts = districtObj.subDistricts;
      if (!this.subDistricts.includes(this.customer.subdistrict || '')) {
        this.customer.subdistrict = null;
      }
    } else {
      this.subDistricts = [];
      this.customer.subdistrict = null;
    }
  }

  resetForm() {
    this.items = [this.newRow()];
    this.paymentMethod = 'cash';
    this.soldAt = new Date();
    this.deliveryCharge = 0;
    this.note = '';
    this.source = '';
    this.customer = { name: '', phone: '', district: null, subdistrict: null, address_line: '' };
    this.subDistricts = [];
  }

  private newRow(): SaleItemRow {
    return { product_id: null, quantity: 1, unit_price: null, regular_price: null, unit_cost: null };
  }

  addItem() {
    this.items.push(this.newRow());
  }

  removeItem(index: number) {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
    } else {
      this.items[0] = this.newRow();
    }
  }

  onProductSelect(row: SaleItemRow, productId: string) {
    const product = this.findProduct(productId);
    if (product) {
      row.product_id = product.id;
      row.regular_price = product.price;
      if (product.effective_price != null && product.effective_price < product.price) {
        row.unit_price = product.effective_price;
      } else {
        row.unit_price = product.price;
      }
      row.unit_cost = product.cost ?? null;
    } else {
      row.regular_price = null;
      row.unit_price = null;
      row.unit_cost = null;
    }
  }

  getItemDiscount(item: SaleItemRow): number {
    if (item.regular_price == null || item.unit_price == null) return 0;
    return item.regular_price > item.unit_price ? (item.regular_price - item.unit_price) : 0;
  }

  get regularSubtotal(): number {
    return this.items.reduce((sum, item) => {
      const price = item.regular_price != null ? item.regular_price : (item.unit_price || 0);
      return sum + (price * (item.quantity || 0));
    }, 0);
  }

  get totalDiscount(): number {
    return this.items.reduce((sum, item) => {
      const discount = this.getItemDiscount(item);
      return sum + (discount * (item.quantity || 0));
    }, 0);
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0);
  }

  get grandTotal(): number {
    return this.subtotal + (this.deliveryCharge || 0);
  }

  isFormValid(): boolean {
    if (!this.items.length) return false;
    return this.items.every(item => item.product_id && (item.quantity || 0) > 0 && (item.unit_price || 0) > 0);
  }

  private extractErrorDetail(err: any): string {
    if (!err) return 'Failed to record sale. Please try again.';
    const errorObj = err.error || err;
    const detail = errorObj?.detail || errorObj?.message || errorObj?.error;

    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d: any) => {
        if (typeof d === 'string') return d;
        if (d?.msg) {
          const field = Array.isArray(d?.loc) ? d.loc.filter((l: any) => l !== 'body').join(' -> ') : '';
          return field ? `${field}: ${d.msg}` : d.msg;
        }
        return d?.message || JSON.stringify(d);
      }).filter(Boolean).join(', ');
    }
    if (typeof errorObj === 'string') {
      return errorObj;
    }
    if (typeof err?.message === 'string') {
      return err.message;
    }
    return 'Failed to record sale. Please check your inputs and try again.';
  }

  saveSale() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.isFormValid()) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Each line needs a product, quantity and unit price.' });
      return;
    }
    this.saving.set(true);

    const hasCustomerInfo = this.customer.name || this.customer.phone || this.customer.district || this.customer.subdistrict || this.customer.address_line;

    const payload = {
      items: this.items.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price!,
        unit_cost: item.unit_cost ?? null
      })),
      payment_method: this.paymentMethod,
      sold_at: this.soldAt ? new Date(this.soldAt).toISOString() : null,
      delivery_charge: this.deliveryCharge || 0,
      customer: hasCustomerInfo ? {
        name: this.customer.name || null,
        phone: this.customer.phone || null,
        district: this.customer.district || null,
        subdistrict: this.customer.subdistrict || null,
        address_line: this.customer.address_line?.trim() || null
      } : null,
      note: this.note.trim() ? this.note.trim() : null,
      source: this.source.trim() ? this.source.trim() : null
    };

    this.outSalesService.createSale(payload).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => {
        this.messageService.add({ life: 3000, severity: 'success', summary: 'Sale Recorded', detail: 'Offline sale has been recorded.' });
        this.resetForm();
      },
      error: (err) => {
        console.error('Failed to record sale', err);
        this.messageService.add({ life: 5000, severity: 'error', summary: 'Sale Failed', detail: this.extractErrorDetail(err) });
      }
    });
  }
}
