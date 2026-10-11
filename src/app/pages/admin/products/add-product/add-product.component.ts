import { Component, signal, ViewChildren, QueryList, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../core/services';
import { CategoryService } from '../../../../core/services';
import { SlugService, SlugSuggestionResponse, slugifyLocal, isValidBackendSlug } from '../../../../core/services/slug/slug.service';
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
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule, Calendar } from 'primeng/calendar';
import { StepperModule } from 'primeng/stepper';
import { firstValueFrom, of, Subject } from 'rxjs';
import { catchError, map, switchMap, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

interface GalleryFileItem {
    id: string;
    file: File;
    preview: string;
}

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
        TooltipModule,
        StepperModule
    ],

    styleUrl: './add-product.component.scss',
    templateUrl: './add-product.component.html'
})
export class AddProductComponent implements OnInit, OnDestroy {
    @ViewChildren(Calendar) calendars!: QueryList<Calendar>;
    private scrollListener: any;

    // Active wizard step: 1 = Product Info, 2 = Set Inventory, 3 = Preview
    activeStep = signal<number>(1);

    product = {
        name: '',
        slug: '',
        description: '',
        price: null as number | null,
        cost: null as number | null,
        discount_type: null as string | null,
        discount_value: null as number | null,
        discount_starts_at: null as Date | string | null,
        discount_ends_at: null as Date | string | null
    };

    // Step 2: Inventory state
    inventoryQuantity: number | null = 0;

    get currentDate(): Date {
        return new Date();
    }

    categories = signal<any[]>([]);
    selectedCategories: any[] = [];
    isPriceFocused = false;
    isCostFocused = false;
    loading = signal(false);
    savingStatus = signal('');
    discountPreview = signal<any>(null);

    // Submission tracking for partial failure retry protection
    createdProductId: string | null = null;
    isInventorySaved = false;
    isCategoriesLinked = false;
    isImagesUploaded = false;
    acceptedImageJobId: string | null = null;

    // URL name (slug) handling
    private slugInput$ = new Subject<string>();
    private nameInput$ = new Subject<string>();
    private destroy$ = new Subject<void>();
    /** False until the admin manually edits the field — suggestions only prefill while false. */
    slugTouched = false;
    slugChecking = signal(false);
    slugServerStatus = signal<SlugSuggestionResponse | null>(null);
    /** True when the suggestion/availability API is unreachable — the field still works manually. */
    slugServerUnavailable = signal(false);

    discountTypeOptions = [
        { label: 'No Discount', value: null },
        { label: 'Fixed Amount (BDT)', value: 'FIXED' }
    ];

    // Image handling with stable object association and unique IDs
    selectedMainFile: File | null = null;
    mainImagePreview: string | null = null;
    private mainFileSequence = 0;

    galleryItems: GalleryFileItem[] = [];

    constructor(
        private productService: ProductService,
        private categoryService: CategoryService,
        private slugService: SlugService,
        private messageService: MessageService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
    }

