import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Category } from '../models/category.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

/**
 * CategoryService - Backend API Integration
 * Connects to: https://karukolpo-backend.onrender.com/categories
 */
@Injectable({
    providedIn: 'root'
})
export class CategoryService {

    constructor(private apiService: ApiService) { }

    /**
     * Get all categories from backend
     * GET /categories
     */
    getCategories(skip = 0, limit = 100): Observable<Category[]> {
        const query = buildListQuery(skip, limit);
        return this.apiService.get<any[]>(`${API_ENDPOINTS.CATEGORIES.LIST}${query}`).pipe(
            map(categories => categories.map(cat => this.mapBackendToFrontend(cat)))
        );
    }

    /**
     * Get category by ID
     * GET /categories/{id}
     */
    getCategoryById(id: number | string): Observable<Category | undefined> {
        const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
        return this.apiService.get<any>(API_ENDPOINTS.CATEGORIES.GET_BY_ID(categoryId)).pipe(
            map(cat => this.mapBackendToFrontend(cat)),
            catchError(() => {
                return new Observable<Category | undefined>(observer => {
                    observer.next(undefined);
                    observer.complete();
                });
            })
        );
    }

    /**
     * Create new category
     * POST /categories (requires auth)
     */
    addCategory(category: Category): Observable<Category> {
        const backendCategory = { name: category.name };
        console.log('CategoryService: Adding category', backendCategory);
        return this.apiService.post<any>(API_ENDPOINTS.CATEGORIES.CREATE, backendCategory).pipe(
            map(cat => this.mapBackendToFrontend(cat))
        );
    }

    /**
     * Update existing category
     * PATCH /categories/{id} (requires auth)
     */
    updateCategory(category: Category): Observable<Category> {
        const categoryId = typeof category.id === 'string' ? parseInt(category.id, 10) : category.id;
        const backendCategory = { name: category.name };
        console.log('CategoryService: Updating category', categoryId, backendCategory);
        return this.apiService.patch<any>(API_ENDPOINTS.CATEGORIES.UPDATE(categoryId), backendCategory).pipe(
            map(cat => this.mapBackendToFrontend(cat))
        );
    }

    /**
     * Delete category
     * DELETE /categories/{id} (requires auth)
     */
    deleteCategory(id: number | string): Observable<void> {
        const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
        return this.apiService.delete<void>(API_ENDPOINTS.CATEGORIES.DELETE(categoryId));
    }

    /**
     * Map backend category format to frontend format
     */
    private mapBackendToFrontend(backendCategory: any): Category {
        return {
            id: backendCategory.id?.toString() || '',
            name: backendCategory.name,
            slug: backendCategory.slug || this.generateSlug(backendCategory.name)
        };
    }

    /**
     * Generate URL-friendly slug from category name
     */
    private generateSlug(name: string): string {
        return name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
}
