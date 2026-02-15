import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, tap, switchMap, mergeMap, toArray } from 'rxjs/operators';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { ApiService } from './api.service';
import { ProductService } from './product.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

/**
 * CategoryService - Backend API Integration
 */
@Injectable({
    providedIn: 'root'
})
export class CategoryService {

    constructor(
        private apiService: ApiService,
        private productService: ProductService
    ) { }

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
     * Get products in a category with optimized fetching and caching
     */
    getCategoryProducts(categoryId: number | string): Observable<Product[]> {
        const id = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;

        return this.productService.getProducts(0, 1000).pipe(
            switchMap(products => {
                if (products.length === 0) return of([]);

                // Use from(products) to create a stream of individual products
                return from(products).pipe(
                    // mergeMap with concurrency limit of 5
                    mergeMap(product => {
                        const pId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
                        return this.productService.listProductCategories(pId).pipe(
                            map(categories => {
                                const belongsToCategory = categories.some((c: any) =>
                                    (typeof c === 'object' ? c.id : c) == id
                                );
                                return belongsToCategory ? product : null;
                            })
                        );
                    }, 5),
                    toArray(),
                    map(results => results.filter(p => p !== null) as Product[])
                );
            }),
        );
    }

    /**
     * Remove product from category
     * DELETE /categories/{categoryId} (with productId)
     */
    removeProductFromCategory(categoryId: number | string, productId: number | string): Observable<void> {
        const cId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
        const pId = typeof productId === 'string' ? parseInt(productId, 10) : productId;

        if (isNaN(cId) || isNaN(pId)) {
            console.error('CategoryService: Invalid IDs (NaN) provided!');
        }

        const endpoint = API_ENDPOINTS.PRODUCTS.REMOVE_CATEGORY(pId, cId);

        return this.apiService.delete<void>(endpoint).pipe(
            tap({
                next: () => {
                    this.productService.clearCache();
                },
                error: (err) => console.error('CategoryService: Failed to remove product from category', err)
            })
        );
    }

    /**
     * Move product to another category
     * PATCH /categories/{categoryId}
     */
    moveProductToCategory(productId: number | string, oldCategoryId: number | string, newCategoryId: number | string): Observable<void> {
        const oldCId = typeof oldCategoryId === 'string' ? parseInt(oldCategoryId, 10) : oldCategoryId;
        const pId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
        const newCId = typeof newCategoryId === 'string' ? parseInt(newCategoryId, 10) : newCategoryId;

        return this.apiService.patch<void>(API_ENDPOINTS.CATEGORIES.UPDATE(oldCId), {
            move_product_id: pId,
            to_category_id: newCId
        });
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
