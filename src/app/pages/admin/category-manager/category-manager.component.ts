import { Component, OnInit, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../core/services';;;
import { ProductService } from '../../../core/services';;;
import { Category } from '../../../models/category.model';
import { Product } from '../../../models/product.model';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DropdownModule } from 'primeng/dropdown';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MultiSelectModule } from 'primeng/multiselect';

@Component({
    selector: 'app-category-manager',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TableModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        ToolbarModule,
        ToastModule,
        ConfirmDialogModule,
        ProgressSpinnerModule,
        DropdownModule,
        TooltipModule,
        TooltipModule,
        TagModule,
        MultiSelectModule
    ],
    providers: [ConfirmationService],
    templateUrl: './category-manager.component.html',
    styleUrls: ['./category-manager.component.scss']
})
export class CategoryManagerComponent implements OnInit {
    categoryDialog: boolean = false;
    categories = signal<Category[]>([]); // Changed to signal for consistency
    categoryForm: FormGroup;
    currentCategoryId: string | null = null;

    productsDialog: boolean = false;
    categoryProducts: Product[] = [];
    viewingCategory: Category | null = null;
    loadingProducts: boolean = false;

    // Data Buffering
    categoriesBuffer: Category[] = [];
    totalRecords = signal<number>(0);
    loading = signal<boolean>(false);
    lastLazyLoadEvent: TableLazyLoadEvent | null = null;
    readonly BUFFER_SIZE = 100;

    moveDialog: boolean = false;
    selectedProductForMove: Product | null = null;
    targetCategoryIds: string[] | null = null;
    otherCategories: Category[] = []; // This might need adjustment if we don't have all categories loaded

    imageLoadError: { [key: string]: boolean } = {};

