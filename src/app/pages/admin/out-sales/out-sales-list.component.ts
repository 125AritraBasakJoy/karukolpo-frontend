import { Component, OnInit, signal, Inject, PLATFORM_ID, ViewChildren, QueryList } from '@angular/core';
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
import { OutSalesService, ProductService } from '../../../core/services';
import { Product } from '../../../models/product.model';
import { Order } from '../../../models/order.model';
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

  private salesOverrides = new Map<string, Order>();

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getSaleOverrideKey(saleId: string): string {
    return `karukolpo_out_sale_override_${saleId}`;
  }

  private saveSaleOverride(order: Order) {
    if (!order.id) return;
    this.salesOverrides.set(order.id, order);
    if (this.isBrowser()) {
      try {
        localStorage.setItem(this.getSaleOverrideKey(order.id), JSON.stringify(order));
      } catch (e) {
        console.warn('Failed to persist sale override', e);
      }
    }
  }

  private getSaleOverride(saleId?: string | null): Order | undefined {
    if (!saleId) return undefined;
    if (this.salesOverrides.has(saleId)) {
      return this.salesOverrides.get(saleId);
    }
    if (this.isBrowser()) {
      try {
        const raw = localStorage.getItem(this.getSaleOverrideKey(saleId));
        if (raw) {
          const parsed = JSON.parse(raw);
          this.salesOverrides.set(saleId, parsed);
          return parsed;
        }
      } catch (e) {}
    }
    return undefined;
  }

  private removeSaleOverride(saleId?: string | null) {
    if (!saleId) return;
    this.salesOverrides.delete(saleId);
    if (this.isBrowser()) {
      try {
        localStorage.removeItem(this.getSaleOverrideKey(saleId));
      } catch (e) {}
    }
  }

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
        const mergedSales = (sales || []).map(sale => {
          const override = this.getSaleOverride(sale.id);
          if (override) {
            return {
              ...sale,
              ...override,
              items: override.items && override.items.length > 0 ? override.items : sale.items,
              totalAmount: override.totalAmount != null ? override.totalAmount : sale.totalAmount
            };
          }
          return sale;
        });

        this.sales.set(mergedSales);
        this.applyFilter();
        this.ensureProductsForSales(mergedSales);
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

    missingIds.forEach(id => {
      this.productService.getProductById(id).subscribe(prod => {
        if (prod) {
          this.products.update(list => {
            if (!list.some(p => p.id === prod.id || p.id?.toString() === prod.id.toString())) {
              return [...list, prod];
            }
            return list;
          });
          this.applyFilter();
        }
      });
    });
  }

  loadProducts() {
    this.productsLoading.set(true);
    this.productService.getProducts(0, 500, undefined, true).subscribe({
      next: (products) => {
        this.products.set(products);
        this.applyFilter();
        if (this.editDialogVisible() && this.editingSale()) {
          // Only update display metadata (discount banner), don't overwrite user-edited unit_price
          this.refreshEditItemMetadata();
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

  syncEditItems(sale: Order) {
    if (!sale.items || sale.items.length === 0) {
      this.editItems = [{ product_id: null, quantity: 1, unit_price: null, discount: 0, regular_price: null, unit_cost: null }];
      return;
    }

    const totalQty = sale.items.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1;
    const saleDiscount = sale.discountAmount || 0;

    this.editItems = sale.items.map(item => {
      const prodId = item.product?.id ? item.product.id.toString() : ((item as any).product_id ? (item as any).product_id.toString() : null);
      const prodName = item.product?.name || (item as any).name || (item as any).product_name || null;
      const prod = this.findProduct(prodId, prodName);

      const rawSoldPrice = (item as any).unit_price != null
        ? (item as any).unit_price
        : ((item as any).price != null ? (item as any).price : item.product?.price);
      const soldUnitPrice = rawSoldPrice != null ? Number(rawSoldPrice) : 0;
      const catalogPrice = prod ? (Number(prod.price) || 0) : 0;
      const catalogDiscount = prod ? this.getProductCatalogDiscount(prod) : 0;

      let unitPrice: number = soldUnitPrice;
      let discount: number = 0;
      let regularPrice: number | null = null;

      if (prod && catalogPrice > 0) {
        regularPrice = catalogPrice;
        if (catalogDiscount > 0 && (soldUnitPrice === 0 || soldUnitPrice === catalogPrice || soldUnitPrice === Math.max(0, catalogPrice - catalogDiscount))) {
          unitPrice = Math.max(0, catalogPrice - catalogDiscount);
          discount = catalogDiscount;
        } else if (catalogPrice > soldUnitPrice) {
          discount = Math.round((catalogPrice - soldUnitPrice) * 100) / 100;
          unitPrice = soldUnitPrice;
        } else {
          discount = 0;
          unitPrice = soldUnitPrice;
        }
      } else if (saleDiscount > 0) {
        const perUnitDiscount = Math.round((saleDiscount / totalQty) * 100) / 100;
        discount = perUnitDiscount;
        regularPrice = soldUnitPrice + perUnitDiscount;
        unitPrice = soldUnitPrice;
      } else {
        regularPrice = soldUnitPrice;
        discount = 0;
        unitPrice = soldUnitPrice;
      }

      // If product was not yet found in preloaded products, fetch it individually
      if (!prod && prodId) {
        this.productService.getProductById(prodId).subscribe(fetchedProd => {
          if (fetchedProd) {
            this.products.update(list => {
              if (!list.some(p => p.id === fetchedProd.id || p.id?.toString() === fetchedProd.id.toString())) {
                return [...list, fetchedProd];
              }
              return list;
            });
            const fetchedDiscount = this.getProductCatalogDiscount(fetchedProd);
            const fetchedPrice = Number(fetchedProd.price) || 0;
            const targetRow = this.editItems.find(r => r.product_id === prodId || r.product_id === fetchedProd.id);
            if (targetRow) {
              targetRow.regular_price = fetchedPrice;
              if (targetRow.unit_price === null || (fetchedDiscount > 0 && targetRow.unit_price === fetchedPrice)) {
                targetRow.unit_price = fetchedDiscount > 0 ? Math.max(0, fetchedPrice - fetchedDiscount) : targetRow.unit_price;
              }
              const currentUnit = targetRow.unit_price || 0;
              if (fetchedPrice > currentUnit) {
                targetRow.discount = Math.round((fetchedPrice - currentUnit) * 100) / 100;
              } else if (fetchedDiscount > 0) {
                targetRow.discount = fetchedDiscount;
              } else {
                targetRow.discount = 0;
              }
            }
          }
        });
      }

      return {
        product_id: prod ? prod.id : prodId,
        quantity: item.quantity || 1,
        unit_price: unitPrice,
        discount: discount,
        regular_price: regularPrice,
        unit_cost: (item as any).unit_cost ?? (prod ? (prod.cost ?? null) : null)
      };
    });
  }

  /**
   * Updates display metadata (regular_price, discount) and initializes discounted unit_price
   * if the catalog product is on sale.
   */
  refreshEditItemMetadata() {
    for (const row of this.editItems) {
      if (!row.product_id) continue;
      const prod = this.findProduct(row.product_id);
      if (prod) {
        const catalogPrice = Number(prod.price) || 0;
        const catalogDiscount = this.getProductCatalogDiscount(prod);
        row.regular_price = catalogPrice;
        if (catalogDiscount > 0 && (row.unit_price === null || row.unit_price === catalogPrice)) {
          row.unit_price = Math.max(0, catalogPrice - catalogDiscount);
        }
        const currentUnit = row.unit_price || 0;
        if (catalogPrice > currentUnit) {
          row.discount = Math.round((catalogPrice - currentUnit) * 100) / 100;
        } else if (catalogDiscount > 0) {
          row.discount = catalogDiscount;
        } else {
          row.discount = 0;
        }
      }
    }
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
    this.editItems.push({ product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null });
  }

  removeItem(index: number) {
    if (this.editItems.length > 1) {
      this.editItems.splice(index, 1);
    } else {
      this.editItems[0] = { product_id: null, quantity: 1, unit_price: null, discount: 0, unit_cost: null };
    }
  }

  onProductSelect(row: SaleItemRow, productId: string) {
    const product = this.findProduct(productId);
    if (product) {
      row.product_id = product.id;
      const catalogPrice = Number(product.price) || 0;
      const catalogDiscount = this.getProductCatalogDiscount(product);
      row.regular_price = catalogPrice;
      row.discount = catalogDiscount;
      // Selling unit price in the input box is the discounted price if on discount, or catalog price
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

  getSaleItemEffectivePrice(item: any): number {
    const rawSoldPrice = (item as any).unit_price != null
      ? (item as any).unit_price
      : ((item as any).price_at_purchase != null
        ? (item as any).price_at_purchase
        : (item.product?.price != null ? item.product.price : (item as any).price));
    const soldUnitPrice = rawSoldPrice != null ? Number(rawSoldPrice) : 0;

    const prodId = item.product?.id ? item.product.id.toString() : ((item as any).product_id ? (item as any).product_id.toString() : null);
    const prodName = item.product?.name || (item as any).name || (item as any).product_name || null;
    const prod = this.findProduct(prodId, prodName) || (item.product && Number(item.product.price) > 0 ? (item.product as Product) : undefined);

    if (prod) {
      const catalogPrice = Number(prod.price) || 0;
      const catalogDiscount = this.getProductCatalogDiscount(prod);
      if (catalogDiscount > 0 && (soldUnitPrice === 0 || soldUnitPrice === catalogPrice || soldUnitPrice === Math.max(0, catalogPrice - catalogDiscount))) {
        return Math.max(0, catalogPrice - catalogDiscount);
      }
    }
    return soldUnitPrice;
  }

  getSaleTotal(sale: Order): number {
    if (sale.items && sale.items.length > 0) {
      const itemsSum = sale.items.reduce((sum, it) => {
        const p = this.getSaleItemEffectivePrice(it);
        return sum + (p * (it.quantity || 1));
      }, 0);
      return itemsSum + (sale.deliveryCharge || 0);
    }
    return sale.totalAmount || 0;
  }

  getSaleItemRegularPrice(item: any): number {
    const prodId = item.product?.id ? item.product.id.toString() : ((item as any).product_id ? (item as any).product_id.toString() : null);
    const prodName = item.product?.name || item.name || (item as any).product_name || null;
    const prod = this.findProduct(prodId, prodName) || (item.product && Number(item.product.price) > 0 ? (item.product as Product) : undefined);
    if (prod && Number(prod.price) > 0) {
      return Number(prod.price);
    }
    const soldP = this.getSaleItemEffectivePrice(item);
    const discount = (item as any).discount || 0;
    return soldP + discount;
  }

  getSaleRegularTotal(sale: Order): number {
    if (sale.items && sale.items.length > 0) {
      const itemsSum = sale.items.reduce((sum, it) => {
        const regP = this.getSaleItemRegularPrice(it);
        return sum + (regP * (it.quantity || 1));
      }, 0);
      return itemsSum + (sale.deliveryCharge || 0);
    }
    return (sale.totalAmount || 0) + (sale.discountAmount || 0);
  }

  getSaleTotalDiscount(sale: Order): number {
    const regular = this.getSaleRegularTotal(sale);
    const actual = this.getSaleTotal(sale);
    if (regular > actual) {
      return Math.round((regular - actual) * 100) / 100;
    }
    return sale.discountAmount || 0;
  }

  isSaleDiscounted(sale: Order): boolean {
    return this.getSaleTotalDiscount(sale) > 0;
  }

  getProductEffectivePrice(prod: Product | undefined | null): number {
    if (!prod) return 0;
    const catalogPrice = Number(prod.price) || 0;
    const discount = this.getProductCatalogDiscount(prod);
    return discount > 0 ? Math.max(0, catalogPrice - discount) : catalogPrice;
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
        unit_price: item.unit_price || 0,
        price: item.unit_price || 0,
        price_at_purchase: item.unit_price || 0,
        unit_cost: item.unit_cost ?? null
      })),
      total: this.grandTotal,
      total_amount: this.grandTotal,
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
      next: (updatedOrder) => {
        this.messageService.add({
          life: 3000,
          severity: 'success',
          summary: 'Sale Updated',
          detail: 'Offline sale has been updated successfully.'
        });
        this.editDialogVisible.set(false);

        const localItems = this.editItems.map(item => {
          const prod = this.findProduct(item.product_id);
          const unitP = item.unit_price || 0;
          return {
            product: {
              id: item.product_id || '',
              name: prod?.name || '',
              price: unitP,
              code: prod?.code || '',
              description: prod?.description || '',
              imageUrl: prod?.imageUrl || ''
            },
            quantity: item.quantity || 1,
            unit_price: unitP,
            unit_cost: item.unit_cost ?? null,
            product_id: item.product_id || ''
          };
        });

        const newGrandTotal = this.grandTotal;

        const mergedOrder: Order = {
          ...(updatedOrder || currentSale),
          id: currentSale.id,
          items: (updatedOrder && updatedOrder.items && updatedOrder.items.length > 0)
            ? updatedOrder.items.map((it, idx) => {
                const local = localItems[idx];
                return {
                  ...it,
                  unit_price: local ? local.unit_price : ((it as any).unit_price != null ? Number((it as any).unit_price) : 0),
                  quantity: it.quantity || (local ? local.quantity : 1)
                };
              })
            : (localItems as any),
          totalAmount: newGrandTotal,
          deliveryCharge: this.editDeliveryCharge || 0,
          paymentMethod: this.editPaymentMethod,
          orderDate: this.editSoldAt ? new Date(this.editSoldAt) : (currentSale.orderDate || new Date()),
          fullName: this.editCustomer.name || currentSale.fullName,
          phoneNumber: this.editCustomer.phone || currentSale.phoneNumber,
          district: this.editCustomer.district || currentSale.district,
          subDistrict: this.editCustomer.subdistrict || currentSale.subDistrict,
          fullAddress: this.editCustomer.address_line || currentSale.fullAddress
        };

        this.saveSaleOverride(mergedOrder);

        this.sales.update(currentList =>
          currentList.map(s => s.id === currentSale.id ? { ...s, ...mergedOrder } : s)
        );
        this.applyFilter();
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
        this.removeSaleOverride(saleId);
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
