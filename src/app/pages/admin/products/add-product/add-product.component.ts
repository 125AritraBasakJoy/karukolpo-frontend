import { Component, signal, ViewChildren, QueryList, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../../core/services';;;
import { CategoryService } from '../../../../core/services';;;
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
import { InventoryModalComponent } from '../inventory-modal/inventory-modal.component';
import { firstValueFrom, forkJoin, of, Subject } from 'rxjs';
import { catchError, map, switchMap, tap, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

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
        slug: '',
        description: '',
        price: null as number | null,
        cost: null as number | null,
        discount_type: null as string | null,
        discount_value: null as number | null,
        discount_starts_at: null as Date | string | null,
        discount_ends_at: null as Date | string | null
    };

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
    productCreated = false;
    createdProductId: string | null = null;
    showInventoryModal = false;

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

    // Image handling
    selectedMainFile: File | null = null;
    selectedAdditionalFiles: File[] = [];
    mainImagePreview: string | null = null;
    additionalImagesPreview: string[] = [];

    constructor(
        private productService: ProductService,
        private categoryService: CategoryService,
        private slugService: SlugService,
        private messageService: MessageService,
        private router: Router,
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
        // Admin types the product name -> suggest a URL name (create-mode prefill)
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
                // Suggestion API unreachable (e.g. backend not updated yet):
                // prefill a best-effort local slug for ASCII names and let
                // the admin type one for Bengali names.
                this.slugServerUnavailable.set(true);
                const fallback = slugifyLocal(result.name);
                this.product.slug = fallback || '';
            }
        });

        // Admin types / edits the URL name -> check availability for values
        // the backend can accept. Bangla/mixed input is never flagged here —
        // the backend derives a proper slug from the product name instead.
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
        });
    }

    onNameModelChange(value: string): void {
        this.nameInput$.next(value);
    }

    onSlugInput(): void {
        const val = (this.product.slug || '').trim();
        if (!val) {
            // Admin erased the typed slug: restore auto-sync with product name
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
        const typedSlug = (this.product.slug || '').trim();
        try {
            console.log('Creating Product Metadata...');
            this.savingStatus.set('Creating product metadata...');

            // 1. Create Product Metadata
            const productPayload: any = { 
                name: this.product.name,
                // A typed URL name is only sent when the backend can accept it
                // (e.g. Bangla input is omitted so the backend derives a proper one).
                slug: isValidBackendSlug((this.product.slug || '').trim()) ? this.product.slug!.trim() : undefined,
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

            // Additional files without a main image can never upload — bail
            // out before doing any follow-up work.
            if (!this.selectedMainFile && this.selectedAdditionalFiles.length > 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validation', detail: 'Main image is required' });
                this.loading.set(false);
                this.savingStatus.set('');
                return;
            }

            // 2 & 3. Category links and image upload are independent once the
            // product id exists — run them in parallel instead of sequentially.
            this.savingStatus.set('Linking categories & uploading images...');

            const categoryIds = (this.selectedCategories || []).map(c => c.toString());
            const categoryTask = categoryIds.length > 0
                ? firstValueFrom(this.productService.addMultipleCategoriesToProduct(productId, categoryIds))
                : Promise.resolve(null);

            const uploadTask = this.selectedMainFile
                ? firstValueFrom(this.productService.bulkUploadImages(productId, this.selectedMainFile, this.selectedAdditionalFiles))
                : Promise.resolve(null);

            const [, uploadResult] = await Promise.all([categoryTask, uploadTask]);

            // The upload POST returns 202 and the backend keeps processing
            // (resize/optimize) in a background job — that is exactly what
            // the 202 is for, so don't hold the spinner on it. Observe the
            // job detached: refresh caches once images are ready.
            if (uploadResult) {
                this.productService.pollImageJob(productId, uploadResult.job_id).pipe(
                    takeUntil(this.destroy$)
                ).subscribe({
                    next: () => {
                        this.productService.clearCache();
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Images ready',
                            detail: 'Product images finished processing.',
                            life: 3000
                        });
                    },
                    error: (jobErr: any) => {
                        this.productService.clearCache();
                        this.messageService.add({
                            severity: 'warn',
                            summary: 'Image processing',
                            detail: jobErr.message || 'Image processing is still running in the background — reload in a few minutes to see the images.',
                            life: 6000
                        });
                    }
                });
            }

            this.productCreated = true;
            this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: uploadResult
                    ? 'Product created — images are processing in the background'
                    : 'Product created successfully'
            });
            if (typedSlug && !isValidBackendSlug(typedSlug)) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'URL Name',
                    detail: 'The URL name you typed could not be used, so one was created automatically from the product name.',
                    life: 5000
                });
            }
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
            slug: '',
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
        this.slugTouched = false;
        this.slugServerStatus.set(null);
        this.slugServerUnavailable.set(false);
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