    private categoryService = inject(CategoryService);
    private productService = inject(ProductService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    constructor() {
        this.categoryForm = this.fb.group({
            name: ['', Validators.required]
        });
    }

    ngOnInit() {
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Initial load will be triggered by onLazyLoad
        // If not, we can call this.loadCategories() manually with default event
    }

    loadCategories(event?: TableLazyLoadEvent) {
        this.loading.set(true);

        const lazyEvent = event || this.lastLazyLoadEvent || { first: 0, rows: 10 };
        this.lastLazyLoadEvent = lazyEvent;

        const first = lazyEvent.first || 0;
        const rows = lazyEvent.rows || 10;

        let dataMissing = false;
        for (let i = first; i < first + rows; i++) {
            if (!this.categoriesBuffer[i]) {
                dataMissing = true;
                break;
            }
        }

        if (!dataMissing) {
            const end = Math.min(first + rows, this.categoriesBuffer.length);
            const pageData = this.categoriesBuffer.slice(first, end);
            this.categories.set(pageData);
            this.loading.set(false);
            return;
        }

        const chunkStart = Math.floor(first / this.BUFFER_SIZE) * this.BUFFER_SIZE;

        this.categoryService.getCategories(chunkStart, this.BUFFER_SIZE).subscribe({
            next: (data) => {
                data.forEach((item, index) => {
                    this.categoriesBuffer[chunkStart + index] = item;
                });

                const currentTotal = chunkStart + data.length;
                if (data.length === this.BUFFER_SIZE) {
                    this.totalRecords.set(currentTotal + 1);
                } else {
                    this.totalRecords.set(currentTotal);
                }

                const end = Math.min(first + rows, this.categoriesBuffer.length);
                const pageData = this.categoriesBuffer.slice(first, end);
                this.categories.set(pageData);
                this.loading.set(false);

                // Update otherCategories for dropdowns if needed (might need a separate "load all for dropdown" strategy or just use what we have/fetch more)
                // For now, let's keep otherCategories based on what we have or fetch all for dropdowns?
                // The original code filtered `this.categories` which was everything.
                // For move dialog, we probably want *all* categories or search capability. 
                // Let's assume we use the buffer for now or fetch all specifically for the dropdown if needed.
                // Since this.categories is now just the page data, using it for "otherCategories" in Move Dialog is insufficient.
                // We will handle "otherCategories" separately when opening the move dialog.
            },
            error: (err) => {
                console.error('Failed to load categories', err);
                this.loading.set(false);
            }
        });
    }

    refreshCategories() {
        this.categoriesBuffer = [];
        this.totalRecords.set(0);
        const event: TableLazyLoadEvent = this.lastLazyLoadEvent ? { ...this.lastLazyLoadEvent } : { first: 0, rows: 10 };
        this.loadCategories(event);
    }

    openNew() {
        this.categoryForm.reset();
        this.currentCategoryId = null;
        this.categoryDialog = true;
    }

    editCategory(category: Category) {
        this.categoryForm.patchValue(category);
        this.currentCategoryId = category.id;
        this.categoryDialog = true;
    }

    deleteCategory(category: Category) {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete ' + category.name + '?',
            header: 'Confirm Delete',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger p-button-text',
            rejectButtonStyleClass: 'p-button-text p-button-text',
            acceptIcon: 'none',
            rejectIcon: 'none',
            accept: () => {
                this.categoryService.deleteCategory(category.id).subscribe({
                    next: () => {
                        this.categories.update(vals => vals.filter((val: Category) => val.id !== category.id));
                        this.refreshCategories(); // Refresh to update buffer logic
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category Deleted', life: 2000 });
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message, life: 2000 });
                    }
                });
            }
        });
    }

    viewProducts(category: Category) {
        this.viewingCategory = category;
        this.productsDialog = true;
        this.loadingProducts = true;
        this.categoryProducts = [];
        this.imageLoadError = {}; // Reset image errors
        this.cdr.detectChanges();

        this.categoryService.getCategoryProducts(category.id).subscribe({
            next: (products) => {
                if (products) {
                    this.categoryProducts = [...products];
                } else {
                    this.categoryProducts = [];
                }
                this.loadingProducts = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Category products fetch failed', err);
                this.fetchProductsFallback(category.id);
            }
        });
    }



    viewUncategorizedProducts() {
        this.viewingCategory = { id: 'uncategorized', name: 'Uncategorized Products', slug: 'uncategorized' };
        this.productsDialog = true;
        this.loadingProducts = true;
        this.categoryProducts = [];
        this.imageLoadError = {};
        this.cdr.detectChanges();

        this.categoryService.getCategoryProducts('uncategorized').subscribe({
            next: (products) => {
                this.categoryProducts = products;
                this.loadingProducts = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load uncategorized products', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products' });
                this.loadingProducts = false;
                this.cdr.detectChanges();
            }
        });
    }

    fetchProductsFallback(categoryId: string) {
        this.productService.getProducts(0, 1000).subscribe({
            next: (allProducts) => {
                this.categoryProducts = allProducts.filter(p => p.categoryId === categoryId);
                this.loadingProducts = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Fallback product fetch failed', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products' });
                this.loadingProducts = false;
                this.cdr.detectChanges();
            }
        });
    }

    removeProductFromCategory(product: Product) {
        if (!this.viewingCategory) return;

        this.confirmationService.confirm({
            message: `Are you sure you want to remove ${product.name} from category ${this.viewingCategory.name}?`,
            header: 'Confirm Removal',
            icon: 'pi pi-exclamation-triangle',
            acceptButtonStyleClass: 'p-button-danger p-button-text',
            rejectButtonStyleClass: 'p-button-text p-button-text',
            acceptIcon: 'none',
            rejectIcon: 'none',
            accept: () => {
                const removedCategoryId = this.viewingCategory!.id;

                this.categoryService.removeProductFromCategory(removedCategoryId, product.id).pipe(
                    // After junction table DELETE, fetch the real remaining categories
                    switchMap(() => this.productService.listProductCategories(product.id, true)),
                    // PUT the remaining list back so backend fully settles the state
                    switchMap((remaining: any[]) => {
                        const remainingIds = remaining
                            .map((c: any) => (typeof c === 'object' ? (c.id ?? (c.categoryId || c.id)) : c)?.toString())
                            .filter(Boolean);
                        return this.productService.updateProductCategories(product.id, remainingIds);
                    }),
                    catchError(err => {
                        console.warn('Category sync after removal had an issue:', err);
                        return of(null);
                    })
                ).subscribe({
                    next: () => {
                        this.productService.clearCache();
                        this.categoryService.clearCache();

                        // Remove from current list
                        this.categoryProducts = this.categoryProducts.filter(p => p.id !== product.id);

                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product removed from category', life: 2000 });

                        // If we are viewing a specific category and it becomes empty, or just to be safe
                        if (this.categoryProducts.length === 0) {
                            this.cdr.detectChanges();
                        }
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to remove product', life: 2000 });
                    }
                });
            }
        });
    }

    moveProduct(product: Product) {
        this.selectedProductForMove = product;
        this.targetCategoryIds = []; // Reset selection
        // Exclude current category from options
        this.otherCategories = this.categories().filter((c: Category) => c.id !== this.viewingCategory?.id);
        this.moveDialog = true;
    }

    confirmMove() {
        if (!this.selectedProductForMove || !this.targetCategoryIds || this.targetCategoryIds.length === 0 || !this.viewingCategory) return;

        // console.log('Moving product:', this.selectedProductForMove.id, 'to categories:', this.targetCategoryIds);

        const productIdToRemove = this.selectedProductForMove.id;
        const targetIds = this.targetCategoryIds;
        const currentCategoryId = this.viewingCategory.id;

        // Map IDs to names for display
        const targetCategoryNames = this.categories()
            .filter((c: Category) => targetIds.includes(c.id))
            .map((c: Category) => c.name)
            .join(', ');

        // Step 1: Atomic synchronization using PUT (replaces all existing categories)
        this.productService.updateProductCategories(productIdToRemove, targetIds).pipe(
            switchMap(() => {
                // Step 2: Update primary category ID on the product itself
                // This ensures it's no longer 'uncategorized' in simple list views
                if (this.selectedProductForMove) {
                    const updatedProduct = {
                        ...this.selectedProductForMove,
                        categoryId: targetIds[0]
                    };
                    return this.productService.updateProduct(updatedProduct);
                }
                return of(null);
            }),
            switchMap(() => {
                // Step 3: Refresh categories list to confirm synchronization
                return this.productService.listProductCategories(productIdToRemove, true).pipe(
                    tap((categories: any[]) => {
                        if (this.selectedProductForMove) {
                            // Populate the categories array on the local product state
                            this.selectedProductForMove.categories = categories || [];

                            // Also update the primary categoryId for backward compatibility
                            if (categories && categories.length > 0) {
                                this.selectedProductForMove.categoryId = categories[0].id?.toString() || targetIds[0];
                            } else {
                                this.selectedProductForMove.categoryId = '0';
                            }
                        }
                    }),
                    catchError(err => {
                        console.warn('Post-assignment categories fetch failed:', err);
                        return of(null); // Continue anyway as PUT succeeded
                    })
                );
            })
        ).subscribe({
            next: () => {
                this.finalizeMove(productIdToRemove, targetCategoryNames, currentCategoryId === 'uncategorized');
            },
            error: (err: any) => {
                console.error('Category Assignment Failed:', err);
                let detail = 'Failed to update product category';
                if (err.status === 401) detail = 'Authentication error. Please login again.';
                else if (err.message) detail = err.message;

                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: detail,
                    life: 2000
                });
            }
        });
    }

    finalizeMove(productId: string, targetNames: string, isAssign: boolean = false) {
        // Clear caches to ensure fresh data on next load
        this.productService.clearCache();
        this.categoryService.clearCache();

        // Local UI update for immediate feedback
        this.categoryProducts = [...this.categoryProducts.filter(p => p.id !== productId)];

        this.messageService.add({
            severity: 'success',
            summary: 'Successful',
            detail: isAssign ? `Product assigned to ${targetNames}` : `Product moved to ${targetNames}`,
            life: 2000
        });
        this.moveDialog = false;
        this.selectedProductForMove = null;
        this.cdr.detectChanges();
    }

    hideDialog() {
        this.categoryDialog = false;
        this.categoryForm.reset();
    }

    saveCategory() {
        if (this.categoryForm.invalid) {
            this.categoryForm.markAllAsTouched();
            return;
        }

        const categoryData = this.categoryForm.value;

        if (this.currentCategoryId) {
            const updatedCategory: Category = { ...categoryData, id: this.currentCategoryId };
            this.categoryService.updateCategory(updatedCategory).subscribe({
                next: (updated) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Successful',
                        detail: `Category "${updated.name}" Updated`,
                        life: 2000
                    });
                    this.loadCategories();
                    this.hideDialog();
                },
                error: (err) => {
                    let errorMessage = 'Failed to update category';
                    if (err.status === 401 || err.status === 403) {
                        errorMessage = 'Authentication required.';
                    } else if (err.message) {
                        errorMessage = err.message;
                    }
                    this.messageService.add({
                        life: 2000,
                        severity: 'error',
                        summary: 'Error',
                        detail: errorMessage,
                    });
                }
            });
        } else {
            const newCategory: Category = { ...categoryData, id: '', slug: '' };
            this.categoryService.addCategory(newCategory).subscribe({
                next: (createdCategory) => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Successful',
                        detail: `Category "${createdCategory.name}" Created`,
                        life: 2000
                    });
                    this.loadCategories();
                    this.hideDialog();
                },
                error: (err) => {
                    let errorMessage = 'Failed to create category';
                    if (err.status === 401 || err.status === 403) {
                        errorMessage = 'Authentication required.';
                    } else if (err.message) {
                        errorMessage = err.message;
                    }
                    this.messageService.add({
                        life: 2000,
                        severity: 'error',
                        summary: 'Error',
                        detail: errorMessage,
                    });
                }
            });
        }
    }

    handleImageError(productId: string) {
        if (!productId) return;
        this.imageLoadError[productId] = true;
        this.cdr.detectChanges();
    }

    trackByProductId(index: number, product: Product): string {
        return product.id;
    }
}
