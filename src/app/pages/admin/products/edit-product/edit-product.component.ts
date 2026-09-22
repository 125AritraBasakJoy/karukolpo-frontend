import { Component, OnInit, signal, ViewChildren, QueryList, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../../core/services';
import { CategoryService } from '../../../../core/services';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from 'primeng/editor';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule, Calendar } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { Product, ProductImage } from '../../../../models/product.model';
import { firstValueFrom, forkJoin, of, Subject } from 'rxjs';
import { catchError, map, switchMap, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ValidationMessageComponent } from '../../../../components/validation-message/validation-message.component';
import { SlugService, SlugSuggestionResponse, isValidBackendSlug, slugifyLocal } from '../../../../core/services/slug/slug.service';

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
        MultiSelectModule,
        DropdownModule,
        ButtonModule,
        ToastModule,
        TagModule,
        ProgressSpinnerModule,
        CalendarModule,
        ValidationMessageComponent,
        TooltipModule
    ],

    templateUrl: './edit-product.component.html',
    styleUrls: ['./edit-product.component.scss']
})
export class EditProductComponent implements OnInit, OnDestroy {
    @ViewChildren(Calendar) calendars!: QueryList<Calendar>;
    private scrollListener: any;

    productId: string | null = null;
    product = signal<Product | null>(null);
    loading = signal<boolean>(false);
    saving = signal<boolean>(false);
    savingStatus = signal<string>('');
    discountPreview = signal<any>(null);

    // URL name (slug) handling
    private slugInput$ = new Subject<string>();
    private nameInput$ = new Subject<string>();
    private destroy$ = new Subject<void>();
    originalSlug = '';
    slugTouched = false;
    slugChecking = signal(false);
    slugServerStatus = signal<SlugSuggestionResponse | null>(null);
    /** True when the availability check API is unreachable — the field still works manually. */
    slugServerUnavailable = signal(false);

    productForm: Partial<Product> = {};

    get currentDate(): Date {
        return new Date();
    }
    selectedCategoryIds: any[] = [];
    inventoryForm = {
        stock: 0
    };

    categories = this.categoryService.categories;
    discountTypeOptions = [
        { label: 'No Discount', value: null },
        { label: 'Fixed Amount (BDT)', value: 'FIXED' }
    ];

    // Image handling
    selectedMainImage: File | null = null;
    selectedAdditionalImages: File[] = [];
    mainImagePreview: string | null = null;
    additionalImagesPreviews: string[] = [];

