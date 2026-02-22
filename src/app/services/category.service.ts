import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, tap, switchMap, mergeMap, toArray } from 'rxjs/operators';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { ApiService } from './api.service';
import { ProductService } from './product.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';
import { signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * CategoryService - Backend API Integration
 */
@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private readonly CACHE_KEY = 'karukolpo_categories_cache';
    public categories = signal<Category[]>([]);

    constructor(
        private apiService: ApiService,
        private productService: ProductService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        if (isPlatformBrowser(this.platformId)) {
            this.categories.set(this.loadFromCache());
            // Background refresh on service initialization
            this.refreshCache();
        }
    }

    /**
     * Clear service-related caches
     */
    clearCache() {
        this.productService.clearCache();
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(this.CACHE_KEY);
        }
        this.categories.set([]);
        this.refreshCache();
    }

    private loadFromCache(): Category[] {
        if (!isPlatformBrowser(this.platformId)) return [];
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            console.warn('CategoryService: Failed to load categories from cache', e);
            return [];
        }
    }

    private refreshCache() {
        this.getCategories().subscribe({
            next: (cats) => {
                this.categories.set(cats);
                if (isPlatformBrowser(this.platformId)) {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cats));
                }
            },
            error: (err) => console.error('CategoryService: Background refresh failed', err)
        });
    }

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
            map(cat => this.mapBackendToFrontend(cat)),
            tap(() => this.refreshCache())
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
            map(cat => this.mapBackendToFrontend(cat)),
            tap(() => this.refreshCache())
        );
    }

    /**
     * Delete category
     * DELETE /categories/{id} (requires auth)
     */
    deleteCategory(id: number | string): Observable<void> {
        const categoryId = typeof id === 'string' ? parseInt(id, 10) : id;
        return this.apiService.delete<void>(API_ENDPOINTS.CATEGORIES.DELETE(categoryId)).pipe(
            tap(() => this.refreshCache())
        );
    }

    /**
     * Get products in a category (admin use). Checks the junction table per-product
     * so that admin Remove/Move actions are always reflected accurately.
     *
     * For 'uncategorized': fetches all products and checks which have no category entries.
     * For a real category ID: fetches all products and checks each one's categories via
     * GET /products/{id}/categories so junction-table changes are immediately visible.
     */
    getCategoryProducts(categoryId: number | string): Observable<Product[]> {
        const isUncategorized = categoryId === 'uncategorized';
        const id = isUncategorized ? -1 : (typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId);

        return this.productService.getProducts(0, 1000, undefined, true).pipe(
            switchMap(products => {
                if (products.length === 0) return of([]);

                return from(products).pipe(
                    mergeMap(product => {
                        const pId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
                        return this.productService.listProductCategories(pId).pipe(
                            map(categories => {
                                // Populate the categories array on the product object
                                product.categories = categories || [];

                                // Determine if product belongs to the requested category
                                if (isUncategorized) {
                                    return (product.categories.length === 0) ? product : null;
                                }

                                const belongsToCategory = product.categories.some((c: any) =>
                                    (typeof c === 'object' ? (c.id || c.categoryId) : c) == id
                                );
                                return belongsToCategory ? product : null;
                            }),
                            catchError(() => {
                                // If categories fetch fails, fallback to existing product state
                                if (isUncategorized) {
                                    const hasKnownCategories = product.categories && product.categories.length > 0;
                                    const isLikelyUncategorized = !hasKnownCategories && (!product.categoryId || product.categoryId === '0');
                                    return of(isLikelyUncategorized ? product : null);
                                }
                                return of(null);
                            })
                        );
                    }, 10),
                    toArray(),
                    map(results => results.filter(p => p !== null) as Product[])
                );
            }),
        );
    }

    /**
     * Get products for a public category page with a single API call.
     * Uses GET /products?category_id={id} — fast, no per-product fetches.
     * Use this for the public-facing category products page only.
     */
    getProductsByCategory(categoryId: number | string): Observable<Product[]> {
        const id = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
        return this.productService.getProducts(0, 1000, id);
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
        if (!name) return 'category';
        // Replace spaces and special URL-unsafe chars with hyphens
        // but try to keep Unicode characters if they are roughly word-like
        let slug = name.toLowerCase()
            .trim()
            .replace(/[\s\t\n\r]+/g, '-')       // spaces/tabs/newlines to hyphens
            .replace(/[^\w\u00C0-\u1FFF\u2C00-\uD7FF-]+/g, '') // keep word chars, hyphens, and most Unicode ranges
            .replace(/-+/g, '-');               // collapse multiple hyphens

        return slug || 'category';
    }
}
