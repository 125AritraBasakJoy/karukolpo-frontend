import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProductService } from '../../../core/services';
import { Product, ProductImage } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { FileUploadModule } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { Router } from '@angular/router';

/**
 * Normalizes text for bilingual search (English + Bangla)
 * - Converts Bengali numerals ০-৯ to 0-9
 * - Handles NFC unicode normalization for Bangla characters & diacritics
 * - Case-insensitive & trimmed
 */
function normalizeBilingualText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  let str = text.toString().normalize('NFC');
  
  // Convert Bangla digits ০-৯ to 0-9
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  for (let i = 0; i < 10; i++) {
    str = str.split(banglaDigits[i]).join(i.toString());
  }
  return str.toLowerCase().trim();
}

function matchesBilingualProduct(product: Product, query: string): boolean {
  if (!query) return true;
  const q = normalizeBilingualText(query);
  if (!q) return true;

  const name = normalizeBilingualText(product.name);
  const code = normalizeBilingualText(product.code);
  const id = normalizeBilingualText(product.id);
  const desc = normalizeBilingualText(product.description);
  const price = normalizeBilingualText(product.price);
  const stock = normalizeBilingualText(product.stock);

  // Status keywords in both Bangla and English
  const isStock = product.manualStockStatus === 'IN_STOCK' || (product.manualStockStatus !== 'OUT_OF_STOCK' && (product.isInStock || (product.stock !== undefined && product.stock > 0)));
  const statusBanglaEnglish = isStock
    ? 'in stock instock ইন স্টক ইনস্টক এভেইলেবল মজুদ আছে'
    : 'out of stock outofstock স্টক আউট অব স্টক শেষ মজুদ নেই';

  // Support multi-term/token search
  const tokens = q.split(/\s+/).filter(t => t.length > 0);
  return tokens.every(token =>
    name.includes(token) ||
    code.includes(token) ||
    id.includes(token) ||
    desc.includes(token) ||
    price.includes(token) ||
    stock.includes(token) ||
    statusBanglaEnglish.includes(token)
  );
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    CardModule,
    ToastModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    TagModule,
    SkeletonModule,
    FileUploadModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    FormsModule
  ],
  providers: [ConfirmationService],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  products = signal<Product[]>([]);
  loading = signal<boolean>(false);
  savingInventory = signal<boolean>(false);

  // Search state (Bangla + English)
  searchQuery = signal<string>('');
  isSearching = signal<boolean>(false);
  allProductsCache: Product[] = [];
  filteredProducts: Product[] = [];
  private searchDebounceTimer: any = null;

  // Dialog state
  inventoryDialogVisible = false;
  selectedProduct: Product | null = null;
  inventoryForm = {
    stock: 0
  };

  // Data Buffering
  productsBuffer: Product[] = [];
  totalRecords = signal<number>(0);
  lastLazyLoadEvent: TableLazyLoadEvent | null = null;
  readonly BUFFER_SIZE = 100;

  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    // loadProducts will be called by lazy load
  }



  onSearch(immediate: boolean = false) {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    const q = this.searchQuery().trim();
    if (!q) {
      this.clearSearch();
      return;
    }

    if (immediate) {
      this.performSearch(q);
    } else {
      this.searchDebounceTimer = setTimeout(() => {
        this.performSearch(q);
      }, 250);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.isSearching.set(false);
    this.filteredProducts = [];
    if (this.lastLazyLoadEvent) {
      this.loadProducts(this.lastLazyLoadEvent);
    } else {
      this.loadProducts({ first: 0, rows: 10 });
    }
  }

  private performSearch(query: string) {
    this.isSearching.set(true);
    this.loading.set(true);

    if (this.allProductsCache.length > 0) {
      this.applySearchFilter(query);
    } else {
      this.productService.getProducts(0, 1000, undefined, true).subscribe({
        next: (all) => {
          this.allProductsCache = all;
          this.applySearchFilter(query);
        },
        error: () => {
          this.allProductsCache = this.productsBuffer.filter(p => !!p);
          this.applySearchFilter(query);
        }
      });
    }
  }

  private applySearchFilter(query: string) {
    this.filteredProducts = this.allProductsCache.filter(p => matchesBilingualProduct(p, query));
    this.totalRecords.set(this.filteredProducts.length);

    const rows = this.lastLazyLoadEvent?.rows || 10;
    this.products.set(this.filteredProducts.slice(0, rows));
    this.loading.set(false);
  }

  loadProducts(event?: TableLazyLoadEvent) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loading.set(true);

    const lazyEvent = event || this.lastLazyLoadEvent || { first: 0, rows: 10 };
    this.lastLazyLoadEvent = lazyEvent;

    const first = lazyEvent.first || 0;
    const rows = lazyEvent.rows || 10;

    // If searching, serve from filtered results
    if (this.isSearching()) {
      this.products.set(this.filteredProducts.slice(first, first + rows));
      this.loading.set(false);
      return;
    }

    let dataMissing = false;
    for (let i = first; i < first + rows; i++) {
      if (!this.productsBuffer[i]) {
        dataMissing = true;
        break;
      }
    }

    if (!dataMissing) {
      const end = Math.min(first + rows, this.productsBuffer.length);
      const pageData = this.productsBuffer.slice(first, end);
      this.products.set(pageData);
      this.loading.set(false);
      return;
    }

    const chunkStart = Math.floor(first / this.BUFFER_SIZE) * this.BUFFER_SIZE;

    this.productService.getProducts(chunkStart, this.BUFFER_SIZE).subscribe({
      next: (products) => {
        products.forEach((item, index) => {
          this.productsBuffer[chunkStart + index] = item;
        });

        const currentTotal = chunkStart + products.length;
        if (products.length === this.BUFFER_SIZE) {
          this.totalRecords.set(currentTotal + 1);
        } else {
          this.totalRecords.set(currentTotal);
        }

        const end = Math.min(first + rows, this.productsBuffer.length);
        const pageData = this.productsBuffer.slice(first, end);
        this.products.set(pageData);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  refreshProducts() {
    this.productService.clearCache(); // Clear service-level cache to fetch fresh data from API
    this.productsBuffer = [];
    this.allProductsCache = [];
    this.totalRecords.set(0);

    if (this.isSearching() && this.searchQuery().trim()) {
      this.performSearch(this.searchQuery().trim());
    } else {
      const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
      this.loadProducts(event);
    }
    this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Inventory updated' });
  }






  editProduct(product: Product) {
    this.router.navigate(['/admin/dashboard/inventory/edit', product.id]);
  }

  manageInventory(product: Product) {
    this.selectedProduct = product;
    this.inventoryForm.stock = product.stock || 0;
    this.inventoryDialogVisible = true;
  }

  saveInventoryUpdate() {
    if (!this.selectedProduct) return;

    this.savingInventory.set(true);
    const productId = this.selectedProduct.id;

    this.productService.updateInventory(productId, this.inventoryForm.stock).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Inventory updated successfully' });
        this.inventoryDialogVisible = false;
        this.refreshProducts();
        this.savingInventory.set(false);
      },
      error: (err) => {
        console.error('Error updating inventory:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update inventory' });
        this.savingInventory.set(false);
      }
    });
  }

  closeInventoryDialog() {
    this.inventoryDialogVisible = false;
    this.selectedProduct = null;
  }


  deleteProduct(product: Product) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete ' + product.name + '?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.productService.deleteProduct(product.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product Deleted', life: 2000 });
            this.refreshProducts(); // Refresh list to update cache
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
          }
        });
      }
    });
  }

  isImagePrimary(img: ProductImage): boolean {
    return !!img.is_primary;
  }
}
