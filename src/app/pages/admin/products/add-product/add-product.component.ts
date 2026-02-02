import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { CategoryService } from '../../../../services/category.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InventoryModalComponent } from '../inventory-modal/inventory-modal.component';

@Component({
    selector: 'app-add-product',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        InputTextareaModule,
        InputNumberModule,
        DropdownModule,
        ButtonModule,
        FileUploadModule,
        ToastModule,
        DialogModule,
        InventoryModalComponent
    ],
    providers: [MessageService],
    template: `
    <div class="card">
      <h2 class="mb-4">Add New Product</h2>
      
      <div class="p-fluid grid formgrid">
        <!-- Name -->
        <div class="field col-12 md:col-6">
          <label for="name">Name</label>
          <input type="text" pInputText id="name" [(ngModel)]="product.name" required>
        </div>

        <!-- Category -->
        <div class="field col-12 md:col-6">
          <label for="category">Category</label>
          <p-dropdown 
            [options]="categories()" 
            [(ngModel)]="selectedCategory" 
            optionLabel="name" 
            optionValue="id"
            placeholder="Select a Category"
            [showClear]="true"
            (onChange)="onCategoryChange($event)">
          </p-dropdown>
        </div>

        <!-- Description -->
        <div class="field col-12">
          <label for="description">Description</label>
          <textarea pInputTextarea id="description" [(ngModel)]="product.description" rows="4"></textarea>
        </div>

        <!-- Price -->
        <div class="field col-12 md:col-4">
          <label for="price">Price</label>
          <p-inputNumber id="price" [(ngModel)]="product.price" mode="currency" currency="BDT" locale="en-BD"></p-inputNumber>
        </div>

        <!-- Main Product Image -->
        <div class="field col-12 md:col-4">
          <label>Product Image</label>
          <!-- Using basic file input for now, ideally integrate with a file upload service -->
          <div class="flex align-items-center gap-2">
            <input type="file" (change)="onMainImageSelect($event)" accept="image/*" class="w-full">
            <img *ngIf="mainImagePreview" [src]="mainImagePreview" alt="Preview" class="w-3rem h-3rem border-round">
          </div>
        </div>

        <!-- Additional Images -->
        <div class="field col-12 md:col-4">
          <label>Additional Image</label>
          <div class="flex align-items-center gap-2">
             <input type="file" (change)="onAdditionalImageSelect($event)" accept="image/*" multiple class="w-full">
          </div>
           <div *ngIf="additionalImagesPreview.length" class="flex gap-2 mt-2">
              <img *ngFor="let img of additionalImagesPreview" [src]="img" alt="Preview" class="w-3rem h-3rem border-round">
           </div>
        </div>
      </div>

      <div class="flex justify-content-end gap-2 mt-4">
        <p-button label="Cancel" icon="pi pi-times" styleClass="p-button-secondary" (click)="cancel()"></p-button>
        
        <!-- Create Button (Step 1) -->
        <p-button 
          label="Create Product" 
          icon="pi pi-check" 
          (click)="createProduct()" 
          [loading]="loading()" 
          *ngIf="!productCreated">
        </p-button>

        <!-- Next Button (Step 2 - Only visible after creation) -->
        <p-button 
          label="Next: Set Inventory" 
          icon="pi pi-arrow-right" 
          (click)="openInventoryModal()" 
          severity="success"
          *ngIf="productCreated">
        </p-button>
      </div>
    </div>

    <app-inventory-modal
        [visible]="showInventoryModal"
        [productId]="createdProductId!"
        (closed)="onInventoryModalClose()"
        (saved)="onInventorySaved()">
    </app-inventory-modal>
    
    <p-toast></p-toast>
  `
})
export class AddProductComponent {
    product = {
        name: '',
        description: '',
        categoryId: '',
        price: 0,
        imageUrl: '',
        images: [] as string[]
    };

    categories = signal<any[]>([]);
    selectedCategory: string | null = null;
    loading = signal(false);
    productCreated = false;
    createdProductId: number | null = null;
    showInventoryModal = false;

    mainImagePreview: string | null = null;
    additionalImagesPreview: string[] = [];

    constructor(
        private productService: ProductService,
        private categoryService: CategoryService,
        private messageService: MessageService,
        private router: Router
    ) {
        this.loadCategories();
    }

    loadCategories() {
        this.categoryService.getCategories().subscribe(cats => {
            this.categories.set(cats);
        });
    }

    onCategoryChange(event: any) {
        this.product.categoryId = event.value;
    }

    onMainImageSelect(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.readFile(file).then(base64 => {
                this.product.imageUrl = base64 as string;
                this.mainImagePreview = base64 as string;
            });
        }
    }

    onAdditionalImageSelect(event: any) {
        const files = event.target.files;
        if (files) {
            this.product.images = [];
            this.additionalImagesPreview = [];
            Array.from(files).forEach((file: any) => {
                this.readFile(file).then(base64 => {
                    this.product.images.push(base64 as string);
                    this.additionalImagesPreview.push(base64 as string);
                })
            });
        }
    }

    readFile(file: File): Promise<string | ArrayBuffer | null> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    createProduct() {
        if (!this.product.name || !this.product.price) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Name and Price are required' });
            return;
        }

        this.loading.set(true);
        // map to Product interface expected by service
        const newProduct: any = {
            ...this.product
        };

        this.productService.addProduct(newProduct).subscribe({
            next: (res) => {
                this.loading.set(false);
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product created successfully' });
                this.productCreated = true;
                this.createdProductId = parseInt(res.id); // Assuming ID is returned
            },
            error: (err) => {
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create product' });
                console.error(err);
            }
        });
    }

    openInventoryModal() {
        this.showInventoryModal = true;
    }

    onInventoryModalClose() {
        this.showInventoryModal = false;
    }

    onInventorySaved() {
        this.showInventoryModal = false;
        this.router.navigate(['/admin/products']); // Or wherever list is
    }

    cancel() {
        this.router.navigate(['/admin/dashboard']);
    }
}
