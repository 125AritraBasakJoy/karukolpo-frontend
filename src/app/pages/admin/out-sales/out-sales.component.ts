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

interface SaleItemRow {
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
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
  providers: [MessageService],
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
  deliveryCharge = 0;
  note = '';
  customer = { name: '', phone: '', district: '', subdistrict: '' };

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
    this.productService.getProducts(0, 200, undefined, true).subscribe({
      next: (products) => this.products.set(products),
      error: (err) => {
        console.error('Failed to load products', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products.' });
      },
      complete: () => this.productsLoading.set(false)
    });
  }

  resetForm() {
    this.items = [this.newRow()];
    this.paymentMethod = 'cash';
    this.soldAt = new Date();
    this.deliveryCharge = 0;
    this.note = '';
    this.customer = { name: '', phone: '', district: '', subdistrict: '' };
  }

  private newRow(): SaleItemRow {
    return { product_id: null, quantity: 1, unit_price: null, unit_cost: null };
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
    const product = this.products().find(p => p.id === productId);
    if (product) {
      row.unit_price = product.effective_price || product.price;
      row.unit_cost = product.cost ?? null;
    }
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

  saveSale() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.isFormValid()) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Each line needs a product, quantity and unit price.' });
      return;
    }
    this.saving.set(true);

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
      customer: (this.customer.name || this.customer.phone) ? {
        name: this.customer.name || null,
        phone: this.customer.phone || null,
        district: this.customer.district || null,
        subdistrict: this.customer.subdistrict || null
      } : null,
      note: this.note.trim() ? this.note.trim() : null
    };

    this.outSalesService.createSale(payload).subscribe({
      next: () => {
        this.messageService.add({ life: 2500, severity: 'success', summary: 'Sale Recorded', detail: 'Offline sale has been recorded.' });
        this.resetForm();
      },
      error: (err) => {
        console.error('Failed to record sale', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to record sale. Please try again.' });
      },
      complete: () => this.saving.set(false)
    });
  }
}
