import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ValidationMessageComponent } from '../../../components/validation-message/validation-message.component';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { FileUploadModule } from 'primeng/fileupload';
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
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    FormsModule,
    ToastModule,
    ConfirmDialogModule,
    ChartModule,
    CardModule,
    CardModule,
    ProgressSpinnerModule,
    ValidationMessageComponent,
    DropdownModule,
    TagModule,
    SkeletonModule,
    FileUploadModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  products = signal<Product[]>([]);
  loading = signal<boolean>(false);

  // Dialog States for 3-Step Wizard
  displayStep1 = false; // Basic Details
  displayStep2 = false; // Media & Category
  displayStep3 = false; // Inventory

  isNewProduct = true;
  selectedProduct: Product | null = null;
  createdProduct: Product | null = null; // Store product created in step 1
  categories: Category[] = [];

  productForm: Partial<Product> = {};
  inventoryForm: { stock: number; manualStockStatus: 'AUTO' | 'IN_STOCK' | 'OUT_OF_STOCK' } = {
    stock: 0,
    manualStockStatus: 'AUTO'
  };

  // File storage for uploads
  selectedMainImage: File | null = null;
  selectedAdditionalImages: File[] = [];

  chartData: any;
  chartOptions: any;

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
    private router: Router
  ) { }

  ngOnInit() {
    this.loadCategories();
    // loadProducts will be called by lazy load
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(cats => this.categories = cats);
  }

  loadProducts(event?: TableLazyLoadEvent) {
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
    const salesMap = new Map<string, number>();
    products.forEach(p => salesMap.set(p.name, 0));

    orders.forEach(order => {
      if (order.status !== 'Cancelled') {
        order.items.forEach(item => {
          const current = salesMap.get(item.product.name) || 0;
          salesMap.set(item.product.name, current + item.quantity);
        });
      }
    });

    const productNames = Array.from(salesMap.keys());
    const productSales = Array.from(salesMap.values());

    this.chartData = {
      labels: productNames,
      datasets: [
        {
          label: 'Units Sold',
          data: productSales,
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Product Sales Performance' }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    };
  }

  openNew() {
    this.isNewProduct = true;
    this.createdProduct = null;
    this.productForm = {
      images: [],
      manualStockStatus: 'AUTO'
    };
    this.inventoryForm.stock = 0;
    this.inventoryForm.manualStockStatus = 'AUTO';
    this.selectedMainImage = null;
    this.selectedAdditionalImages = [];

    // Start Step 1
    this.displayStep1 = true;
    this.displayStep2 = false;
    this.displayStep3 = false;
  }


  editProduct(product: Product) {
    this.isNewProduct = false;
    this.createdProduct = product; // Store current product
    this.productForm = { ...product };
    this.inventoryForm.stock = product.stock || 0;
    this.inventoryForm.manualStockStatus = product.manualStockStatus || 'AUTO';
    this.selectedMainImage = null;
    this.selectedAdditionalImages = [];

    if (!this.productForm.images) {
      this.productForm.images = [];
    }

    // Explicitly fetch product categories to ensure pre-selection
    const productId = product.id;
    this.productService.listProductCategories(productId).subscribe({
      next: (productCategories) => {
        if (productCategories && productCategories.length > 0) {
          // Take the first category ID
          const firstCat = productCategories[0];
          const catId = typeof firstCat === 'object' ? firstCat.id?.toString() : firstCat.toString();

          this.productForm.categoryId = catId;
          // Also update createdProduct so subsequent steps have the categoryId
          if (this.createdProduct) {
            this.createdProduct.categoryId = catId;
          }
        }
      },
      error: (err) => console.error('Error fetching product categories:', err)
    });

    this.displayStep1 = true;
    this.displayStep2 = false;
    this.displayStep3 = false;
  }

  manageInventory(product: Product) {
    this.createdProduct = product;
    this.inventoryForm.stock = product.stock || 0;
    this.inventoryForm.manualStockStatus = product.manualStockStatus || 'AUTO';
    this.displayStep3 = true; // Open Step 3 directly
  }

  // Step 1: Basic Details (Name, Description, Price)
  saveProductStep1() {
    if (!this.productForm.name?.trim()) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Product Name is required' });
      return;
    }
    if (this.productForm.price === undefined || this.productForm.price === null) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Price is required' });
      return;
    }

    if (this.isNewProduct) {
      this.productService.addProduct(this.productForm as Product).subscribe({
        next: (createdProduct) => {
          this.createdProduct = createdProduct;
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Created. Proceed to Category & Images.' });

          // Move to Step 2
          this.displayStep1 = false;
          this.displayStep2 = true;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
        }
      });
    } else {
      this.productService.updateProduct(this.productForm as Product).subscribe({
        next: (updatedProduct) => {
          this.createdProduct = updatedProduct;
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Updated.' });

          // Move to Step 2
          this.displayStep1 = false;
          this.displayStep2 = true;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
        }
      });
    }
  }

  // Step 2: Media & Category
  async saveProductStep2() {
    if (!this.createdProduct) return;
    const productId = this.createdProduct.id;

    try {
      // 1. Handle Category Linking
      if (this.productForm.categoryId) {
        try {
          await firstValueFrom(
            this.productService.addCategoryToProduct(productId, parseInt(this.productForm.categoryId, 10))
          );
          console.log('Category linked successfully');
        } catch (err) {
          console.error('Category linking failed:', err);
        }
      }

      // 2. Handle Bulk Image Upload (same flow as AddProduct)
      if (this.selectedMainImage) {
        console.log('Uploading images in bulk...');
        const uploadedImages = await firstValueFrom(
          this.productService.bulkUploadImages(productId, this.selectedMainImage, this.selectedAdditionalImages)
        );
        console.log('Bulk upload complete:', uploadedImages);
      } else if (this.selectedAdditionalImages.length > 0) {
        this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Main image is required for bulk upload' });
        return;
      }

      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Category & Images Saved. Proceed to Inventory.' });
      this.displayStep2 = false;
      this.displayStep3 = true;

    } catch (err) {
      console.error('Error in Step 2:', err);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save images. Please try again.' });
    }
  }

  // Step 3: Inventory
  saveInventory() {
    if (!this.createdProduct) return;

    const productId = this.createdProduct.id;
    const quantity = this.inventoryForm.stock;
    const manualStatus = this.inventoryForm.manualStockStatus;

    // 1. Update Inventory Quantity
    const inventoryObs = this.productService.updateInventory(productId, quantity).pipe(
      catchError(err => {
        // Don't swallow 401 — let ApiService handle token refresh
        if (err.status === 401) {
          throw err;
        }
        console.error('Inventory update error:', err);
        return of({ error: true, msg: 'Failed to update quantity', status: err.status });
      })
    );

    // 2. Update Product Status (Manual Stock Status)
    const productUpdate: Product = {
      ...this.createdProduct,
      manualStockStatus: manualStatus
    };

    const statusObs = this.productService.updateProduct(productUpdate).pipe(
      catchError(err => {
        // Don't swallow 401 — let ApiService handle token refresh
        if (err.status === 401) {
          throw err;
        }
        console.error('Status update error:', err);
        return of({ error: true, msg: 'Failed to update stock status', status: err.status });
      })
    );

    forkJoin([inventoryObs, statusObs]).subscribe({
      next: (results: any[]) => {
        const errors = results.filter(r => r && r.error);

        if (errors.length > 0) {
          this.messageService.add({ severity: 'warn', summary: 'Partial Update', detail: 'Some updates failed. Please check.' });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Inventory & Status Updated.' });
        }
        this.displayStep3 = false;
        this.refreshProducts();
      },
      error: (err) => {
        console.error('Error in Step 3:', err);
        if (err.status === 401) {
          this.messageService.add({ severity: 'error', summary: 'Session Expired', detail: 'Please log in again.' });
          this.router.navigate(['/admin/login']);
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Unexpected error occurred.' });
        }
      }
    });
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

  onFileSelected(event: any) {
    // Support both native file input (event.target.files) and PrimeNG (event.files)
    const file = event?.target?.files?.[0] || event?.files?.[0];
    if (file) {
      this.selectedMainImage = file;
      // Preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.productForm.imageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  onAdditionalFilesSelected(event: any) {
    // Support both native file input (event.target.files) and PrimeNG (event.files)
    const files = event?.target?.files || event?.files;
    if (files && files.length > 0) {
      if (!this.productForm.images) {
        this.productForm.images = [];
      }
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.selectedAdditionalImages.push(file);
        // Preview
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.productForm.images!.push(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  removeAdditionalImage(index: number) {
    this.productForm.images?.splice(index, 1);
    // Also remove from selected files if it was a new file
    // Note: This logic is imperfect if we are editing existing images mixed with new ones.
    // For simplicity in this wizard flow (new product), index matches.
    if (index < this.selectedAdditionalImages.length) {
      this.selectedAdditionalImages.splice(index, 1);
    }
  }
}
