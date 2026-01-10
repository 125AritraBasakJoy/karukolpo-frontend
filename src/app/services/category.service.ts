import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Category } from '../models/category.model';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private readonly STORAGE_KEY = 'categories';
    private categories: Category[] = [];

    constructor() {
        this.loadCategories();
        window.addEventListener('storage', (event) => {
            if (event.key === this.STORAGE_KEY) {
                this.loadCategories();
            }
        });
    }

    private loadCategories() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                this.categories = JSON.parse(saved);
            } catch (e) {
                console.error('Error parsing categories from local storage', e);
                this.categories = [];
            }
        } else {
            // Initialize with some default categories if needed, or empty
            this.categories = [];
        }
    }

    private saveToStorage(): boolean {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.categories));
            return true;
        } catch (e) {
            console.error('Error saving categories to local storage', e);
            return false;
        }
    }

    getCategories(): Observable<Category[]> {
        this.loadCategories();
        return of([...this.categories]);
    }

    getCategoryById(id: string): Observable<Category | undefined> {
        this.loadCategories();
        return of(this.categories.find(c => c.id === id));
    }

    addCategory(category: Category): Observable<void> {
        if (this.categories.some(c => c.name.toLowerCase() === category.name.toLowerCase())) {
            return throwError(() => new Error('Category with this name already exists.'));
        }

        const newCategory = {
            ...category,
            id: Date.now().toString(),
            slug: this.generateSlug(category.name)
        };
        this.categories.push(newCategory);

        if (!this.saveToStorage()) {
            this.categories.pop();
            return throwError(() => new Error('Storage Full! Could not save category.'));
        }

        return of(void 0);
    }

    updateCategory(category: Category): Observable<void> {
        const index = this.categories.findIndex(c => c.id === category.id);
        if (index !== -1) {
            // Check for name duplicate excluding self
            if (this.categories.some(c => c.name.toLowerCase() === category.name.toLowerCase() && c.id !== category.id)) {
                return throwError(() => new Error('Category with this name already exists.'));
            }

            const originalCategory = this.categories[index];
            this.categories[index] = {
                ...category,
                slug: this.generateSlug(category.name)
            };

            if (!this.saveToStorage()) {
                this.categories[index] = originalCategory;
                return throwError(() => new Error('Storage Full! Could not update category.'));
            }
        }
        return of(void 0);
    }

    deleteCategory(id: string): Observable<void> {
        const originalCategories = [...this.categories];
        this.categories = this.categories.filter(c => c.id !== id);

        if (!this.saveToStorage()) {
            this.categories = originalCategories;
            return throwError(() => new Error('Could not delete category. Storage error.'));
        }

        return of(void 0);
    }

    private generateSlug(name: string): string {
        return name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
}