    ngOnInit() {
        this.loadCategories();
        this.setupSlugHandling();

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
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * URL name (slug): debounced suggestion prefill while the name is typed,
     * and debounced availability/validation checks for the typed value.
     */
    private setupSlugHandling(): void {
        this.nameInput$.pipe(
            debounceTime(450),
            distinctUntilChanged(),
            switchMap(name => {
                const trimmed = name?.trim() || '';
                if (this.slugTouched) {
                    return of(null);
                }
                if (!trimmed) {
                    this.product.slug = '';
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
                this.product.slug = result.res.suggestion || '';
                this.slugServerStatus.set(result.res);
            } else {
                this.slugServerUnavailable.set(true);
                const fallback = slugifyLocal(result.name);
                this.product.slug = fallback || '';
            }
            this.cdr.markForCheck();
        });

        this.slugInput$.pipe(
            debounceTime(450),
            distinctUntilChanged(),
            switchMap(slug => {
                this.slugServerStatus.set(null);
                const trimmed = slug?.trim() || '';
                if (!trimmed || !isValidBackendSlug(trimmed)) {
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
            this.cdr.markForCheck();
        });
    }

    onNameModelChange(value: string): void {
        this.nameInput$.next(value);
    }

    onSlugInput(): void {
        const val = (this.product.slug || '').trim();
        if (!val) {
            this.slugTouched = false;
            this.slugServerStatus.set(null);
            this.slugChecking.set(false);
            if (this.product.name?.trim()) {
                this.nameInput$.next(this.product.name);
            }
            return;
        }
        this.slugTouched = true;
        this.slugInput$.next(this.product.slug || '');
    }

    loadCategories() {
        this.categoryService.getCategories().subscribe(cats => {
            this.categories.set(cats);
        });
    }

    onDiscountTypeChange(): void {
        if (!this.product.discount_type) {
            this.product.discount_value = null;
            this.product.discount_starts_at = null;
            this.product.discount_ends_at = null;
        }
        this.updateDiscountPreview();
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

    // --- Image Handling ---

    onMainImageSelect(event: any) {
        const file = event.target?.files?.[0];
        if (file) {
            if (!this.validateImageFile(file)) {
                event.target.value = '';
                return;
            }
            this.selectedMainFile = file;
            const currentSeq = ++this.mainFileSequence;
            this.readFile(file).then(base64 => {
                if (currentSeq === this.mainFileSequence) {
                    this.mainImagePreview = base64 as string;
                    this.cdr.markForCheck();
                }
            }).catch(() => {
                this.messageService.add({ severity: 'error', summary: 'Image Error', detail: 'Failed to read image file' });
            });
        }
        event.target.value = '';
    }

    removeMainImage() {
        this.selectedMainFile = null;
        this.mainImagePreview = null;
        this.mainFileSequence++;
    }

    onAdditionalImageSelect(event: any) {
        const files: FileList | null = event.target?.files;
        if (files && files.length > 0) {
            Array.from(files).forEach((file: File) => {
                if (!this.validateImageFile(file)) return;
                const itemId = 'gallery_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
                const placeholderItem: GalleryFileItem = { id: itemId, file, preview: '' };
                this.galleryItems.push(placeholderItem);

                this.readFile(file).then(base64 => {
                    const found = this.galleryItems.find(i => i.id === itemId);
                    if (found) {
                        found.preview = base64 as string;
                        this.cdr.markForCheck();
                    }
                }).catch(() => {
                    this.removeAdditionalImage(itemId);
                });
            });
        }
        event.target.value = '';
    }

    removeAdditionalImage(idOrIndex: string | number) {
        if (typeof idOrIndex === 'string') {
            this.galleryItems = this.galleryItems.filter(item => item.id !== idOrIndex);
        } else {
            this.galleryItems.splice(idOrIndex, 1);
        }
    }

    private validateImageFile(file: File): boolean {
        if (!file.type.startsWith('image/')) {
            this.messageService.add({ severity: 'error', summary: 'Invalid File', detail: `${file.name} is not a valid image file.` });
            return false;
        }
        const maxBytes = 15 * 1024 * 1024; // 15MB
        if (file.size > maxBytes) {
            this.messageService.add({ severity: 'error', summary: 'File Too Large', detail: `${file.name} exceeds 15MB limit.` });
            return false;
        }
        return true;
    }

    readFile(file: File): Promise<string | ArrayBuffer | null> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // --- Stepper Navigation & Step Validation ---

    onStepClick(targetStep: number): void {
        if (this.loading()) return;
        // If metadata is already created during a partial-save retry, do not allow moving back
        if (this.createdProductId && targetStep !== 3) {
            this.messageService.add({
                severity: 'info',
                summary: 'Save in Progress',
                detail: 'Product metadata has already been created. Please complete saving remaining items from Preview.'
            });
            return;
        }

        if (targetStep === this.activeStep()) return;

        if (targetStep > this.activeStep()) {
            if (this.activeStep() === 1 && !this.validateStep1()) return;
            if (this.activeStep() === 2 && !this.validateStep2()) return;
            if (targetStep === 3 && !this.validateStep1()) {
                this.activeStep.set(1);
                return;
            }
        }
        this.activeStep.set(targetStep);
    }

    goToStep(targetStep: number): void {
        if (this.loading()) return;
        if (this.createdProductId && targetStep !== 3) {
            this.messageService.add({
                severity: 'info',
                summary: 'Save in Progress',
                detail: 'Product metadata has already been created. Please complete saving remaining items from Preview.'
            });
            return;
        }

        if (targetStep > this.activeStep()) {
            if (this.activeStep() === 1 && !this.validateStep1()) return;
            if (this.activeStep() === 2 && !this.validateStep2()) return;
        }
        this.activeStep.set(targetStep);
    }

    validateStep1(): boolean {
        const trimmedName = (this.product.name || '').trim();
        if (!trimmedName) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Product name is required.' });
            return false;
        }

        if (this.product.price === null || this.product.price === undefined || isNaN(this.product.price) || this.product.price <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'A valid positive Price is required.' });
            return false;
        }

        if (this.product.cost !== null && this.product.cost !== undefined) {
            if (isNaN(this.product.cost) || this.product.cost < 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Cost must be a nonnegative number.' });
                return false;
            }
        }

        if (this.product.discount_type) {
            if (this.product.discount_value === null || this.product.discount_value === undefined || isNaN(this.product.discount_value) || this.product.discount_value < 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please specify a valid discount amount.' });
                return false;
            }
            if (this.product.discount_value > this.product.price) {
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Discount amount cannot be greater than the product price.' });
                return false;
            }
            if (this.product.discount_starts_at && this.product.discount_ends_at) {
                const start = new Date(this.product.discount_starts_at).getTime();
                const end = new Date(this.product.discount_ends_at).getTime();
                if (end < start) {
                    this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Discount end date cannot be earlier than start date.' });
                    return false;
                }
            }
        }

        if (!this.selectedMainFile && this.galleryItems.length > 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'A Primary/Main Image is required when adding gallery images.' });
            return false;
        }

        return true;
    }

