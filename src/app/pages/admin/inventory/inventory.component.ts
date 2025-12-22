import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
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

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule,
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
    ProgressSpinnerModule
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

  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) { }

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.loading.set(true);
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products.set(products);
        this.updateChart();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  updateChart() {
    const productNames = this.products().map(p => p.name);
    const productPrices = this.products().map(p => p.price);

    this.chartData = {
      labels: productNames,
      datasets: [
        {
          label: 'Price',
          data: productPrices,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgb(75, 192, 192)',
          borderWidth: 1
        }
      ]
    };

    this.chartOptions = {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    };
  }

  openNew() {
    this.isNewProduct = true;
    this.productForm = {
      code: this.generateProductCode()
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
    this.displayProductDialog = true;
  }

  saveProduct() {
    if (this.isNewProduct) {
      this.productService.addProduct(this.productForm as Product).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Created' });
        this.loadProducts();
      });
    } else {
      this.productService.updateProduct(this.productForm as Product).subscribe(() => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product Updated' });
        this.loadProducts();
      });
    }
    this.displayProductDialog = false;
  }

  deleteProduct(product: Product) {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete ' + product.name + '?',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.productService.deleteProduct(product.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product Deleted', life: 3000 });
          this.loadProducts();
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
