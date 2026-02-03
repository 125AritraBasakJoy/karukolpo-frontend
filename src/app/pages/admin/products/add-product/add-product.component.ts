import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { CategoryService } from '../../../../services/category.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InventoryModalComponent } from '../inventory-modal/inventory-modal.component';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
    selector: 'app-add-product',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        InputTextarea,
        InputNumberModule,
        DropdownModule,
        ButtonModule,
        ToastModule,
        DialogModule,
        InventoryModalComponent
    ],
    providers: [MessageService],
    template: `
    <div class="card p-4">
      <h2 class="text-3xl font-bold mb-6">Add New Product</h2>
      
      <div class="flex flex-column gap-4">
        <!-- Row 1: Name and Category -->
        <div class="flex flex-column md:flex-row gap-3">
            <div class="flex-1">
                <label for="name" class="block font-bold mb-2">Name</label>
                <input type="text" pInputText id="name" [(ngModel)]="product.name" required placeholder="Enter product name" class="w-full">
            </div>

            <div class="flex-1">
                <label for="category" class="block font-bold mb-2">Category</label>
                <p-dropdown 
                    [options]="categories()" 
                    [(ngModel)]="selectedCategory" 
                    optionLabel="name" 
                    optionValue="id"
                    placeholder="Select a Category"
                    [showClear]="true"
                    (onChange)="onCategoryChange($event)"
                    styleClass="w-full">
                </p-dropdown>
            </div>
        </div>

        <!-- Row 2: Description -->
        <div class="w-full">
            <label for="description" class="block font-bold mb-2">Description</label>
            <textarea pInputTextarea id="description" [(ngModel)]="product.description" rows="4" class="w-full" placeholder="Tell us about the product..."></textarea>
        </div>

        <!-- Row 3: Price and Image Uploads -->
        <div class="grid">
            <div class="col-12 md:col-4">
                <label for="price" class="block font-bold mb-2">Price (BDT)</label>
                <p-inputNumber id="price" [(ngModel)]="product.price" mode="currency" currency="BDT" locale="en-BD" styleClass="w-full" inputStyleClass="w-full" [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}"></p-inputNumber>
            </div>

            <div class="col-12 md:col-4">
                <label class="block font-bold mb-2">Main Product Image</label>
                <div class="flex flex-column gap-2">
                    <input type="file" #mainFileInput (change)="onMainImageSelect($event)" accept="image/*" class="hidden" />
                    <button pButton type="button" label="Choose Image" icon="pi pi-image" class="p-button-outlined w-full" (click)="mainFileInput.click()"></button>
                    
                    <div *ngIf="mainImagePreview" class="mt-2 p-2 border-round surface-section border-1 border-50 text-center">
                        <img [src]="mainImagePreview" alt="Preview" class="max-w-full h-8rem border-round shadow-2 object-contain">
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-4">
                <label class="block font-bold mb-2">Additional Images</label>
                <div class="flex flex-column gap-2">
                    <input type="file" #addFileInput (change)="onAdditionalImageSelect($event)" accept="image/*" multiple class="hidden" />
                    <button pButton type="button" label="Add More" icon="pi pi-images" class="p-button-outlined p-button-secondary w-full" (click)="addFileInput.click()"></button>
                    
                    <div *ngIf="additionalImagesPreview.length" class="flex flex-wrap gap-2 mt-2 p-2 border-round surface-section border-1 border-50">
                        <div *ngFor="let img of additionalImagesPreview; let i = index" class="relative">
                            <img [src]="img" alt="Preview" class="w-4rem h-4rem border-round shadow-1 object-cover">
                            <button pButton icon="pi pi-times" class="p-button-rounded p-button-danger p-button-text absolute top-0 right-0 w-2rem h-2rem" (click)="removeAdditionalImage(i)"></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div class="flex justify-content-end gap-3 mt-5 pt-3 border-top-1 border-100">
        <p-button label="Cancel" icon="pi pi-times" [text]="true" severity="secondary" (click)="cancel()" size="small"></p-button>
        
        <!-- Create Button (Step 1) -->
        <p-button 
          label="Create Product" 
          icon="pi pi-check" 
          (click)="createProduct()" 
          [loading]="loading()" 
          *ngIf="!productCreated"
          size="small">
        </p-button>

        <!-- Next Button (Step 2 - Only visible after creation) -->
        <p-button 
          label="Next: Set Inventory" 
          icon="pi pi-arrow-right" 
          (click)="openInventoryModal()" 
          *ngIf="productCreated"
          size="small">
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
        price: 0
    };

    categories = signal<any[]>([]);
    selectedCategory: string | null = null;
    loading = signal(false);
    productCreated = false;
    createdProductId: number | null = null;
    showInventoryModal = false;

    // Image handling
    selectedMainFile: File | null = null;
    selectedAdditionalFiles: File[] = [];
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
            this.selectedMainFile = file;
            this.readFile(file).then(base64 => {
                this.mainImagePreview = base64 as string;
            });
        }
    }

    onAdditionalImageSelect(event: any) {
        const files = event.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach((file: any) => {
                this.selectedAdditionalFiles.push(file);
                this.readFile(file).then(base64 => {
                    this.additionalImagesPreview.push(base64 as string);
                });
            });
        }
    }

    removeAdditionalImage(index: number) {
        this.selectedAdditionalFiles.splice(index, 1);
        this.additionalImagesPreview.splice(index, 1);
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

        // 1. Create Product
        this.productService.addProduct(this.product as any).pipe(
            switchMap((createdProduct) => {
                this.createdProductId = parseInt(createdProduct.id);
                const productId = this.createdProductId;
                const tasks = [];

                // 2. Link Category if selected
                if (this.selectedCategory) {
                    tasks.push(
                        this.productService.addCategoryToProduct(productId, parseInt(this.selectedCategory, 10))
                            .pipe(catchError(err => of({ error: 'category', err })))
                    );
                }

                // 3. Upload Main Image
                if (this.selectedMainFile) {
                    tasks.push(
                        this.productService.addImage(productId, this.selectedMainFile).pipe(
                            switchMap(img => {
                                if (img && img.id) {
                                    return this.productService.setPrimaryImage(productId, img.id);
                                }
                                return of(null);
                            }),
                            catchError(err => of({ error: 'main_image', err }))
                        )
                    );
                }

                // 4. Upload Additional Images
                this.selectedAdditionalFiles.forEach(file => {
                    tasks.push(
                        this.productService.addImage(productId, file)
                            .pipe(catchError(err => of({ error: 'additional_image', err })))
                    );
                });

                return forkJoin(tasks.length ? tasks : [of(null)]);
            })
        ).subscribe({
            next: (results) => {
                this.loading.set(false);
                this.productCreated = true;

                // Check for partial failures
                const errors = (results as any[]).filter(r => r && r.error);
                if (errors.length > 0) {
                    this.messageService.add({ severity: 'warn', summary: 'Partial Success', detail: 'Product created but some images/category failed.' });
                } else {
                    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product created successfully' });
                }
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
        this.router.navigate(['/admin/products']);
    }

    cancel() {
        this.router.navigate(['/admin/dashboard']);
    }
}
