import { Component, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { ProductService } from '../../../services/product.service';
import { Product, ProductImage } from '../../../models/product.model';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ChartModule } from 'primeng/chart';
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
    NotificationButtonComponent,
    TableModule,
    ButtonModule,
    CardModule,
    ToastModule,
    ConfirmDialogModule,
    ChartModule,
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

  categories = this.categoryService.categories;

  chartData: any;
  chartOptions: any;

  // Sales Summary Metrics
  totalUnitsSold = signal<number>(0);
  totalRevenue = signal<number>(0);
  confirmedOrdersCount = signal<number>(0);

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
    private orderService: OrderService,
    private categoryService: CategoryService,
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

        // Load chart data once if this is the first chunk (optional optimization to avoid reloading chart constantly)
        if (chunkStart === 0 && !this.chartData) {
          this.orderService.getOrders().subscribe({
            next: (orders) => this.updateChart(products, orders),
            error: () => { }
          });
        }
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
    this.chartData = null; // Reset chart data to refresh it
    const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
    this.loadProducts(event);
    this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Inventory updated' });
  }

  updateChart(products: Product[], orders: Order[]) {
    // Build salesMap purely from completed order items (not pre-seeded from inventory buffer)
    // Pre-seeding caused mismatches where order product names didn't match inventory names exactly
    const salesMap = new Map<string, number>();

    let units = 0;
    let revenue = 0;
    let completedCount = 0;

    orders.forEach(order => {
      if (order.status?.toLowerCase() === 'completed') {
        completedCount++;
        order.items.forEach(item => {
          const quantity = item.quantity || 0;
          const price = item.product?.price || 0;
          const name = item.product?.name || `Product #${item.product?.id}`;

          salesMap.set(name, (salesMap.get(name) || 0) + quantity);
          units += quantity;
          revenue += quantity * price;
        });
      }
    });

    this.totalUnitsSold.set(units);
    this.totalRevenue.set(revenue);
    this.confirmedOrdersCount.set(completedCount);

    // Sort by units sold descending
    const sortedEntries = Array.from(salesMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const productNames = sortedEntries.map(e => e[0]);
    const productSales = sortedEntries.map(e => e[1]);

    // Generate a distinct color per bar
    const palette = [
      'rgba(59, 130, 246, 0.7)',
      'rgba(16, 185, 129, 0.7)',
      'rgba(168, 85, 247, 0.7)',
      'rgba(245, 158, 11, 0.7)',
      'rgba(239, 68, 68, 0.7)',
      'rgba(14, 165, 233, 0.7)'
    ];
    const colors = productNames.map((_, i) => palette[i % palette.length]);

    this.chartData = {
      labels: productNames,
      datasets: [
        {
          label: 'Units Sold',
          data: productSales,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: productNames.length === 0
            ? 'No completed sales yet'
            : 'Top Selling Products (Units)',
          color: '#fff',
          font: { size: 14, weight: 'bold' }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => ` ${ctx.raw} units sold`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 12 } },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    };
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
            this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product Deleted', life: 3000 });
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
