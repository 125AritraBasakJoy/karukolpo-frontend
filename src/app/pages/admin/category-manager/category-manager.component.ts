import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';
import { Category } from '../../../models/category.model';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToolbarModule } from 'primeng/toolbar';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

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
        InputTextareaModule,
        ToolbarModule,
        ToastModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
    <div class="card">
        <p-toolbar styleClass="mb-4 gap-2">
            <ng-template pTemplate="left">
                <button pButton pRipple label="New Category" icon="pi pi-plus" class="p-button-success mr-2" (click)="openNew()"></button>
            </ng-template>
        </p-toolbar>

        <p-table [value]="categories" [rows]="10" [paginator]="true" [globalFilterFields]="['name']"
            [tableStyle]="{'min-width': '75rem'}" selectionMode="single" dataKey="id">
            <ng-template pTemplate="caption">
                <div class="flex align-items-center justify-content-between">
                    <h5 class="m-0">Manage Categories</h5>
                </div>
            </ng-template>
            <ng-template pTemplate="header">
                <tr>
                    <th pSortableColumn="name" style="min-width:15rem">Name <p-sortIcon field="name"></p-sortIcon></th>
                    <th>Slug</th>
                    <th>Actions</th>
                </tr>
            </ng-template>
            <ng-template pTemplate="body" let-category>
                <tr>
                    <td>{{category.name}}</td>
                    <td>{{category.slug}}</td>
                    <td>
                        <button pButton pRipple icon="pi pi-pencil" class="p-button-rounded p-button-success mr-2" (click)="editCategory(category)"></button>
                        <button pButton pRipple icon="pi pi-trash" class="p-button-rounded p-button-warning" (click)="deleteCategory(category)"></button>
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

    <p-dialog [(visible)]="categoryDialog" [style]="{width: '450px'}" header="Category Details" [modal]="true" styleClass="p-fluid">
        <ng-template pTemplate="content">
            <form [formGroup]="categoryForm">
                <div class="field">
                    <label for="name">Name</label>
                    <input type="text" pInputText id="name" formControlName="name" required autofocus />
                    <small class="p-error" *ngIf="categoryForm.get('name')?.invalid && categoryForm.get('name')?.touched">Name is required.</small>
                </div>
            </form>
        </ng-template>

        <ng-template pTemplate="footer">
            <button pButton pRipple label="Cancel" icon="pi pi-times" class="p-button-text" (click)="hideDialog()"></button>
            <button pButton pRipple label="Save" icon="pi pi-check" class="p-button-text" (click)="saveCategory()"></button>
        </ng-template>
    </p-dialog>

    <p-confirmDialog [style]="{width: '450px'}"></p-confirmDialog>
  `,
    styles: [`:host { display: block; }`]
})
export class CategoryManagerComponent implements OnInit {
    categoryDialog: boolean = false;
    categories: Category[] = [];
    categoryForm: FormGroup;
    currentCategoryId: string | null = null;

    private categoryService = inject(CategoryService);
    private messageService = inject(MessageService);
    private confirmationService = inject(ConfirmationService);
    private fb = inject(FormBuilder);

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
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
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

    hideDialog() {
        this.categoryDialog = false;
        this.categoryForm.reset();
    }

    saveCategory() {
        console.log('saveCategory called');
        if (this.categoryForm.invalid) {
            console.warn('Form is invalid', this.categoryForm.errors);
            this.categoryForm.markAllAsTouched();
            return;
        }

        const categoryData = this.categoryForm.value;
        console.log('Category data:', categoryData);

        if (this.currentCategoryId) {
            console.log('Updating category with ID:', this.currentCategoryId);
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
                    console.error('Category update error:', err);
                    let errorMessage = 'Failed to update category';

                    if (err.status === 401 || err.status === 403) {
                        errorMessage = 'Authentication required. Please login as admin first.';
                    } else if (err.status === 400 && err.error?.detail === 'Database constraint violated') {
                        errorMessage = 'Category name already exists.';
                    } else if (err.error?.detail) {
                        errorMessage = typeof err.error.detail === 'string' ? err.error.detail : JSON.stringify(err.error.detail);
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
            // Create new category
            console.log('Creating new category');
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
                    console.error('Category creation error:', err);
                    let errorMessage = 'Failed to create category';

                    if (err.status === 401 || err.status === 403) {
                        errorMessage = 'Authentication required. Please login as admin first.';
                    } else if (err.status === 400 && err.error?.detail === 'Database constraint violated') {
                        errorMessage = 'Category name already exists.';
                    } else if (err.error?.detail) {
                        errorMessage = typeof err.error.detail === 'string' ? err.error.detail : JSON.stringify(err.error.detail);
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
}
