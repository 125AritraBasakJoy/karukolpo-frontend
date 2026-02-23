import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { CategoryService } from '../../../../services/category.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { EditorModule } from 'primeng/editor';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Product, ProductImage } from '../../../../models/product.model';

@Component({
    selector: 'app-product-form',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        EditorModule,
        DropdownModule,
        TagModule,
        ToastModule,
        ProgressSpinnerModule,
        TooltipModule
    ],
    providers: [MessageService],
    templateUrl: './product-form.component.html',
    styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
    productId: string | null = null;
    isEditMode = false;
    loading = signal(false);
    saving = signal(false);

    product: Partial<Product> = {
        name: '',
        description: '',
        price: 0,
        categoryId: '',
        manualStockStatus: 'AUTO'
    };

    inventory = {
        stock: 0,
        manualStockStatus: 'AUTO' as 'AUTO' | 'IN_STOCK' | 'OUT_OF_STOCK'
    };

    categories = signal<any[]>([]);

    // Image handling
    selectedMainFile: File | null = null;
    selectedAdditionalFiles: File[] = [];
    mainImagePreview: string | null = null;
    additionalImagesPreviews: string[] = [];

    existingImages: ProductImage[] = [];
    deletedImageIds: number[] = [];
    newPrimaryImageId: number | null = null;

    stockStatusOptions = [
        { label: 'Auto (Based on Quantity)', value: 'AUTO' },
        { label: 'Force In Stock', value: 'IN_STOCK' },
        { label: 'Force Out of Stock', value: 'OUT_OF_STOCK' }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productService: ProductService,
        private categoryService: CategoryService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.productId = this.route.snapshot.paramMap.get('id');
        this.isEditMode = !!this.productId;

        this.loadCategories();
        if (this.isEditMode && this.productId) {
            this.loadProduct(this.productId);
        }
    }

    loadCategories() {
        this.categoryService.getCategories().subscribe(cats => {
            this.categories.set(cats);
        });
    }

    loadProduct(id: string) {
        this.loading.set(true);
        this.productService.getProductById(id, true).subscribe({
            next: (prod) => {
                if (prod) {
                    this.product = { ...prod };
                    this.inventory.stock = prod.stock || 0;
                    this.inventory.manualStockStatus = prod.manualStockStatus as any || 'AUTO';
                    this.mainImagePreview = prod.imageUrl;
                    this.existingImages = prod.imageObjects || [];

                    // Load categories for pre-selection
                    this.productService.listProductCategories(id).subscribe({
                        next: (cats) => {
                            if (cats && cats.length > 0) {
                                const firstCat = cats[0];
                                this.product.categoryId = typeof firstCat === 'object' ? firstCat.id?.toString() : firstCat.toString();
                            }
                            this.loading.set(false);
                        },
                        error: () => this.loading.set(false)
                    });
                } else {
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Product not found' });
                    this.router.navigate(['/admin/dashboard/inventory']);
                }
            },
            error: () => {
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product' });
            }
        });
    }

    onMainImageSelect(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedMainFile = file;
            const reader = new FileReader();
            reader.onload = (e: any) => this.mainImagePreview = e.target.result;
            reader.readAsDataURL(file);
        }
    }

    onAdditionalImagesSelect(event: any) {
        const files = event.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach((file: any) => {
                this.selectedAdditionalFiles.push(file);
                const reader = new FileReader();
                reader.onload = (e: any) => this.additionalImagesPreviews.push(e.target.result);
                reader.readAsDataURL(file);
            });
        }
    }

    removeAdditionalImage(index: number) {
        this.selectedAdditionalFiles.splice(index, 1);
        this.additionalImagesPreviews.splice(index, 1);
    }

    removeExistingImage(img: ProductImage) {
        this.deletedImageIds.push(Number(img.id));
        this.existingImages = this.existingImages.filter(i => i.id !== img.id);
        if (this.newPrimaryImageId === img.id) this.newPrimaryImageId = null;
    }

    setAsPrimary(img: ProductImage) {
        this.newPrimaryImageId = Number(img.id);
    }

    isImagePrimary(img: ProductImage): boolean {
        if (this.newPrimaryImageId !== null) return this.newPrimaryImageId === Number(img.id);
        return !!img.is_primary;
    }

    async save() {
        if (!this.product.name || this.product.price === undefined) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Name and Price are required' });
            return;
        }

        this.saving.set(true);
        try {
            let savedProduct: Product;

            // 1. Save Basic Info
            if (this.isEditMode && this.productId) {
                savedProduct = await firstValueFrom(this.productService.updateProduct({ ...this.product, id: this.productId } as Product));
            } else {
                savedProduct = await firstValueFrom(this.productService.addProduct(this.product as Product));
            }

            const pid = savedProduct.id;

            // 2. Save Category
            if (this.product.categoryId) {
                await firstValueFrom(this.productService.updateProductCategories(pid, [this.product.categoryId]));
            }

            // 3. Save Images
            if (!this.isEditMode) {
                if (this.selectedMainFile) {
                    await firstValueFrom(this.productService.bulkUploadImages(pid, this.selectedMainFile, this.selectedAdditionalFiles));
                }
            } else {
                const hasNewImages = this.selectedMainFile !== null || this.selectedAdditionalFiles.length > 0;
                const hasDeletes = this.deletedImageIds.length > 0;
                const hasNewPrimary = this.newPrimaryImageId !== null;

                if (hasNewImages || hasDeletes || hasNewPrimary) {
                    await firstValueFrom(this.productService.batchUpdateImages(
                        pid,
                        hasNewPrimary ? this.newPrimaryImageId : undefined,
                        this.selectedMainFile || undefined,
                        this.selectedAdditionalFiles.length > 0 ? this.selectedAdditionalFiles : undefined,
                        this.deletedImageIds.length > 0 ? this.deletedImageIds : undefined
                    ));
                }
            }

            // 4. Save Inventory
            const inventoryObs = this.productService.updateInventory(pid, this.inventory.stock);
            const statusUpdate: Product = { ...savedProduct, manualStockStatus: this.inventory.manualStockStatus };
            const statusObs = this.productService.updateProduct(statusUpdate);

            await firstValueFrom(forkJoin([inventoryObs, statusObs]));

            this.messageService.add({ severity: 'success', summary: 'Success', detail: `Product ${this.isEditMode ? 'updated' : 'created'} successfully` });

            setTimeout(() => {
                this.router.navigate(['/admin/dashboard/inventory']);
            }, 1500);

        } catch (error: any) {
            console.error('Save failed:', error);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: error.message || 'Failed to save product' });
        } finally {
            this.saving.set(false);
        }
    }

    cancel() {
        this.router.navigate(['/admin/dashboard/inventory']);
    }
}
