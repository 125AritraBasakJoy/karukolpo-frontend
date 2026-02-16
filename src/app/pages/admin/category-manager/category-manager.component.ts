import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';
import { ProductService } from '../../../services/product.service';
import { Category } from '../../../models/category.model';
import { Product } from '../../../models/product.model';
import { TableModule } from 'primeng/table';
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
        TagModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
    <div class="card">
        <p-toolbar styleClass="mb-4 gap-2">
            <ng-template pTemplate="left">
                <button pButton pRipple label="New Category" icon="pi pi-plus" class="p-button-success mr-2" (click)="openNew()"></button>
            </ng-template>
        </p-toolbar>

        <p-table #dt [value]="categories" [rows]="10" [paginator]="true" [globalFilterFields]="['name', 'slug']"
            [tableStyle]="{'min-width': '50rem'}" selectionMode="single" dataKey="id"
            styleClass="premium-table" [rowHover]="true" [showCurrentPageReport]="true"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} categories">
            
            <ng-template pTemplate="caption">
                <div class="flex align-items-center justify-content-between">
                    <h5 class="m-0">Manage Categories</h5>
                    <span class="p-input-icon-left">
                        <input pInputText type="text" (input)="dt.filterGlobal($any($event.target).value, 'contains')" placeholder="Search..." />
                    </span>
                </div>
            </ng-template>
            
            <ng-template pTemplate="header">
                <tr>
                    <th pSortableColumn="name" style="min-width:15rem">Name <p-sortIcon field="name"></p-sortIcon></th>
                    <th pSortableColumn="slug">Slug <p-sortIcon field="slug"></p-sortIcon></th>
                    <th style="width: 150px">Actions</th>
                </tr>
            </ng-template>
            
            <ng-template pTemplate="body" let-category>
                <tr>
                    <td><span class="font-bold">{{category.name}}</span></td>
                    <td>{{category.slug}}</td>
                    <td>
                        <div class="flex gap-2">
                            <button pButton pRipple icon="pi pi-eye" class="p-button-rounded p-button-info p-button-text" (click)="viewProducts(category)" pTooltip="View Products" tooltipPosition="top"></button>
                            <button pButton pRipple icon="pi pi-pencil" class="p-button-rounded p-button-success p-button-text" (click)="editCategory(category)" pTooltip="Edit Category" tooltipPosition="top"></button>
                            <button pButton pRipple icon="pi pi-trash" class="p-button-rounded p-button-warning p-button-text" (click)="deleteCategory(category)" pTooltip="Delete Category" tooltipPosition="top"></button>
                        </div>
                    </td>
                </tr>
            </ng-template>
            
            <ng-template pTemplate="summary">
                <div class="flex align-items-center justify-content-between">
                    In total there are {{categories ? categories.length : 0 }} categories.
                </div>
            </ng-template>
        </p-table>
    </div>

    <!-- Products Dialog -->
    <p-dialog [(visible)]="productsDialog" [style]="{width: '850px'}" [header]="'Products in ' + (viewingCategory?.name || 'Category')" [modal]="true" appendTo="body" styleClass="p-fluid">
        
        <div *ngIf="loadingProducts" class="flex justify-content-center align-items-center p-6">
            <p-progressSpinner styleClass="w-4rem h-4rem"></p-progressSpinner>
        </div>
        
        <p-table *ngIf="!loadingProducts" [value]="categoryProducts" [rows]="5" [paginator]="true" 
            [tableStyle]="{'min-width': '100%'}" responsiveLayout="scroll" 
            styleClass="p-datatable-sm" [rowHover]="true" [rowTrackBy]="trackByProductId">
            
            <ng-template pTemplate="header">
                <tr>
                    <th style="width: 15%">Image</th>
                    <th style="width: 35%">Name</th>
                    <th style="width: 20%">Price</th>
                    <th style="width: 30%">Actions</th>
                </tr>
            </ng-template>
            
            <ng-template pTemplate="body" let-product>
                <tr>
                    <td>
                        <div class="border-1 border-300 border-round overflow-hidden w-4rem h-4rem surface-50 relative flex align-items-center justify-content-center">
                            <!-- Icon always present in background -->
                            <i class="pi pi-image text-400 text-2xl absolute z-0"></i>
                            
                            <!-- Image overlays icon if valid -->
                            <img *ngIf="product.imageUrl && !imageLoadError[product.id]" 
                                [src]="product.imageUrl" 
                                [alt]="product.name" 
                                class="w-full h-full relative z-1" 
                                style="object-fit: cover;" 
                                (error)="handleImageError(product.id)" />
                        </div>
                    </td>
                    <td><span class="font-medium">{{product.name}}</span></td>
                    <td>{{product.price | currency:'BDT':'symbol-narrow'}}</td>
                    <td>
                        <div class="flex gap-2">
                            <button pButton pRipple label="Move" icon="pi pi-arrow-right-arrow-left" class="p-button-outlined p-button-secondary p-button-sm" (click)="moveProduct(product)" pTooltip="Move to Another Category" tooltipPosition="left"></button>
                            <button pButton pRipple label="Remove" icon="pi pi-trash" class="p-button-outlined p-button-danger p-button-sm" (click)="removeProductFromCategory(product)" pTooltip="Remove from Category" tooltipPosition="left"></button>
                        </div>
                    </td>
                </tr>
            </ng-template>
            
            <ng-template pTemplate="emptymessage">
                <tr>
                    <td colspan="4" class="text-center p-6">
                        <div class="flex flex-column align-items-center">
                            <i class="pi pi-box text-400 text-5xl mb-3"></i>
                            <span class="text-500">No products found in this category.</span>
                        </div>
                    </td>
                </tr>
            </ng-template>
        </p-table>
    </p-dialog>

    <!-- Move Product Dialog -->
    <p-dialog [(visible)]="moveDialog" [style]="{width: '450px'}" header="Move Product" [modal]="true" appendTo="body" styleClass="p-fluid" [baseZIndex]="10000">
        <ng-template pTemplate="content">
            <div class="field pt-2" style="min-height: 150px">
                <label for="newCategory" class="font-bold block mb-3">Select Target Category</label>
                <p-dropdown [options]="otherCategories" [(ngModel)]="targetCategoryId" optionLabel="name" optionValue="id" 
                    placeholder="Select a Category" [filter]="true" filterBy="name" [showClear]="true"
                    appendTo="body" styleClass="w-full" [autoDisplayFirst]="false" [style]="{'width':'100%'}">
                    <ng-template let-category pTemplate="item">
                        <div class="flex align-items-center gap-2">
                            <div>{{category.name}}</div>
                        </div>
                    </ng-template>
                </p-dropdown>
                <small class="block mt-2 text-500">The product will be moved from <strong>{{viewingCategory?.name}}</strong> to the selected category.</small>
            </div>
        </ng-template>
        <ng-template pTemplate="footer">
            <button pButton pRipple label="Cancel" icon="pi pi-times" class="p-button-text" (click)="moveDialog = false"></button>
            <button pButton pRipple label="Move Product" icon="pi pi-check" (click)="confirmMove()" [disabled]="!targetCategoryId" class="p-button-primary"></button>
        </ng-template>
    </p-dialog>

    <!-- Create/Edit Category Dialog -->
    <p-dialog [(visible)]="categoryDialog" [style]="{width: '450px'}" [header]="currentCategoryId ? 'Edit Category' : 'New Category'" [modal]="true" styleClass="p-fluid" appendTo="body">
        <ng-template pTemplate="content">
            <form [formGroup]="categoryForm" class="pt-2">
                <div class="field">
                    <label for="name" class="font-bold">Name</label>
                    <input type="text" pInputText id="name" formControlName="name" required autofocus class="w-full" [ngClass]="{'ng-invalid ng-dirty': categoryForm.get('name')?.invalid && categoryForm.get('name')?.touched}" />
                    <small class="p-error block mt-1" *ngIf="categoryForm.get('name')?.invalid && categoryForm.get('name')?.touched">Name is required.</small>
                </div>
            </form>
        </ng-template>

        <ng-template pTemplate="footer">
            <button pButton pRipple label="Cancel" icon="pi pi-times" class="p-button-text" (click)="hideDialog()"></button>
            <button pButton pRipple label="Save" icon="pi pi-check" (click)="saveCategory()" class="p-button-primary"></button>
        </ng-template>
    </p-dialog>

    <p-confirmDialog [style]="{width: '450px'}" appendTo="body"></p-confirmDialog>
  `,
    styles: [`
        :host { display: block; }
        .p-button.p-button-icon-only.p-button-rounded {
            width: 2.5rem;
            height: 2.5rem;
        }
    `]
})
export class CategoryManagerComponent implements OnInit {
    categoryDialog: boolean = false;
    categories: Category[] = [];
    categoryForm: FormGroup;
    currentCategoryId: string | null = null;

    productsDialog: boolean = false;
    categoryProducts: Product[] = [];
    viewingCategory: Category | null = null;
    loadingProducts: boolean = false;

    moveDialog: boolean = false;
    selectedProductForMove: Product | null = null;
    targetCategoryId: string | null = null;
    otherCategories: Category[] = [];

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
        this.loadCategories();
    }

    loadCategories() {
        this.categoryService.getCategories().subscribe(data => this.categories = data);
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
                        this.categories = this.categories.filter(val => val.id !== category.id);
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category Deleted', life: 3000 });
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message, life: 3000 });
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

    fetchProductsFallback(categoryId: string) {
        this.productService.getProducts(0, 1000).subscribe({
            next: (allProducts) => {
                this.categoryProducts = allProducts.filter(p => p.categoryId === categoryId);
                this.loadingProducts = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Fallback product fetch failed', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products', life: 3000 });
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
                this.categoryService.removeProductFromCategory(this.viewingCategory!.id, product.id).subscribe({
                    next: () => {
                        this.categoryProducts = this.categoryProducts.filter(p => p.id !== product.id);
                        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product removed from category', life: 3000 });
                        this.cdr.detectChanges();
                    },
                    error: (err) => {
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: err.message || 'Failed to remove product', life: 3000 });
                    }
                });
            }
        });
    }

    moveProduct(product: Product) {
        this.selectedProductForMove = product;
        this.targetCategoryId = null;
        this.otherCategories = this.categories.filter(c => c.id !== this.viewingCategory?.id);
        this.moveDialog = true;
    }

    confirmMove() {
        if (!this.selectedProductForMove || !this.targetCategoryId || !this.viewingCategory) return;

        const targetCategoryName = this.categories.find(c => c.id === this.targetCategoryId)?.name;

        this.categoryService.moveProductToCategory(
            this.selectedProductForMove.id,
            this.viewingCategory.id,
            this.targetCategoryId
        ).subscribe({
            next: () => {
                this.categoryProducts = this.categoryProducts.filter(p => p.id !== this.selectedProductForMove?.id);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Successful',
                    detail: `Product moved to ${targetCategoryName}`,
                    life: 3000
                });
                this.moveDialog = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err.message || 'Failed to move product',
                    life: 3000
                });
            }
        });
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
                        life: 3000
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
                        severity: 'error',
                        summary: 'Error',
                        detail: errorMessage,
                        life: 5000
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
                        life: 3000
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
                        severity: 'error',
                        summary: 'Error',
                        detail: errorMessage,
                        life: 5000
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
