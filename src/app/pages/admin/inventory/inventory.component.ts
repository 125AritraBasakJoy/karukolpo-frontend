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
    TagModule
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

  stockChartData: any;
  stockChartOptions: any;

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

    // --- Stock Chart Logic ---
    // Calculate "Available" vs "Reserved" maybe? Or just Available stock distribution.
    // "Which product has how much quantity left based on order status"
    // Interpretation: Stock = product.stock - (Reserved in Pending/Approved orders).

    const stockMap = new Map<string, number>();
    products.forEach(p => stockMap.set(p.name, p.stock || 0));

    // Deduct reserved stock
    orders.forEach(order => {
      if (order.status === 'Pending' || order.status === 'Approved') {
        order.items.forEach(item => {
          const current = stockMap.get(item.product.name) || 0;
          stockMap.set(item.product.name, Math.max(0, current - item.quantity));
        });
      }
    });

    const stockLabels = Array.from(stockMap.keys());
    const stockValues = Array.from(stockMap.values());

    // Filter out zero stock for the pie chart to look nicer, or keep them?
    // Let's keep top 10 products with stock to avoid clutter
    const stockArray = Array.from(stockMap.entries())
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val);

    // Show all products now as per request "shows quantity for every single product not top 10 only"

    this.stockChartData = {
      labels: stockArray.map(i => i.name),
      datasets: [
        {
          data: stockArray.map(i => i.val),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#2ECC71', '#E74C3C', '#3498DB', '#F1C40F'
          ],
          hoverBackgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#2ECC71', '#E74C3C', '#3498DB', '#F1C40F'
          ]
        }
      ]
    };

    this.stockChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right', // Pie legend on right
        },
        title: {
          display: true,
          text: 'Current Stock Distribution (All Products)'
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
