import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, from } from 'rxjs';
import { map, catchError, tap, switchMap, mergeMap, toArray, shareReplay, finalize } from 'rxjs/operators';
import { Category } from '../../../models/category.model';
import { Product } from '../../../models/product.model';
import { ApiService } from '../api/api.service';
import { ProductService } from '../product/product.service';
import { CATEGORIES_API } from './category.api';
import { PRODUCTS_API } from '../product/product.api';
import { buildListQuery } from '../api/helpers';

const API_ENDPOINTS = {
    CATEGORIES: CATEGORIES_API,
    PRODUCTS: PRODUCTS_API
} as const;
import { signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * CategoryService - Backend API Integration
 */
const DEFAULT_CATEGORIES: Category[] = [
    { id: '1', name: 'Prodip', slug: 'prodip' },
    { id: '2', name: 'Protima', slug: 'protima' },
    { id: '3', name: 'Shora', slug: 'shora' },
    { id: '4', name: 'Home Decor', slug: 'home-decor' },
    { id: '5', name: 'Mirror', slug: 'mirror' },
    { id: '6', name: 'Sharee', slug: 'sharee' }
];

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private readonly CACHE_KEY = 'karukolpo_categories_cache';
    public categories = signal<Category[]>(DEFAULT_CATEGORIES);
    private pendingCategoriesRequest: Observable<Category[]> | null = null;

    constructor(
        private apiService: ApiService,
        private productService: ProductService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        if (isPlatformBrowser(this.platformId)) {
            const cached = this.loadFromCache();
            if (cached && cached.length > 0) {
                this.categories.set(cached);
            }

            // Always trigger background refresh to ensure we have the latest categories from the production database
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
        this.categories.set(DEFAULT_CATEGORIES);
        this.refreshCache();
    }

    private loadFromCache(): Category[] {
        if (!isPlatformBrowser(this.platformId)) return DEFAULT_CATEGORIES;
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            return cached ? JSON.parse(cached) : DEFAULT_CATEGORIES;
        } catch (e) {
            console.warn('CategoryService: Failed to load categories from cache', e);
            return DEFAULT_CATEGORIES;
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
        if (this.pendingCategoriesRequest) {
            return this.pendingCategoriesRequest;
        }

        const query = buildListQuery(skip, limit);
        const request = this.apiService.get<any[]>(`${API_ENDPOINTS.CATEGORIES.LIST}${query}`).pipe(
            map(categories => categories.map(cat => this.mapBackendToFrontend(cat))),
            shareReplay(1),
            finalize(() => this.pendingCategoriesRequest = null)
        );

        this.pendingCategoriesRequest = request;
        return request;
    }

    /**
     * Get category by ID
     * GET /categories/{id}
     */
    getCategoryById(id: string): Observable<Category | undefined> {
        return this.apiService.get<any>(API_ENDPOINTS.CATEGORIES.GET_BY_ID(id)).pipe(
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
        const backendCategory = { name: category.name };
        return this.apiService.patch<any>(API_ENDPOINTS.CATEGORIES.UPDATE(category.id), backendCategory).pipe(
            map(cat => this.mapBackendToFrontend(cat)),
            tap(() => this.refreshCache())
        );
    }

    /**
     * Delete category
     * DELETE /categories/{id} (requires auth)
     */
    deleteCategory(id: string): Observable<void> {
        return this.apiService.delete<void>(API_ENDPOINTS.CATEGORIES.DELETE(id)).pipe(
            tap(() => this.refreshCache())
        );
    }

    /**
     * Get products in a category (admin use).
     *
     * For a real category ID: fetches the category directly via GET /categories/{id}
     * which already includes the populated `products: []` array in a single fast call.
     * Fallback: GET /products?category_id={id}
     *
     * For 'uncategorized': fetches products once and filters those with no category.
     */
    getCategoryProducts(categoryId: string): Observable<Product[]> {
        if (categoryId !== 'uncategorized') {
            return this.apiService.get<any>(API_ENDPOINTS.CATEGORIES.GET_BY_ID(categoryId)).pipe(
                map(cat => {
                    const mappedCat = this.mapBackendToFrontend(cat);
                    return mappedCat.products || [];
                }),
                catchError(err => {
                    console.warn(`GET /categories/${categoryId} failed, falling back to products query:`, err);
                    return this.productService.getProducts(0, 1000, categoryId, true);
                })
            );
        }

        // For uncategorized products:
        return this.productService.getProducts(0, 1000, undefined, true).pipe(
            map(products => products.filter(p =>
                !p.categoryId ||
                p.categoryId === 'uncategorized' ||
                p.categoryId === '0' ||
                (Array.isArray(p.categories) && p.categories.length === 0)
            ))
        );
    }

    /**
     * Get products for a public category page with a single API call.
     * Uses GET /products?category_id={id} — fast, no per-product fetches.
     * Use this for the public-facing category products page only.
     */
    getProductsByCategory(categoryId: string): Observable<Product[]> {
        return this.productService.getProducts(0, 1000, categoryId);
    }

    /**
     * Remove product from category
     * DELETE /categories/{categoryId} (with productId)
     */
    removeProductFromCategory(categoryId: string, productId: string): Observable<void> {
        const endpoint = API_ENDPOINTS.PRODUCTS.REMOVE_CATEGORY(productId, categoryId);

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
    moveProductToCategory(productId: string, oldCategoryId: string, newCategoryId: string): Observable<void> {
        return this.apiService.patch<void>(API_ENDPOINTS.CATEGORIES.UPDATE(oldCategoryId), {
            move_product_id: productId,
            to_category_id: newCategoryId
        });
    }

    /**
     * Map backend category format to frontend format
     */
    private mapBackendToFrontend(backendCategory: any): Category {
        const category: Category = {
            id: backendCategory.id?.toString() || '',
            name: backendCategory.name,
            slug: backendCategory.slug || this.generateSlug(backendCategory.name)
        };

        if (backendCategory.products && Array.isArray(backendCategory.products)) {
            category.products = backendCategory.products.map((p: any) =>
                this.productService.mapBackendToFrontend(p)
            );
        }

        return category;
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
