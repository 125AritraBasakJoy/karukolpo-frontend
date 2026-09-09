import { Component, OnInit, signal, Inject, PLATFORM_ID, ViewChildren, QueryList } from '@angular/core';
import { CommonModule, isPlatformBrowser, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
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
import { OutSalesService, ProductService } from '../../../core/services';
import { Product } from '../../../models/product.model';
import { Order } from '../../../models/order.model';
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
  selector: 'app-out-sales-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ToastModule,
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
    CurrencyPipe
  ],
  providers: [ConfirmationService],
  templateUrl: './out-sales-list.component.html',
  styleUrls: ['./out-sales-list.component.scss', '../admin-styles.scss']
})
export class OutSalesListComponent implements OnInit {
  @ViewChildren(Calendar) calendars!: QueryList<Calendar>;

  // Sales Table State
  sales = signal<Order[]>([]);
  filteredSales = signal<Order[]>([]);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  voidingSaleId = signal<string | null>(null);

  // Edit Modal State
  editDialogVisible = signal<boolean>(false);
  editingSale = signal<Order | null>(null);
  saving = signal<boolean>(false);

  // Products & Dropdowns for Edit Modal
  products = signal<Product[]>([]);
  productsLoading = signal<boolean>(false);
  readonly paymentMethods = PAYMENT_METHODS;
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

