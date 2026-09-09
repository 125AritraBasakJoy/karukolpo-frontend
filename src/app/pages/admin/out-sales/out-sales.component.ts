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
import { RippleModule } from 'primeng/ripple';
import { OutSalesService, ProductService } from '../../../core/services';
import { Product } from '../../../models/product.model';
import { District, districts } from '../../../data/bangladesh-data';
import { finalize } from 'rxjs/operators';

interface SaleItemRow {
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  discount: number;
  unit_cost: number | null;
  regular_price?: number | null;
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
    CurrencyPipe,
    RippleModule
  ],
  templateUrl: './out-sales.component.html',
  styleUrls: ['./out-sales.component.scss', '../admin-styles.scss']
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
    return { product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null };
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

  getProductEffectivePrice(prod: Product | undefined | null): number {
    if (!prod) return 0;
    const catalogPrice = Number(prod.price) || 0;
    const discount = this.getProductCatalogDiscount(prod);
    return discount > 0 ? Math.max(0, catalogPrice - discount) : catalogPrice;
  }

  onProductSelect(row: SaleItemRow, productId: string) {
    const product = this.findProduct(productId);
    if (product) {
      row.product_id = product.id;
      const catalogPrice = Number(product.price) || 0;
      const catalogDiscount = this.getProductCatalogDiscount(product);
      row.regular_price = catalogPrice;
      row.discount = catalogDiscount;
      // Unit Price in the input box is the discounted price if on discount, or catalog price
      row.unit_price = catalogDiscount > 0 ? Math.max(0, catalogPrice - catalogDiscount) : catalogPrice;
      row.unit_cost = product.cost ?? null;
    } else {
      row.unit_price = null;
      row.discount = 0;
      row.regular_price = null;
      row.unit_cost = null;
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

  getItemEffectivePrice(item: SaleItemRow): number {
    return item.unit_price || 0;
  }

  get regularTotal(): number {
    return this.items.reduce((sum, item) => sum + (this.getItemRegularPrice(item) * (item.quantity || 0)), 0);
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0);
  }

  get totalDiscount(): number {
    return this.items.reduce((sum, item) => sum + (this.getItemDiscount(item) * (item.quantity || 0)), 0);
  }

  get grandTotal(): number {
    const total = this.subtotal + (this.deliveryCharge || 0);
    return Math.max(0, total);
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
        unit_price: item.unit_price || 0,
        price: item.unit_price || 0,
        price_at_purchase: item.unit_price || 0,
        unit_cost: item.unit_cost ?? null
      })),
      total: this.grandTotal,
      total_amount: this.grandTotal,
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