    validateStep2(): boolean {
        if (this.inventoryQuantity === null || this.inventoryQuantity === undefined || isNaN(this.inventoryQuantity)) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Please enter a valid stock quantity (0 or greater).' });
            return false;
        }
        if (!Number.isInteger(Number(this.inventoryQuantity)) || Number(this.inventoryQuantity) < 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Stock quantity must be a non-negative whole number.' });
            return false;
        }
        return true;
    }

    // --- Preview Helpers ---

    getSelectedCategoryNames(): string[] {
        if (!this.selectedCategories || this.selectedCategories.length === 0) return [];
        const cats = this.categories();
        return this.selectedCategories.map(catId => {
            const found = cats.find(c => c.id?.toString() === catId?.toString());
            return found ? found.name : `Category ${catId}`;
        });
    }

    getEffectivePrice(): number {
        if (!this.product.price) return 0;
        if (this.product.discount_type === 'FIXED' && this.product.discount_value) {
            return Math.max(0, this.product.price - this.product.discount_value);
        }
        return this.product.price;
    }

    // --- Final Save & Orchestration ---

    async saveProduct(): Promise<void> {
        if (this.loading()) return;

        // Revalidate all steps
        if (!this.validateStep1()) {
            this.activeStep.set(1);
            return;
        }
        if (!this.validateStep2()) {
            this.activeStep.set(2);
            return;
        }

        this.loading.set(true);
        const typedSlug = (this.product.slug || '').trim();

        try {
            // Step 1 of Save: Create Metadata if not already created
            if (!this.createdProductId) {
                this.savingStatus.set('Creating product metadata...');
                const productPayload: any = {
                    name: this.product.name.trim(),
                    slug: isValidBackendSlug(typedSlug) ? typedSlug : undefined,
                    description: this.product.description || null,
                    price: this.product.price,
                    cost: this.product.cost !== null && this.product.cost !== undefined ? Number(this.product.cost) : null,
                    discount_type: this.product.discount_type || null,
                    discount_value: this.product.discount_type ? this.product.discount_value : null,
                    discount_starts_at: this.product.discount_type && this.product.discount_starts_at ? new Date(this.product.discount_starts_at).toISOString() : null,
                    discount_ends_at: this.product.discount_type && this.product.discount_ends_at ? new Date(this.product.discount_ends_at).toISOString() : null
                };

                const createdProduct = await firstValueFrom(this.productService.addProduct(productPayload));
                this.createdProductId = createdProduct.id;
            }

            const productId = this.createdProductId!;

            // Step 2 of Save: Set Inventory
            if (!this.isInventorySaved) {
                this.savingStatus.set('Setting inventory...');
                const qty = Math.max(0, Math.floor(Number(this.inventoryQuantity || 0)));
                await firstValueFrom(this.productService.updateInventory(productId, qty));
                this.isInventorySaved = true;
            }

            // Step 3 of Save: Link Categories
            const categoryIds = (this.selectedCategories || []).map(c => c.toString());
            if (!this.isCategoriesLinked && categoryIds.length > 0) {
                this.savingStatus.set('Linking categories...');
                await firstValueFrom(this.productService.addMultipleCategoriesToProduct(productId, categoryIds));
                this.isCategoriesLinked = true;
            } else if (categoryIds.length === 0) {
                this.isCategoriesLinked = true;
            }

            // Step 4 of Save: Upload Images
            const additionalFiles = this.galleryItems.map(item => item.file);
            if (!this.isImagesUploaded && this.selectedMainFile) {
                this.savingStatus.set('Uploading images...');
                const uploadResult = await firstValueFrom(
                    this.productService.bulkUploadImages(productId, this.selectedMainFile, additionalFiles)
                );
                this.isImagesUploaded = true;

                if (uploadResult?.job_id) {
                    this.acceptedImageJobId = uploadResult.job_id;
                    this.productService.pollImageJob(productId, uploadResult.job_id).pipe(
                        takeUntil(this.destroy$)
                    ).subscribe({
                        next: () => {
                            this.productService.clearCache();
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Images Ready',
                                detail: 'Product images finished processing.',
                                life: 3000
                            });
                        },
                        error: (jobErr: any) => {
                            this.productService.clearCache();
                            this.messageService.add({
                                severity: 'warn',
                                summary: 'Image Processing',
                                detail: jobErr.message || 'Image processing is still running in the background.',
                                life: 6000
                            });
                        }
                    });
                }
            } else if (!this.selectedMainFile) {
                this.isImagesUploaded = true;
            }

            // Clear cache immediately so new product shows in admin list even without images
            this.productService.clearCache();

            this.messageService.add({
                severity: 'success',
                summary: 'Product Saved!',
                detail: this.selectedMainFile
                    ? 'Product created and inventory set — images are processing in background.'
                    : 'Product created and inventory set successfully.',
                life: 3000
            });

            if (typedSlug && !isValidBackendSlug(typedSlug)) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'URL Name',
                    detail: 'The URL name you typed could not be used, so one was created automatically from the product name.',
                    life: 5000
                });
            }

            // Reset entire wizard for next product
            this.resetWizard();

        } catch (error: any) {
            console.error('Error during product save flow:', error);
            const remainingParts: string[] = [];
            if (!this.isInventorySaved) remainingParts.push('Inventory');
            if (!this.isCategoriesLinked && (this.selectedCategories || []).length > 0) remainingParts.push('Categories');
            if (!this.isImagesUploaded && this.selectedMainFile) remainingParts.push('Images');

            let detail = error.message || 'An error occurred while saving.';
            if (this.createdProductId && remainingParts.length > 0) {
                detail += ` Product was created, but ${remainingParts.join(', ')} failed. Click "Retry Save" to finish without creating duplicates.`;
            }

            this.messageService.add({
                severity: 'error',
                summary: 'Save Failed',
                detail,
                life: 7000
            });
        } finally {
            this.loading.set(false);
            this.savingStatus.set('');
        }
    }

    resetWizard(): void {
        this.product = {
            name: '',
            slug: '',
            description: '',
            price: null,
            cost: null,
            discount_type: null,
            discount_value: null,
            discount_starts_at: null,
            discount_ends_at: null
        };
        this.inventoryQuantity = 0;
        this.discountPreview.set(null);
        this.selectedCategories = [];
        this.slugTouched = false;
        this.slugServerStatus.set(null);
        this.slugServerUnavailable.set(false);

        this.selectedMainFile = null;
        this.mainImagePreview = null;
        this.mainFileSequence++;
        this.galleryItems = [];

        this.createdProductId = null;
        this.isInventorySaved = false;
        this.isCategoriesLinked = false;
        this.isImagesUploaded = false;
        this.acceptedImageJobId = null;

        this.activeStep.set(1);
    }

    cancel(): void {
        if (this.loading()) return;
        if (this.createdProductId) {
            const confirmLeave = confirm('A product was created with ID ' + this.createdProductId + '. Are you sure you want to leave?');
            if (!confirmLeave) return;
        }
        this.router.navigate(['/admin/dashboard']);
    }
}

