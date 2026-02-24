import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../../services/product.service';
import { CategoryService } from '../../../../services/category.service';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from 'primeng/editor';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { Product, ProductImage } from '../../../../models/product.model';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ValidationMessageComponent } from '../../../../components/validation-message/validation-message.component';

@Component({
    selector: 'app-edit-product',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        EditorModule,
        InputNumberModule,
        DropdownModule,
        ButtonModule,
        ToastModule,
        TagModule,
        ProgressSpinnerModule,
        ValidationMessageComponent,
        TooltipModule
    ],

    templateUrl: './edit-product.component.html',
    styleUrls: ['./edit-product.component.scss']
})
export class EditProductComponent implements OnInit {
    productId: number | null = null;
    product = signal<Product | null>(null);
    loading = signal<boolean>(false);
    saving = signal<boolean>(false);

    productForm: Partial<Product> = {};
    inventoryForm = {
        stock: 0,
        manualStockStatus: 'AUTO' as 'AUTO' | 'IN_STOCK' | 'OUT_OF_STOCK'
    };

    categories = this.categoryService.categories;
    manualStockOptions = [
        { label: 'Auto (Based on Quantity)', value: 'AUTO' },
        { label: 'In Stock (Force)', value: 'IN_STOCK' },
        { label: 'Out of Stock (Force)', value: 'OUT_OF_STOCK' }
    ];

    // Image handling
    selectedMainImage: File | null = null;
    selectedAdditionalImages: File[] = [];
    mainImagePreview: string | null = null;
    additionalImagesPreviews: string[] = [];

    existingImages: ProductImage[] = [];
    deletedImageIds: number[] = [];
    initialPrimaryId: number | null = null;
    newPrimaryImageId: number | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productService: ProductService,
        private categoryService: CategoryService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            this.productId = parseInt(idParam, 10);
            this.loadProductData();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Product ID' });
            this.router.navigate(['/admin/dashboard/inventory']);
        }
    }

    loadProductData() {
        if (!this.productId) return;
        this.loading.set(true);

        this.productService.getProductById(this.productId).subscribe({
            next: (product) => {
                if (!product) return;
                this.product.set(product);
                this.productForm = { ...product };
                this.inventoryForm.stock = product.stock || 0;
                this.inventoryForm.manualStockStatus = product.manualStockStatus || 'AUTO';
                this.existingImages = product.imageObjects ? [...product.imageObjects] : [];
                const currentPrimary = this.existingImages.find(img => img.is_primary);
                this.initialPrimaryId = currentPrimary ? Number(currentPrimary.id) : null;
                this.newPrimaryImageId = null;
                this.mainImagePreview = product.imageUrl || null;

                // Fetch product categories
                this.productService.listProductCategories(this.productId!).subscribe({
                    next: (productCategories) => {
                        if (productCategories && productCategories.length > 0) {
                            const firstCat = productCategories[0];
                            this.productForm.categoryId = typeof firstCat === 'object' ? firstCat.id?.toString() : firstCat.toString();
                        }
                    },
                    error: (err) => console.error('Error fetching product categories:', err)
                });

                this.loading.set(false);
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product' });
                this.loading.set(false);
                this.router.navigate(['/admin/dashboard/inventory']);
            }
        });
    }

    onMainImageSelected(event: any) {
        const file = event?.target?.files?.[0] || event?.files?.[0];
        if (file) {
            this.selectedMainImage = file;
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.mainImagePreview = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    onAdditionalImagesSelected(event: any) {
        const files = event?.target?.files || event?.files;
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.selectedAdditionalImages.push(file);
                const reader = new FileReader();
                reader.onload = (e: any) => {
                    this.additionalImagesPreviews.push(e.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
    }

    removeNewAdditionalImage(index: number) {
        this.additionalImagesPreviews.splice(index, 1);
        this.selectedAdditionalImages.splice(index, 1);
    }

    removeExistingImage(img: ProductImage) {
        this.deletedImageIds.push(img.id);
        this.existingImages = this.existingImages.filter(i => i.id !== img.id);
        if (this.newPrimaryImageId === img.id) {
            this.newPrimaryImageId = null;
        }
    }

    setAsPrimary(img: ProductImage) {
        this.newPrimaryImageId = img.id;
    }

    isImagePrimary(img: ProductImage): boolean {
        if (this.newPrimaryImageId !== null) {
            return this.newPrimaryImageId === img.id;
        }
        return !!img.is_primary;
    }

    async saveAndFinish() {
        if (!this.productForm.name?.trim()) {
            this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Product Name is required' });
            return;
        }
        if (this.productForm.price === undefined || this.productForm.price === null) {
            this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Price is required' });
            return;
        }

        this.saving.set(true);
        const productId = this.productId!;

        try {
            // 1. Update Basic Details
            await firstValueFrom(this.productService.updateProduct({
                ...this.productForm,
                manualStockStatus: this.inventoryForm.manualStockStatus
            } as Product));

            // 2. Handle Category Linking
            if (this.productForm.categoryId) {
                await firstValueFrom(this.productService.addCategoryToProduct(productId, parseInt(this.productForm.categoryId, 10)));
            }

            // 3. Handle Images
            const hasNewImages = this.selectedMainImage !== null || this.selectedAdditionalImages.length > 0;
            const hasDeletes = this.deletedImageIds.length > 0;
            const hasNewPrimary = this.newPrimaryImageId !== null && this.newPrimaryImageId !== this.initialPrimaryId;

            if (hasNewImages || hasDeletes || hasNewPrimary) {
                if (!hasNewImages && !hasDeletes && hasNewPrimary) {
                    await firstValueFrom(this.productService.setPrimaryImage(productId, this.newPrimaryImageId!));
                } else {
                    await firstValueFrom(this.productService.batchUpdateImages(
                        productId,
                        hasNewPrimary ? this.newPrimaryImageId : undefined,
                        this.selectedMainImage || undefined,
                        this.selectedAdditionalImages.length > 0 ? this.selectedAdditionalImages : undefined,
                        this.deletedImageIds.length > 0 ? this.deletedImageIds : undefined
                    ));
                }
            }

            // 4. Update Inventory
            await firstValueFrom(this.productService.updateInventory(productId, this.inventoryForm.stock));

            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product updated successfully' });
            setTimeout(() => {
                this.router.navigate(['/admin/dashboard/inventory']);
            }, 1500);

        } catch (err: any) {
            console.error('Error saving product:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to save product' });
        } finally {
            this.saving.set(false);
        }
    }

    cancel() {
        this.router.navigate(['/admin/dashboard/inventory']);
    }
}
