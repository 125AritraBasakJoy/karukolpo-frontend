import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ProductService } from '../../../services/product.service';
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
import { DropdownModule } from 'primeng/dropdown';
import { forkJoin, map, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

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
    DropdownModule,
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

  // Dialog state
  inventoryDialogVisible = false;
  selectedProduct: Product | null = null;
  inventoryForm = {
    stock: 0,
    manualStockStatus: 'AUTO' as 'AUTO' | 'IN_STOCK' | 'OUT_OF_STOCK'
  };





  manualStockOptions = [
    { label: 'Auto (Based on Quantity)', value: 'AUTO' },
    { label: 'In Stock (Force)', value: 'IN_STOCK' },
    { label: 'Out of Stock (Force)', value: 'OUT_OF_STOCK' }
  ];

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



  loadProducts(event?: TableLazyLoadEvent) {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loading.set(true);

    const lazyEvent = event || this.lastLazyLoadEvent || { first: 0, rows: 10 };
    this.lastLazyLoadEvent = lazyEvent;

    const first = lazyEvent.first || 0;
    const rows = lazyEvent.rows || 10;

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
    this.totalRecords.set(0);

    const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
    this.loadProducts(event);
    this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Inventory updated' });
  }






  editProduct(product: Product) {
    this.router.navigate(['/admin/dashboard/inventory/edit', product.id]);
  }

  manageInventory(product: Product) {
    this.selectedProduct = product;
    this.inventoryForm.stock = product.stock || 0;
    this.inventoryForm.manualStockStatus = product.manualStockStatus || 'AUTO';
    this.inventoryDialogVisible = true;
  }

  saveInventoryUpdate() {
    if (!this.selectedProduct) return;

    this.savingInventory.set(true);
    const productId = this.selectedProduct.id;

    // Update both quantity and manual status
    const updateInventory = this.productService.updateInventory(productId, this.inventoryForm.stock);
    const updateProductDetails = this.productService.updateProduct({
      ...this.selectedProduct,
      manualStockStatus: this.inventoryForm.manualStockStatus
    } as Product);

    forkJoin([updateInventory, updateProductDetails]).subscribe({
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
