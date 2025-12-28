import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidationMessageComponent } from '../../../components/validation-message/validation-message.component';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
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
  displayProductDialog = false;
  isNewProduct = true;
  selectedProduct: Product | null = null;

  productForm: Partial<Product> = {};

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
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading.set(true);
    // ForkJoin to get both products and orders for the graph
    // But since we are inside a component, we can just chain subscription or use combineLatest if we were reactive.
    // Simpler here: Load products, then load orders to calculate sales.

    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);

        // Now load orders for graph
        this.orderService.getOrders().subscribe(orders => {
          this.updateChart(products, orders);
          this.loading.set(false);
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
    // Calculate sales per product
    const salesMap = new Map<string, number>();

    // Initialize with 0
    products.forEach(p => salesMap.set(p.name, 0));

    // Aggregate from orders
    orders.forEach(order => {
      if (order.status !== 'Deleted') {
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
          backgroundColor: 'rgba(54, 162, 235, 0.2)', // Blue
          borderColor: 'rgb(54, 162, 235)',
          borderWidth: 1
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Product Sales Performance'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    };


  }

  openNew() {
    this.isNewProduct = true;
    this.productForm = {
      code: this.generateProductCode(),
      images: [],
      manualStockStatus: 'AUTO'
    };
    this.displayProductDialog = true;
  }

  generateProductCode(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PROD-${timestamp}-${random}`;
  }

  editProduct(product: Product) {
    this.isNewProduct = false;
    this.productForm = { ...product };
    // Ensure images array is initialized if it was missing
    if (!this.productForm.images) {
      this.productForm.images = [];
    }
    this.displayProductDialog = true;
  }

  saveProduct() {
    if (!this.productForm.name?.trim()) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Product Name is required' });
      return;
    }
    if (this.productForm.price === undefined || this.productForm.price === null) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Price is required' });
      return;
    }

    // Ensure images array exists
    if (!this.productForm.images) {
      this.productForm.images = [];
    }

    // If main image is missing but we have gallery images, use the first one
    if (!this.productForm.imageUrl && this.productForm.images.length > 0) {
      this.productForm.imageUrl = this.productForm.images[0];
    }

    if (this.isNewProduct) {
      this.productService.addProduct(this.productForm as Product).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Created' });
          this.loadProducts();
          this.displayProductDialog = false;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
        }
      });
    } else {
      this.productService.updateProduct(this.productForm as Product).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Updated' });
          this.loadProducts();
          this.displayProductDialog = false;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message });
        }
      });
    }
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
  }
}
