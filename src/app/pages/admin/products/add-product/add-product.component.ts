import { Component, signal, ViewChildren, QueryList, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../core/services';;;
import { CategoryService } from '../../../../core/services';;;
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from 'primeng/editor';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule, Calendar } from 'primeng/calendar';
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
        DropdownModule,
        ButtonModule,
        ToastModule,
        DialogModule,
        ProgressSpinnerModule,
        CalendarModule,
        InventoryModalComponent
    ],

    styleUrl: './add-product.component.scss',
    templateUrl: './add-product.component.html'
})
export class AddProductComponent implements OnInit, OnDestroy {
    @ViewChildren(Calendar) calendars!: QueryList<Calendar>;
    private scrollListener: any;

    product = {
        name: '',
        description: '',
        price: null as number | null,
        cost: null as number | null,
        discount_type: null as string | null,
        discount_value: null as number | null,
        discount_starts_at: null as Date | string | null,
        discount_ends_at: null as Date | string | null
    };

    categories = signal<any[]>([]);
    selectedCategories: any[] = [];
    isPriceFocused = false;
    isCostFocused = false;
    loading = signal(false);
    savingStatus = signal('');
    discountPreview = signal<any>(null);
    productCreated = false;
    createdProductId: string | null = null;
    showInventoryModal = false;

    discountTypeOptions = [
        { label: 'No Discount', value: null },
        { label: 'Fixed Amount (BDT)', value: 'FIXED' }
    ];

    // Image handling
    selectedMainFile: File | null = null;
    selectedAdditionalFiles: File[] = [];
    mainImagePreview: string | null = null;
    additionalImagesPreview: string[] = [];

    constructor(
        private productService: ProductService,
        private categoryService: CategoryService,
        private messageService: MessageService,
        private router: Router,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
    }

    ngOnInit() {
        this.loadCategories();

        if (isPlatformBrowser(this.platformId)) {
            this.scrollListener = (event: Event) => {
                const target = event.target;
                const isContentScroll = (target instanceof HTMLElement && target.classList.contains('content-body')) ||
                    target === document ||
                    target === document.documentElement;
                if (isContentScroll) {
                    if (this.calendars) {
                        this.calendars.forEach(calendar => {
                            if (calendar.overlayVisible) {
                                calendar.hideOverlay();
                            }
                        });
                    }
                }
            };
            window.addEventListener('scroll', this.scrollListener, true);
        }
    }

    ngOnDestroy() {
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener, true);
        }
    }

    loadCategories() {
        this.categoryService.getCategories().subscribe(cats => {
            this.categories.set(cats);
        });
    }

    updateDiscountPreview() {
        if (!this.product.price || !this.product.discount_type || !this.product.discount_value) {
            this.discountPreview.set(null);
            return;
        }

        const payload = {
            discount_type: this.product.discount_type,
            discount_value: this.product.discount_value,
            discount_starts_at: this.product.discount_starts_at ? new Date(this.product.discount_starts_at).toISOString() : null,
            discount_ends_at: this.product.discount_ends_at ? new Date(this.product.discount_ends_at).toISOString() : null,
            price: this.product.price
        };

        this.productService.previewDiscount(payload).subscribe({
            next: (res) => {
                this.discountPreview.set(res);
            },
            error: (err) => {
                console.error('Discount preview error:', err);
                this.discountPreview.set(null);
            }
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
            this.savingStatus.set('Creating product metadata...');

            // 1. Create Product Metadata
            const productPayload: any = { 
                name: this.product.name,
                description: this.product.description,
                price: this.product.price,
                cost: this.product.cost,
                discount_type: this.product.discount_type,
                discount_value: this.product.discount_value,
                discount_starts_at: this.product.discount_starts_at ? new Date(this.product.discount_starts_at).toISOString() : null,
                discount_ends_at: this.product.discount_ends_at ? new Date(this.product.discount_ends_at).toISOString() : null
            };
            const createdProduct = await firstValueFrom(this.productService.addProduct(productPayload));
            this.createdProductId = createdProduct.id;
            const productId = this.createdProductId;

            console.log('Product Created with ID:', productId);

            // 2. Add Category Links
            if (this.selectedCategories && this.selectedCategories.length > 0) {
                this.savingStatus.set('Linking categories...');
                const categoryIds = this.selectedCategories.map(c => c.toString());
                if (categoryIds.length > 0) {
                    await firstValueFrom(this.productService.addMultipleCategoriesToProduct(productId, categoryIds));
                    console.log('Categories linked');
                }
            }

            // 3. Bulk Upload Images
            if (this.selectedMainFile) {
                console.log('Uploading images in bulk...');
                this.savingStatus.set('Uploading & processing images (resizing, optimizing)...');
                const uploadedImages = await firstValueFrom(
                    this.productService.bulkUploadImages(productId, this.selectedMainFile, this.selectedAdditionalFiles)
                );
                console.log('Bulk upload complete:', uploadedImages);
            } else if (this.selectedAdditionalFiles.length > 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Main image is required' });
                this.loading.set(false);
                this.savingStatus.set('');
                return;
            }

            this.productCreated = true;
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product created successfully' });
        } catch (error: any) {
            console.error('Error in product creation flow:', error);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to create product or upload images' });
        } finally {
            this.loading.set(false);
            this.savingStatus.set('');
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
            life: 2000
        });

        // Reset entire form for next product
        this.product = { 
            name: '', 
            description: '', 
            price: null,
            cost: null,
            discount_type: null,
            discount_value: null,
            discount_starts_at: null,
            discount_ends_at: null
        };
        this.discountPreview.set(null);
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