    existingImages: ProductImage[] = [];
    deletedImageIds: string[] = [];
    initialPrimaryId: string | null = null;
    newPrimaryImageId: string | null = null;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private productService: ProductService,
        private categoryService: CategoryService,
        private slugService: SlugService,
        private messageService: MessageService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam) {
            this.productId = idParam;
            this.loadProductData();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Product ID' });
            this.router.navigate(['/admin/dashboard/inventory']);
        }

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

        // Admin edits the product name -> suggest a URL name
        this.nameInput$.pipe(
            debounceTime(450),
            distinctUntilChanged(),
            switchMap(name => {
                const trimmed = name?.trim() || '';
                if (this.slugTouched) {
                    return of(null);
                }
                if (!trimmed) {
                    this.productForm.slug = '';
                    this.slugServerStatus.set(null);
                    this.slugChecking.set(false);
                    return of(null);
                }
                this.slugChecking.set(true);
                return this.slugService.getSuggestion('product', { name: trimmed }).pipe(
                    map(res => ({ kind: 'success' as const, res, name: trimmed })),
                    catchError(() => of({ kind: 'error' as const, name: trimmed }))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(result => {
            if (!result || this.slugTouched) return;
            this.slugChecking.set(false);
            if (result.kind === 'success') {
                this.slugServerUnavailable.set(false);
                this.productForm.slug = result.res.suggestion || '';
                this.slugServerStatus.set(result.res);
            } else {
                this.slugServerUnavailable.set(true);
                const fallback = slugifyLocal(result.name);
                this.productForm.slug = fallback || '';
            }
        });

        // Admin types / edits the URL name -> check availability for values
        // the backend can accept.
        this.slugInput$.pipe(
            debounceTime(450),
            distinctUntilChanged(),
            switchMap(slug => {
                this.slugServerStatus.set(null);
                const trimmed = slug?.trim() || '';
                if (!trimmed || !isValidBackendSlug(trimmed) || trimmed === this.originalSlug) {
                    this.slugChecking.set(false);
                    return of(null);
                }
                this.slugChecking.set(true);
                return this.slugService.getSuggestion('product', { slug: trimmed }).pipe(
                    map(res => ({ kind: 'success' as const, res })),
                    catchError(() => of({ kind: 'error' as const }))
                );
            }),
            takeUntil(this.destroy$)
        ).subscribe(result => {
            if (!result) return;
            this.slugChecking.set(false);
            if (result.kind === 'success') {
                this.slugServerStatus.set(result.res);
                this.slugServerUnavailable.set(false);
            } else {
                this.slugServerUnavailable.set(true);
            }
        });
    }

    ngOnDestroy() {
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener, true);
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    onNameModelChange(value: string): void {
        this.nameInput$.next(value);
    }

    onSlugInput(): void {
        const val = (this.productForm.slug || '').trim();
        if (!val) {
            // Admin erased the typed slug: restore auto-sync with product name
            this.slugTouched = false;
            this.slugServerStatus.set(null);
            this.slugChecking.set(false);
            if (this.productForm.name?.trim()) {
                this.nameInput$.next(this.productForm.name);
            }
            return;
        }
        this.slugTouched = true;
        this.slugInput$.next(this.productForm.slug || '');
    }

    /** True when the admin changed the URL name — warn: breaks shared/indexed links. */
    get slugChanged(): boolean {
        return !!this.productForm.slug && this.productForm.slug !== this.originalSlug;
    }

    formatDateForInput(dateVal: Date | string | null | undefined): Date | null {
        if (!dateVal) return null;
        if (dateVal instanceof Date) return dateVal;
        try {
            const d = new Date(dateVal);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    }

    loadProductData() {
        if (!this.productId) return;
        this.loading.set(true);

        this.productService.getProductById(this.productId).subscribe({
            next: (product) => {
                if (!product) return;
                this.product.set(product);
                this.productForm = { 
                    ...product,
                    discount_starts_at: this.formatDateForInput(product.discount_starts_at),
                    discount_ends_at: this.formatDateForInput(product.discount_ends_at)
                };
                this.originalSlug = product.slug || '';
                this.slugTouched = false;
                this.slugServerStatus.set(null);
                this.slugChecking.set(false);
                this.inventoryForm.stock = product.stock || 0;
                this.existingImages = product.imageObjects ? [...product.imageObjects] : [];
                const currentPrimary = this.existingImages.find(img => img.is_primary);
                this.initialPrimaryId = currentPrimary ? currentPrimary.id : null;
                this.newPrimaryImageId = null;
                this.mainImagePreview = product.imageUrl || null;

                // Load initial discount preview if applicable
                this.updateDiscountPreview();

                // Fetch product categories
                this.productService.listProductCategories(this.productId!).subscribe({
                    next: (productCategories) => {
                        if (productCategories && productCategories.length > 0) {
                            this.selectedCategoryIds = productCategories.map(cat =>
                                (typeof cat === 'object' ? cat.id : cat).toString()
                            );
                        } else {
                            this.selectedCategoryIds = [];
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

    updateDiscountPreview() {
        if (!this.productForm.price || !this.productForm.discount_type || !this.productForm.discount_value) {
            this.discountPreview.set(null);
            return;
        }

        const payload = {
            discount_type: this.productForm.discount_type,
            discount_value: this.productForm.discount_value,
            discount_starts_at: this.productForm.discount_starts_at ? new Date(this.productForm.discount_starts_at).toISOString() : null,
            discount_ends_at: this.productForm.discount_ends_at ? new Date(this.productForm.discount_ends_at).toISOString() : null,
            price: this.productForm.price
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

    onMainImageSelected(event: any) {
        const file = event?.target?.files?.[0] || event?.files?.[0];
        if (file) {
            this.selectedMainImage = file;
            this.newPrimaryImageId = null; // Clear existing primary selection if new file is chosen
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
        this.selectedMainImage = null; // Clear new file upload if existing image is selected
        this.mainImagePreview = img.image_medium || img.image_large || img.image_path || null;
    }

    isImagePrimary(img: ProductImage): boolean {
        // If a new file is uploaded as the primary image, no existing image acts as primary
        if (this.selectedMainImage !== null) {
            return false;
        }
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
            this.savingStatus.set('Updating basic details...');
            const formPayload: any = {
                ...this.productForm,
                discount_starts_at: this.productForm.discount_starts_at ? new Date(this.productForm.discount_starts_at).toISOString() : null,
                discount_ends_at: this.productForm.discount_ends_at ? new Date(this.productForm.discount_ends_at).toISOString() : null
            };
            // A changed URL name is only sent when the backend can accept it;
            // otherwise the existing slug is kept (mapFrontendToBackend skips
            // absent slugs on update).
            let slugKept = false;
            if (this.slugChanged && !isValidBackendSlug((formPayload.slug || '').trim())) {
                formPayload.slug = undefined;
                formPayload._originalSlug = undefined;
                slugKept = true;
            }
            await firstValueFrom(this.productService.updateProduct(formPayload as Product));

            // 2. Handle Category Linking
            this.savingStatus.set('Updating category links...');
            if (this.selectedCategoryIds && this.selectedCategoryIds.length >= 0) {
                const categoryIds = this.selectedCategoryIds.map(id => id.toString());
                await firstValueFrom(this.productService.updateProductCategories(productId, categoryIds));
            }

            // 3. Handle Images
            const hasNewUploads = this.selectedMainImage !== null || this.selectedAdditionalImages.length > 0;
            const hasDeletes = this.deletedImageIds.length > 0;
            const hasExistingPrimaryChange = this.newPrimaryImageId !== null && this.newPrimaryImageId !== this.initialPrimaryId;

            if (hasDeletes && !hasNewUploads && !hasExistingPrimaryChange && this.deletedImageIds.length === 1) {
                this.savingStatus.set('Removing image...');
                await firstValueFrom(this.productService.removeImage(productId, this.deletedImageIds[0]));
            } else if (hasNewUploads || hasDeletes) {
                this.savingStatus.set('Uploading & processing images (resizing, optimizing)...');
                await firstValueFrom(this.productService.batchUpdateImages(
                    productId,
                    hasExistingPrimaryChange ? this.newPrimaryImageId : undefined,
                    this.selectedMainImage || undefined,
                    this.selectedAdditionalImages.length > 0 ? this.selectedAdditionalImages : undefined,
                    this.deletedImageIds.length > 0 ? this.deletedImageIds : undefined
                ));
            } else if (hasExistingPrimaryChange) {
                this.savingStatus.set('Updating primary image...');
                await firstValueFrom(this.productService.setPrimaryImage(productId, this.newPrimaryImageId!));
            }

            this.productService.clearCache();
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Product updated successfully' });
            if (slugKept) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'URL Name',
                    detail: 'The URL name you typed could not be used, so the existing one was kept.',
                    life: 5000
                });
            }
            setTimeout(() => {
                this.router.navigate(['/admin/dashboard/inventory']);
            }, 1500);

        } catch (err: any) {
            console.error('Error saving product:', err);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to save product' });
        } finally {
            this.saving.set(false);
            this.savingStatus.set('');
        }
    }

    cancel() {
        this.router.navigate(['/admin/dashboard/inventory']);
    }
}
