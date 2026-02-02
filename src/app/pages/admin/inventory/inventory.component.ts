import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationMessageComponent } from '../../../components/validation-message/validation-message.component';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';
import { OrderService } from '../../../services/order.service';
import { Order } from '../../../models/order.model';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
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
import { forkJoin, map, catchError, of } from 'rxjs';

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
    InputTextareaModule,
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
    SkeletonModule
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

  constructor(
    private productService: ProductService,
    private orderService: OrderService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadProducts();
    this.loadCategories();
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe(cats => this.categories = cats);
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (products) => {
        if (products.length === 0) {
          this.products.set([]);
          this.loading.set(false);
          return;
        }

        const inventoryRequests = products.map(p => {
          const pid = parseInt(p.id, 10);
          return this.productService.getInventory(pid).pipe(
            map(inv => ({ ...p, stock: inv.quantity })),
            catchError(() => of(p))
          );
        });

        forkJoin(inventoryRequests).subscribe({
          next: (productsWithInventory: Product[]) => {
             this.products.set(productsWithInventory);
             this.orderService.getOrders().subscribe(orders => {
               this.updateChart(productsWithInventory, orders);
               this.loading.set(false);
             });
          },
          error: (err) => {
            console.error('Error fetching inventory details', err);
            this.products.set(products);
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  refreshProducts() {
    this.loadProducts();
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
      code: this.generateProductCode(),
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

  generateProductCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PROD-${timestamp}-${random}`;
  }

  editProduct(product: Product) {
    this.isNewProduct = false;
    this.createdProduct = product;
    this.productForm = { ...product };
    this.inventoryForm.stock = product.stock || 0;
    this.inventoryForm.manualStockStatus = product.manualStockStatus || 'AUTO';
    this.selectedMainImage = null;
    this.selectedAdditionalImages = [];
    
    if (!this.productForm.images) {
      this.productForm.images = [];
    }
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
  saveProductStep2() {
    if (!this.createdProduct) return;
    const productId = parseInt(this.createdProduct.id, 10);

    // 1. Handle Category Linking
    const categoryObservable = this.productForm.categoryId 
      ? this.productService.addCategoryToProduct(productId, parseInt(this.productForm.categoryId, 10)).pipe(
          catchError(err => {
            console.error('Category linking failed:', err);
            return of({ error: 'category', details: err });
          })
        )
      : of(null);

    // 2. Handle Image Uploads
    const imageUploads: any[] = [];
    
    if (this.selectedMainImage) {
      imageUploads.push(
        this.productService.addImage(productId, this.selectedMainImage).pipe(
          map(image => {
             if (image && image.id) {
               return this.productService.setPrimaryImage(productId, image.id);
             }
             return of(null);
          }),
          catchError(err => {
            console.error('Main image upload failed:', err);
            return of({ error: 'main_image', details: err });
          })
        )
      );
    }

    this.selectedAdditionalImages.forEach((file, index) => {
      imageUploads.push(
        this.productService.addImage(productId, file).pipe(
          catchError(err => {
            console.error(`Additional image ${index} upload failed:`, err);
            return of({ error: `additional_image_${index}`, details: err });
          })
        )
      );
    });

    // Execute all operations
    forkJoin([categoryObservable, ...imageUploads]).subscribe({
      next: (results) => {
        // Check if any result has an error
        const errors = results.filter(r => r && r.error);
        
        if (errors.length > 0) {
          console.warn('Some operations failed:', errors);
          this.messageService.add({ severity: 'warn', summary: 'Partial Success', detail: 'Product saved but some images/category failed. Check console for details.' });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Category & Images Saved. Proceed to Inventory.' });
        }
        
        this.displayStep2 = false;
        this.displayStep3 = true;
      },
      error: (err) => {
        // This shouldn't happen with catchError on inner observables, but just in case
        console.error('Critical error in Step 2:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Unexpected error occurred.' });
      }
    });
  }

  // Step 3: Inventory
  saveInventory() {
    if (!this.createdProduct) return;

    const productId = parseInt(this.createdProduct.id, 10);
    const quantity = this.inventoryForm.stock;

    console.log(`Saving inventory for product ${productId}:`, quantity);

    this.productService.updateInventory(productId, quantity).subscribe({
      next: (response) => {
        console.log('Inventory update response:', response);
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Inventory Updated. Product Setup Complete.' });
        this.displayStep3 = false;
        this.loadProducts(); // Refresh list
      },
      error: (err) => {
        console.error('Inventory update error:', err);
        let errorDetail = 'Failed to update inventory';
        if (err.error && err.error.detail) {
            errorDetail += ': ' + (typeof err.error.detail === 'string' ? err.error.detail : JSON.stringify(err.error.detail));
        } else if (err.message) {
            errorDetail += ': ' + err.message;
        }
        this.messageService.add({ severity: 'error', summary: 'Error', detail: errorDetail });
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
            this.loadProducts();
          },
          error: (err) => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
          }
        });
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
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
    const files = event.target.files;
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
