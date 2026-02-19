import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { CategoryService } from '../../../../services/category.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from 'primeng/editor';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InventoryModalComponent } from '../inventory-modal/inventory-modal.component';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

@Component({
    selector: 'app-add-product',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        EditorModule,
        InputNumberModule,
        MultiSelectModule,
        ButtonModule,
        ToastModule,
        DialogModule,
        InventoryModalComponent
    ],
    providers: [MessageService],
    styleUrl: './add-product.component.scss',
    template: `
    <div class="add-product-container p-4 min-h-screen">
        <div class="header-section mb-6">
            <h1 class="text-4xl font-bold m-0 tracking-tight text-white mb-2">Add New Product</h1>
            <p class="text-slate-400 m-0 text-lg">Create a new masterpiece for your collection.</p>
        </div>

        <div class="glass-card p-5 fadein animation-duration-500">
            <div class="flex flex-column gap-5">
                <!-- Row 1: Name and Category -->
                <div class="grid">
                    <div class="col-12 md:col-6">
                        <label for="name" class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Product Name</label>
                        <input type="text" pInputText id="name" [(ngModel)]="product.name" required 
                            placeholder="Enter product name" class="w-full premium-input">
                    </div>

                    <div class="col-12 md:col-6">
                        <label for="category" class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Categories</label>
                        <p-multiSelect 
                            [options]="categories()" 
                            [(ngModel)]="selectedCategories" 
                            optionLabel="name" 
                            optionValue="id"
                            placeholder="Select Categories"
                            [filter]="true"
                            filterBy="name"
                            styleClass="w-full premium-input"
                            [style]="{'width':'100%'}"
                            [panelStyle]="{'width':'100%'}"
                            display="chip"
                            appendTo="body">
                        </p-multiSelect>
                    </div>
                </div>

                <!-- Row 2: Description -->
                <div class="w-full">
                    <label for="description" class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                    <p-editor 
                        id="description"
                        [(ngModel)]="product.description"
                        [style]="{'height': '180px', 'background': 'transparent', 'color': 'inherit'}"
                        styleClass="premium-editor w-full">
                        <ng-template pTemplate="header">
                            <span class="ql-formats">
                                <button class="ql-bold" title="Bold"></button>
                                <button class="ql-italic" title="Italic"></button>
                                <button class="ql-underline" title="Underline"></button>
                            </span>
                            <span class="ql-formats">
                                <button class="ql-list" value="ordered" title="Ordered List"></button>
                                <button class="ql-list" value="bullet" title="Bullet List"></button>
                            </span>
                            <span class="ql-formats">
                                <button class="ql-link" title="Link"></button>
                                <button class="ql-clean" title="Remove Formatting"></button>
                            </span>
                        </ng-template>
                    </p-editor>
                </div>

                <!-- Row 3: Price and Image Uploads -->
                <div class="grid">
                    <div class="col-12 md:col-4">
                        <label for="price" class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Price (BDT)</label>
                        <div class="p-inputgroup premium-input-group w-full">
                            <span class="p-inputgroup-addon"></span>
                            <p-inputNumber id="price" [(ngModel)]="product.price" mode="decimal" [useGrouping]="true" 
                                [minFractionDigits]="isPriceFocused ? 0 : 2" [maxFractionDigits]="2"
                                (onFocus)="isPriceFocused = true" (onBlur)="isPriceFocused = false"
                                placeholder="0.00" styleClass="w-full" inputStyleClass="w-full premium-input" [style]="{'width':'100%'}"
                                inputmode="decimal"></p-inputNumber>
                        </div>
                    </div>

                    <div class="col-12 md:col-4">
                        <label class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Main Image</label>
                        <div class="flex flex-column gap-3">
                            <input type="file" #mainFileInput (change)="onMainImageSelect($event)" accept="image/*" class="hidden" />
                            <button pButton type="button" label="Select Primary" icon="pi pi-image" 
                                class="p-button-outlined premium-btn-secondary w-full" (click)="mainFileInput.click()"></button>
                            
                            <div *ngIf="mainImagePreview" class="relative group border-round-xl border-1 border-white-alpha-10 overflow-hidden surface-card h-12rem flex align-items-center justify-content-center">
                                <img [src]="mainImagePreview" alt="Preview" class="max-w-full h-full object-contain">
                                <div class="absolute inset-0 bg-black-alpha-40 flex align-items-center justify-content-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button pButton icon="pi pi-pencil" class="p-button-rounded p-button-text text-white" (click)="mainFileInput.click()"></button>
                                    <button pButton icon="pi pi-times" class="p-button-rounded p-button-danger p-button-text text-white ml-2" (click)="removeMainImage()"></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12 md:col-4">
                        <label class="block text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Additional Images</label>
                        <div class="flex flex-column gap-3">
                            <input type="file" #addFileInput (change)="onAdditionalImageSelect($event)" accept="image/*" multiple class="hidden" />
                            <button pButton type="button" label="Add Gallery Images" icon="pi pi-images" 
                                class="p-button-outlined premium-btn-secondary w-full" (click)="addFileInput.click()"></button>
                            
                            <div *ngIf="additionalImagesPreview.length" class="flex flex-wrap gap-2 p-2 border-round-xl border-1 border-white-alpha-10 surface-section min-h-5rem">
                                <div *ngFor="let img of additionalImagesPreview; let i = index" class="relative group">
                                    <img [src]="img" alt="Preview" class="w-4rem h-4rem border-round shadow-2 object-cover block">
                                    <div class="absolute inset-0 bg-red-500-alpha-40 flex align-items-center justify-content-center opacity-0 group-hover:opacity-100 transition-opacity border-round">
                                        <button pButton icon="pi pi-times" class="p-button-rounded p-button-danger p-button-text text-white w-2rem h-2rem" (click)="removeAdditionalImage(i)"></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-content-end gap-3 mt-6 pt-4 border-top-1 border-white-alpha-10">
                <button pButton label="Cancel" icon="pi pi-times" class="p-button-text p-button-secondary" (click)="cancel()"></button>
                
                <!-- Create Button -->
                <button pButton 
                  label="Create Product" 
                  icon="pi pi-check" 
                  (click)="createProduct()" 
                  [loading]="loading()" 
                  *ngIf="!productCreated"
                  class="premium-btn-primary px-5 shadow-4">
                </button>

                <!-- Next Button -->
                <button pButton 
                  label="Next: Set Inventory" 
                  icon="pi pi-arrow-right" 
                  (click)="openInventoryModal()" 
                  *ngIf="productCreated"
                  class="premium-btn-primary px-5 shadow-4">
                </button>
            </div>
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
        price: null as number | null
    };

    categories = signal<any[]>([]);
    selectedCategories: any[] = [];
    isPriceFocused = false;
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

    onMainImageSelect(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedMainFile = file;
            this.readFile(file).then(base64 => {
                this.mainImagePreview = base64 as string;
            });
        }
    }

    removeMainImage() {
        this.selectedMainFile = null;
        this.mainImagePreview = null;
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

    async createProduct() {
        if (!this.product.name || !this.product.price) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Name and Price are required' });
            return;
        }

        this.loading.set(true);
        try {
            console.log('Creating Product Metadata...');

            // 1. Create Product Metadata
            const productPayload: any = { ...this.product };
            const createdProduct = await firstValueFrom(this.productService.addProduct(productPayload));
            this.createdProductId = parseInt(createdProduct.id);
            const productId = this.createdProductId;

            console.log('Product Created with ID:', productId);

            // 2. Add Category Links
            if (this.selectedCategories && this.selectedCategories.length > 0) {
                const categoryIds = this.selectedCategories.map(c => parseInt(c.toString(), 10)).filter(id => !isNaN(id));
                if (categoryIds.length > 0) {
                    await firstValueFrom(this.productService.addMultipleCategoriesToProduct(productId, categoryIds));
                    console.log('Categories linked');
                }
            }

            // 3. Bulk Upload Images
            if (this.selectedMainFile) {
                console.log('Uploading images in bulk...');
                const uploadedImages = await firstValueFrom(
                    this.productService.bulkUploadImages(productId, this.selectedMainFile, this.selectedAdditionalFiles)
                );
                console.log('Bulk upload complete:', uploadedImages);
            } else if (this.selectedAdditionalFiles.length > 0) {
                // Pick first additional as primary if main is missing? 
                // Or show error. The user screenshot showed a primary image was selected.
                // Let's require the main image for now to satisfy the backend.
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Main image is required' });
                this.loading.set(false);
                return;
            }

            this.productCreated = true;
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product created successfully' });
        } catch (error) {
            console.error('Error in product creation flow:', error);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create product or upload images' });
        } finally {
            this.loading.set(false);
        }
    }

    openInventoryModal() {
        this.showInventoryModal = true;
    }

    onInventoryModalClose() {
        this.showInventoryModal = false;
    }

    onInventorySaved() {
        this.showInventoryModal = false;
        this.messageService.add({
            severity: 'success',
            summary: 'Product Complete!',
            detail: 'Product created and inventory set successfully. You can now add another product.',
            life: 4000
        });

        // Reset entire form for next product
        this.product = { name: '', description: '', price: null };
        this.selectedCategories = [];
        this.selectedMainFile = null;
        this.selectedAdditionalFiles = [];
        this.mainImagePreview = null;
        this.additionalImagesPreview = [];
        this.productCreated = false;
        this.createdProductId = null;
    }

    cancel() {
        this.router.navigate(['/admin/dashboard']);
    }
}