  constructor(
    private outSalesService: OutSalesService,
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
        this.sales.set(sales || []);
        this.applyFilter();
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

  loadProducts() {
    this.productsLoading.set(true);
    this.productService.getProducts(0, 500, undefined, true).subscribe({
      next: (products) => {
        this.products.set(products);
        if (this.editDialogVisible() && this.editingSale()) {
          this.syncEditItems(this.editingSale()!);
        }
      },
      error: (err) => console.error('Failed to load products', err),
      complete: () => this.productsLoading.set(false)
    });
  }

  onSearchChange() {
    this.applyFilter();
  }

  clearSearch() {
    this.searchQuery.set('');
    this.applyFilter();
  }

  private applyFilter() {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) {
      this.filteredSales.set(this.sales());
      return;
    }

    const filtered = this.sales().filter(sale => {
      const orderNo = (sale.orderNumber || sale.id || '').toLowerCase();
      const customer = (sale.fullName || '').toLowerCase();
      const phone = (sale.phoneNumber || '').toLowerCase();
      const payment = (sale.paymentMethod || '').toLowerCase();
      const status = (sale.status || '').toLowerCase();
      return orderNo.includes(q) || customer.includes(q) || phone.includes(q) || payment.includes(q) || status.includes(q);
    });

    this.filteredSales.set(filtered);
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

  syncEditItems(sale: Order) {
    if (!sale.items || sale.items.length === 0) {
      this.editItems = [{ product_id: null, quantity: 1, unit_price: null, regular_price: null, unit_cost: null }];
      return;
    }

    const totalQty = sale.items.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1;
    const saleDiscount = sale.discountAmount || 0;

    this.editItems = sale.items.map(item => {
      const prodId = item.product?.id ? item.product.id.toString() : ((item as any).product_id ? (item as any).product_id.toString() : null);
      const prod = this.findProduct(prodId, item.product?.name);

      // Sold unit price: the actual price per unit in this sale
      const soldUnitPrice = (item as any).unit_price != null ? (item as any).unit_price : (item.product?.price ?? 0);

      // Determine regular catalog price and discount:
      let regularPrice: number | null = null;
      let unitPrice: number = soldUnitPrice;

      if (prod) {
        const catalogPrice = prod.price;
        const catalogEffective = (prod.effective_price != null && prod.effective_price < prod.price) ? prod.effective_price : null;

        if (catalogEffective != null) {
          // Product currently has an active discount in catalog
          regularPrice = catalogPrice;
          unitPrice = (soldUnitPrice === catalogPrice || soldUnitPrice === catalogEffective) ? catalogEffective : soldUnitPrice;
        } else if (soldUnitPrice < catalogPrice) {
          // Sold price is lower than regular price -> discount was applied
          regularPrice = catalogPrice;
          unitPrice = soldUnitPrice;
        } else if (saleDiscount > 0) {
          // Sale has discountAmount recorded
          const perUnitDiscount = Math.round((saleDiscount / totalQty) * 100) / 100;
          regularPrice = soldUnitPrice + perUnitDiscount;
          unitPrice = soldUnitPrice;
        } else {
          regularPrice = catalogPrice;
          unitPrice = soldUnitPrice;
        }
      } else {
        // Product not yet in catalog list: check if sale had a discount
        if (saleDiscount > 0) {
          const perUnitDiscount = Math.round((saleDiscount / totalQty) * 100) / 100;
          regularPrice = soldUnitPrice + perUnitDiscount;
          unitPrice = soldUnitPrice;
        } else {
          regularPrice = (item as any).regular_price ?? item.product?.price ?? soldUnitPrice;
          unitPrice = soldUnitPrice;
        }
      }

      return {
        product_id: prod ? prod.id : prodId,
        quantity: item.quantity || 1,
        unit_price: unitPrice,
        regular_price: regularPrice,
        unit_cost: prod ? (prod.cost ?? null) : null
      };
    });
  }

  openEditModal(sale: Order) {
    this.editingSale.set(sale);

    // Initialize Items with discount detection
    this.syncEditItems(sale);

    // Ensure catalog products are fresh
    if (this.products().length === 0) {
      this.loadProducts();
    }

    // Payment method
    this.editPaymentMethod = (sale.paymentMethod || 'cash').toLowerCase();

    // Sold date
    this.editSoldAt = sale.orderDate ? new Date(sale.orderDate) : new Date();

    // Delivery charge
    this.editDeliveryCharge = sale.deliveryCharge || 0;

    // Source & Note
    this.editSource = (sale as any).source || (sale as any).utm_source || '';
    this.editNote = sale.note || '';

    // Customer
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
    this.editItems.push({ product_id: null, quantity: 1, unit_price: null, regular_price: null, unit_cost: null });
  }

  removeItem(index: number) {
    if (this.editItems.length > 1) {
      this.editItems.splice(index, 1);
    } else {
      this.editItems[0] = { product_id: null, quantity: 1, unit_price: null, regular_price: null, unit_cost: null };
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

  get regularSubtotal(): number {
    return this.editItems.reduce((sum, item) => {
      const price = item.regular_price != null ? item.regular_price : (item.unit_price || 0);
      return sum + (price * (item.quantity || 0));
    }, 0);
  }

  get totalDiscount(): number {
    return this.editItems.reduce((sum, item) => {
      const discount = this.getItemDiscount(item);
      return sum + (discount * (item.quantity || 0));
    }, 0);
  }

  get subtotal(): number {
    return this.editItems.reduce((sum, item) => sum + ((item.unit_price || 0) * (item.quantity || 0)), 0);
  }

  get grandTotal(): number {
    return this.subtotal + (this.editDeliveryCharge || 0);
  }

  isFormValid(): boolean {
    if (!this.editItems.length) return false;
    return this.editItems.every(item => item.product_id && (item.quantity || 0) > 0 && (item.unit_price || 0) >= 0);
  }

  saveEditedSale() {
    const currentSale = this.editingSale();
    if (!currentSale || !currentSale.id) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid sale selected for editing.' });
      return;
    }

    if (!this.isFormValid()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete Form',
        detail: 'Each item must have a product, quantity, and unit price.'
      });
      return;
    }

    this.saving.set(true);

    const hasCustomerInfo = this.editCustomer.name || this.editCustomer.phone || this.editCustomer.district || this.editCustomer.subdistrict || this.editCustomer.address_line;

    const payload = {
      items: this.editItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price!,
        unit_cost: item.unit_cost ?? null
      })),
      payment_method: this.editPaymentMethod,
      sold_at: this.editSoldAt ? new Date(this.editSoldAt).toISOString() : null,
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

  getSeverity(status: string | undefined): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' | undefined {
    if (!status) return 'info';
    const s = status.toLowerCase();
    if (s.includes('cancel') || s.includes('void')) return 'danger';
    if (s.includes('complete') || s.includes('delivered') || s.includes('confirmed')) return 'success';
    if (s.includes('pending')) return 'warning';
    return 'info';
  }
}
