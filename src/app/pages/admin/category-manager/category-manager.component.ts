import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
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
    providers: [MessageService, ConfirmationService],
    template: `
    <div class="category-manager-container p-4 min-h-screen">
        <div class="header-section mb-6">
            <div class="flex flex-column md:flex-row md:align-items-center justify-content-between gap-4">
                <div>
                    <h1 class="text-4xl font-bold m-0 tracking-tight text-white mb-2">Category Manager</h1>
                    <p class="text-slate-400 m-0 text-lg">Organize and manage your product catalog efficiently.</p>
                </div>
                <div class="flex gap-2">
                    <button pButton pRipple label="New Category" icon="pi pi-plus" 
                        class="p-button-raised premium-btn-primary" (click)="openNew()"></button>
                    <button pButton pRipple label="Uncategorized" icon="pi pi-eye-slash" 
                        class="p-button-outlined premium-btn-secondary" (click)="viewUncategorizedProducts()"></button>
                </div>
            </div>
        </div>

        <div class="glass-card fadein animation-duration-500">
            <p-table #dt [value]="categories" [rows]="10" [paginator]="true" [globalFilterFields]="['name', 'slug']"
                [tableStyle]="{'min-width': '50rem'}" selectionMode="single" dataKey="id"
                styleClass="premium-table-v2" [rowHover]="true" [showCurrentPageReport]="true"
                currentPageReportTemplate="Showing {first} to {last} of {totalRecords} categories">
                
                <ng-template pTemplate="caption">
                    <div class="flex align-items-center justify-content-between py-2">
                        <h5 class="m-0 text-xl font-semibold">Manage List</h5>
                        <div class="search-container">
                            <i class="pi pi-search search-icon"></i>
                            <input pInputText type="text" 
                                (input)="dt.filterGlobal($any($event.target).value, 'contains')" 
                                placeholder="Search Categories..." class="search-input" />
                        </div>
                    </div>
                </ng-template>
                
                <ng-template pTemplate="header">
                    <tr>
                        <th pSortableColumn="name" style="min-width:15rem">Category Name <p-sortIcon field="name"></p-sortIcon></th>
                        <th pSortableColumn="slug">URL Identifier <p-sortIcon field="slug"></p-sortIcon></th>
                        <th style="width: 150px" class="text-center">Actions</th>
                    </tr>
                </ng-template>
                
                <ng-template pTemplate="body" let-category>
                    <tr class="table-row">
                        <td>
                            <div class="flex align-items-center gap-3">
                                <div class="category-icon-box">
                                    <i class="pi pi-folder text-blue-400"></i>
                                </div>
                                <span class="font-semibold text-lg">{{category.name}}</span>
                            </div>
                        </td>
                        <td>
                            <code class="slug-tag">{{category.slug}}</code>
                        </td>
                        <td>
                            <div class="flex justify-content-center gap-2">
                                <button pButton pRipple icon="pi pi-eye" 
                                    class="p-button-rounded p-button-text action-btn info-btn" 
                                    (click)="viewProducts(category)" pTooltip="View Products" tooltipPosition="top"></button>
                                <button pButton pRipple icon="pi pi-pencil" 
                                    class="p-button-rounded p-button-text action-btn success-btn" 
                                    (click)="editCategory(category)" pTooltip="Edit Category" tooltipPosition="top"></button>
                                <button pButton pRipple icon="pi pi-trash" 
                                    class="p-button-rounded p-button-text action-btn danger-btn" 
                                    (click)="deleteCategory(category)" pTooltip="Delete Category" tooltipPosition="top"></button>
                            </div>
                        </td>
                    </tr>
                </ng-template>
                
                <ng-template pTemplate="summary">
                    <div class="flex align-items-center justify-content-between opacity-70">
                        Total categories: {{categories ? categories.length : 0 }}
                    </div>
                </ng-template>
            </p-table>
        </div>
    </div>

    <!-- Products Dialog -->
    <p-dialog [(visible)]="productsDialog" [style]="{width: '900px'}" 
        [header]="'Products in ' + (viewingCategory?.name || 'Category')" 
        [modal]="true" appendTo="body" styleClass="premium-dialog">
        
        <div *ngIf="loadingProducts" class="flex flex-column justify-content-center align-items-center p-8 gap-3">
            <p-progressSpinner styleClass="w-4rem h-4rem"></p-progressSpinner>
            <span class="text-slate-400 animate-pulse">Loading amazing products...</span>
        </div>
        
        <div *ngIf="!loadingProducts" class="dialog-content-wrapper p-2">
            <p-table [value]="categoryProducts" [rows]="6" [paginator]="true" 
                [tableStyle]="{'min-width': '100%'}" responsiveLayout="scroll" 
                styleClass="p-datatable-sm premium-inner-table" [rowHover]="true" [rowTrackBy]="trackByProductId">
                
                <ng-template pTemplate="header">
                    <tr>
                        <th style="width: 15%">Item</th>
                        <th style="width: 40%">Details</th>
                        <th style="width: 15%">Price</th>
                        <th style="width: 30%" class="text-right">Manage</th>
                    </tr>
                </ng-template>
                
                <ng-template pTemplate="body" let-product>
                    <tr class="inner-table-row">
                        <td>
                            <div class="product-img-container">
                                <i class="pi pi-image text-slate-600 text-xl absolute"></i>
                                <img *ngIf="product.imageUrl && !imageLoadError[product.id]" 
                                    [src]="product.imageUrl" 
                                    [alt]="product.name" 
                                    class="product-img" 
                                    (error)="handleImageError(product.id)" />
                            </div>
                        </td>
                        <td>
                            <div class="flex flex-column">
                                <span class="font-bold text-gray-200">{{product.name}}</span>
                                <small class="text-slate-500">ID: {{product.id}}</small>
                            </div>
                        </td>
                        <td>
                            <span class="price-badge">{{product.price | currency:'BDT':'symbol-narrow'}}</span>
                        </td>
                        <td class="text-right">
                            <div class="flex justify-content-end gap-2">
                                <button pButton pRipple [label]="viewingCategory?.id === 'uncategorized' ? 'Assign' : 'Move'" 
                                    icon="pi pi-external-link" 
                                    class="p-button-text p-button-sm move-btn" 
                                    (click)="moveProduct(product)"></button>
                                <button *ngIf="viewingCategory?.id !== 'uncategorized'" pButton pRipple label="Remove" 
                                    icon="pi pi-times" class="p-button-text p-button-danger p-button-sm remove-btn" 
                                    (click)="removeProductFromCategory(product)"></button>
                            </div>
                        </td>
                    </tr>
                </ng-template>
                
                <ng-template pTemplate="emptymessage">
                    <tr>
                        <td colspan="4" class="text-center py-8">
                            <div class="empty-state">
                                <div class="empty-icon-circle">
                                    <i class="pi pi-box"></i>
                                </div>
                                <h3 class="m-0 mb-1">No products found</h3>
                                <p class="text-slate-500 m-0">This gallery is waiting for its items.</p>
                            </div>
                        </td>
                    </tr>
                </ng-template>
            </p-table>
        </div>
    </p-dialog>

    <!-- Move Product Dialog -->
    <p-dialog [(visible)]="moveDialog" [style]="{width: '450px'}" 
        [header]="viewingCategory?.id === 'uncategorized' ? 'Assign Category' : 'Move Product'" 
        [modal]="true" appendTo="body" styleClass="premium-dialog small-dialog">
        <div class="field pt-4 px-3">
            <label class="font-bold block mb-3 text-slate-300">Target Categories</label>
            <p-multiSelect [options]="otherCategories" [(ngModel)]="targetCategoryIds" optionLabel="name" optionValue="id"
                placeholder="Select where to move..." [filter]="true" filterBy="name" [showClear]="true"
                appendTo="body" styleClass="w-full premium-multiselect" panelStyleClass="premium-multiselect-panel" 
                display="chip">
            </p-multiSelect>
            <div class="mt-4 p-3 bg-slate-800 border-round-xl border-1 border-slate-700">
                <p class="m-0 text-sm text-slate-400">
                    <i class="pi pi-info-circle mr-2 text-blue-400"></i>
                    {{viewingCategory?.id === 'uncategorized' ? 'The product will be assigned to the selected categories.' : 'The product will be moved from ' + viewingCategory?.name + ' to the selected categories.'}}
                </p>
            </div>
        </div>
        <ng-template pTemplate="footer">
            <div class="flex gap-2 justify-content-end px-3 pb-3">
                <button pButton pRipple label="Cancel" class="p-button-text p-button-secondary" (click)="moveDialog = false"></button>
                <button pButton pRipple [label]="viewingCategory?.id === 'uncategorized' ? 'Assign' : 'Move'" 
                    icon="pi pi-check" (click)="confirmMove()" 
                    [disabled]="!targetCategoryIds || targetCategoryIds.length === 0" 
                    class="premium-btn-primary px-4"></button>
            </div>
        </ng-template>
    </p-dialog>

    <!-- Create/Edit Category Dialog -->
    <p-dialog [(visible)]="categoryDialog" [style]="{width: '450px'}" 
        [header]="currentCategoryId ? 'Edit Category' : 'Create New Category'" 
        [modal]="true" styleClass="premium-dialog" appendTo="body">
        <form [formGroup]="categoryForm" (ngSubmit)="saveCategory()" class="pt-4 px-3">
            <div class="field mb-4">
                <label for="name" class="font-bold block mb-2 text-slate-300">Category Name</label>
                <div class="p-input-icon-left w-full">
                    <i class="pi pi-tag"></i>
                    <input type="text" pInputText id="name" formControlName="name" required autofocus 
                        placeholder="e.g. Traditional Pottery" class="w-full premium-input" 
                        [ngClass]="{'ng-invalid ng-dirty': categoryForm.get('name')?.invalid && categoryForm.get('name')?.touched}" />
                </div>
                <small class="p-error fadein" *ngIf="categoryForm.get('name')?.invalid && categoryForm.get('name')?.touched">
                    Name is required to organize your products.
                </small>
            </div>
        </form>

        <ng-template pTemplate="footer">
            <div class="flex gap-2 justify-content-end px-3 pb-4">
                <button pButton pRipple label="Cancel" class="p-button-text p-button-secondary" (click)="hideDialog()"></button>
                <button pButton pRipple label="Save Category" icon="pi pi-save" 
                    (click)="saveCategory()" class="premium-btn-primary px-4"></button>
            </div>
        </ng-template>
    </p-dialog>

    <p-confirmDialog [style]="{width: '400px'}" appendTo="body" styleClass="premium-confirm-dialog"></p-confirmDialog>
  `,
    styles: [`
        :host { 
            display: block;
            background: radial-gradient(circle at 0% 0%, rgba(30, 41, 59, 0.4) 0%, transparent 40%),
                        radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.1) 0%, transparent 40%);
        }

        /* Premium Transitions */
        @keyframes subtle-lift {
            from { transform: translateY(0); }
            to { transform: translateY(-4px); }
        }

        /* Glassmorphism Classes */
        .glass-card {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        /* Buttons */
        .premium-btn-primary {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
            border: none !important;
            border-radius: 14px !important;
            padding: 0.8rem 1.6rem !important;
            font-weight: 600 !important;
            color: white !important;
            box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3) !important;
            transition: all 0.3s ease !important;
        }

        .premium-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(37, 99, 235, 0.4) !important;
            filter: brightness(1.1);
        }

        .premium-btn-secondary {
            border: 1px solid rgba(148, 163, 184, 0.3) !important;
            background: rgba(255, 255, 255, 0.03) !important;
            border-radius: 14px !important;
            padding: 0.8rem 1.6rem !important;
            font-weight: 600 !important;
            color: #f8fafc !important;
            backdrop-filter: blur(4px);
            transition: all 0.3s ease !important;
        }

        .premium-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.08) !important;
            border-color: rgba(148, 163, 184, 0.5) !important;
            transform: translateY(-1px);
        }

        /* Search Interface */
        .search-container {
            position: relative;
            width: 300px;
        }

        .search-icon {
            position: absolute;
            left: 1.25rem;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
            z-index: 1;
        }

        .search-input {
            width: 100%;
            background: rgba(2, 6, 23, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 50px !important;
            padding: 0.75rem 1rem 0.75rem 3rem !important;
            color: white !important;
            transition: all 0.3s ease !important;
        }

        .search-input:focus {
            background: rgba(2, 6, 23, 0.6) !important;
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
            width: 340px;
        }

        /* Premium Table V2 */
        ::ng-deep .premium-table-v2 {
            .p-datatable-header {
                background: transparent !important;
                border: none !important;
                padding: 1.5rem !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
            }

            .p-datatable-thead > tr > th {
                background: rgba(255, 255, 255, 0.02) !important;
                color: #94a3b8 !important;
                font-weight: 600 !important;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-size: 0.75rem;
                padding: 1.25rem 1.5rem !important;
                border: none !important;
            }

            .p-datatable-tbody > tr {
                background: transparent !important;
                color: #e2e8f0 !important;
                transition: all 0.2s ease;
            }

            .p-datatable-tbody > tr > td {
                padding: 1.25rem 1.5rem !important;
                border: none !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
            }

            .p-datatable-tbody > tr:hover {
                background: rgba(255, 255, 255, 0.03) !important;
            }

            .p-paginator {
                background: transparent !important;
                border: none !important;
                padding: 1rem !important;
                color: #64748b !important;

                .p-paginator-pages .p-paginator-page {
                    border-radius: 10px;
                    &.p-highlight {
                        background: rgba(59, 130, 246, 0.1) !important;
                        color: #3b82f6 !important;
                    }
                }
            }
        }

        .category-icon-box {
            width: 40px;
            height: 40px;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }

        .slug-tag {
            background: rgba(148, 163, 184, 0.1);
            color: #94a3b8;
            padding: 0.35rem 0.75rem;
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
        }

        /* Action Buttons */
        .action-btn {
            width: 2.5rem !important;
            height: 2.5rem !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .action-btn:hover {
            transform: scale(1.1);
        }

        .info-btn:hover { color: #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; }
        .success-btn:hover { color: #10b981 !important; background: rgba(16, 185, 129, 0.1) !important; }
        .danger-btn:hover { color: #ef4444 !important; background: rgba(239, 68, 68, 0.1) !important; }

        /* Clear p-button overrides and apply premium look to all dialogs */
        ::ng-deep .premium-dialog,
        ::ng-deep .premium-confirm-dialog {
            background: #0f172a !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 28px !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7) !important;
            overflow: hidden !important;

            .p-dialog-header {
                background: transparent !important;
                color: white !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
                padding: 1.75rem 2.5rem !important;
            }

            .p-dialog-title {
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                letter-spacing: -0.02em !important;
            }

            .p-dialog-header-icons,
            .p-confirm-dialog-header-icons {
                .p-dialog-header-close,
                .p-dialog-header-icon,
                .p-confirm-dialog-close {
                    width: 2.25rem !important;
                    height: 2.25rem !important;
                    background: rgba(255, 255, 255, 0.03) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    border-radius: 12px !important;
                    color: #94a3b8 !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    padding: 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    margin: 0 !important;

                    &:hover {
                        background: rgba(255, 255, 255, 0.1) !important;
                        color: white !important;
                        border-color: rgba(255, 255, 255, 0.2) !important;
                        transform: scale(1.05);
                    }
                }
            }

            .p-dialog-content {
                background: transparent !important;
                padding: 0 !important;
            }

            .p-dialog-footer {
                background: transparent !important;
                border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
                padding: 1.25rem 2.5rem !important;
            }
        }

        /* Input Icon Positioning Fix */
        .p-input-icon-left {
            position: relative;
            display: block;
            width: 100%;
            
            i {
                position: absolute;
                top: 50%;
                left: 1.25rem;
                transform: translateY(-50%);
                color: #64748b;
                z-index: 1;
                font-size: 1.1rem;
            }
        }

        /* Product Gallery inside Dialog */
        .product-img-container {
            width: 60px;
            height: 60px;
            background: rgba(2, 6, 23, 0.5);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .product-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 1;
        }

        .price-badge {
            background: rgba(16, 185, 129, 0.1);
            color: #10b981;
            padding: 0.4rem 0.8rem;
            border-radius: 10px;
            font-weight: 600;
            font-size: 0.9rem;
        }

        .move-btn { color: #64748b !important; }
        .move-btn:hover { color: #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; }
        
        .remove-btn:hover { background: rgba(239, 68, 68, 0.1) !important; }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            opacity: 0.6;
        }

        .empty-icon-circle {
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
            color: #334155;
        }

        /* Input Refinements */
        .premium-input {
            background: rgba(2, 6, 23, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
            padding: 0.85rem 1rem 0.85rem 3rem !important; /* Matches padding-left for icon */
            color: white !important;
        }

        .premium-input:focus {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
        }

        ::ng-deep .premium-multiselect {
            background: rgba(2, 6, 23, 0.5) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
            
            .p-multiselect-label {
                padding: 0.6rem 1rem !important;
            }

            .p-multiselect-token {
                background: rgba(59, 130, 246, 0.2) !important;
                color: #60a5fa !important;
                border-radius: 8px !important;
            }
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
    targetCategoryIds: string[] | null = null;
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
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products', life: 3000 });
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
        this.targetCategoryIds = []; // Reset selection
        // Exclude current category from options
        this.otherCategories = this.categories.filter(c => c.id !== this.viewingCategory?.id);
        this.moveDialog = true;
    }

    confirmMove() {
        if (!this.selectedProductForMove || !this.targetCategoryIds || this.targetCategoryIds.length === 0 || !this.viewingCategory) return;

        // console.log('Moving product:', this.selectedProductForMove.id, 'to categories:', this.targetCategoryIds);

        const productIdToRemove = this.selectedProductForMove.id;
        const targetIds = this.targetCategoryIds;
        const currentCategoryId = this.viewingCategory.id;

        // Map IDs to names for display
        const targetCategoryNames = this.categories
            .filter(c => targetIds.includes(c.id))
            .map(c => c.name)
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
                    life: 5000
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
            life: 3000
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
