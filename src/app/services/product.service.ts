import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, forkJoin } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay, finalize } from 'rxjs/operators';
import { Product, ProductImage } from '../models/product.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

/**
 * ProductService - Backend API Integration
 * URL configured in src/environments/environment.ts
 */
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsCache: Product[] | null = null;
  private productCategoriesCache = new Map<string | number, any[]>();
  private productMap = new Map<string | number, Product>();
  private pendingProductsRequest: Observable<Product[]> | null = null;

  constructor(
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  /**
   * Clear all in-memory caches
   */
  clearCache() {
    this.productsCache = null;
    this.productCategoriesCache.clear();
    this.productMap.clear();
  }

  /**
   * Get all products from backend
   * GET /products
   */
  getProducts(skip = 0, limit = 100, categoryId?: string | number, forceRefresh = false): Observable<Product[]> {
    if (!forceRefresh && !categoryId && this.productsCache) {
      return of(this.productsCache);
    }

    // Deduplicate simultaneous requests for the same base list
    if (!forceRefresh && !categoryId && skip === 0 && this.pendingProductsRequest) {
      return this.pendingProductsRequest;
    }

    let query = buildListQuery(skip, limit);
    if (categoryId) {
      query += `&category_id=${categoryId}`;
    }

    const request = this.apiService.get<any[]>(`${API_ENDPOINTS.PRODUCTS.LIST}${query}`).pipe(
      map(backendProducts => {
        return backendProducts.map(p => this.mapBackendToFrontend(p));
      }),
      tap(products => {
        if (!categoryId && skip === 0 && isPlatformBrowser(this.platformId)) {
          this.productsCache = products;
        }
      }),
      shareReplay(1),
      finalize(() => {
        if (!categoryId && skip === 0) {
          this.pendingProductsRequest = null;
        }
      })
    );

    if (!categoryId && skip === 0) {
      this.pendingProductsRequest = request;
    }

    return request;
  }

  /**
   * Get product by ID with caching
   * GET /products/{id}
   */
  getProductById(id: number | string, forceRefresh = false): Observable<Product | undefined> {
    const stringId = id.toString();
    if (!forceRefresh && this.productMap.has(stringId)) {
      return of(this.productMap.get(stringId));
    }

    return this.apiService.get<any>(API_ENDPOINTS.PRODUCTS.GET_BY_ID(id)).pipe(
      map(p => {
        const product = this.mapBackendToFrontend(p);
        this.productMap.set(stringId, product);
        return product;
      }),
      catchError(() => of(undefined))
    );
  }

  /**
   * Create new product
   * POST /products (requires auth)
   */
  addProduct(product: Product): Observable<Product> {
    const backendProduct = this.mapFrontendToBackend(product);
    return this.apiService.post<any>(API_ENDPOINTS.PRODUCTS.CREATE, backendProduct).pipe(
      map(p => this.mapBackendToFrontend(p))
    );
  }

  /**
   * Update existing product
   * PATCH /products/{id} (requires auth)
   */
  updateProduct(product: Product): Observable<Product> {
    const productId = product.id;
    const backendProduct = this.mapFrontendToBackend(product);
    return this.apiService.patch<any>(API_ENDPOINTS.PRODUCTS.UPDATE(productId), backendProduct).pipe(
      map(p => this.mapBackendToFrontend(p))
    );
  }

  /**
   * Delete product
   * DELETE /products/{id} (requires auth)
   */
  deleteProduct(id: number | string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.DELETE(id));
  }

  /**
   * Get product inventory
   * GET /products/{id}/inventory (requires auth)
   */
  getInventory(productId: number | string): Observable<{ product_id: number; quantity: number }> {
    return this.apiService.get(API_ENDPOINTS.PRODUCTS.GET_INVENTORY(productId));
  }

  /**
   * Update product inventory
   * PATCH /products/{id}/inventory (requires auth)
   */
  updateInventory(productId: number | string, quantity: number): Observable<any> {
    const payload = { quantity: parseInt(String(quantity)) };

    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.UPDATE_INVENTORY(productId), payload);
  }

  /**
   * Add category to product
   * POST /products/{productId}/categories/{categoryId}
   */
  addCategoryToProduct(productId: number | string, categoryId: number | string): Observable<any> {
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_CATEGORY(productId, categoryId), {});
  }

  /**
   * Remove category from product
   * DELETE /products/{productId}/categories/{categoryId}
   */
  removeCategoryFromProduct(productId: number | string, categoryId: number | string): Observable<any> {
    return this.apiService.delete(API_ENDPOINTS.PRODUCTS.REMOVE_CATEGORY(productId, categoryId));
  }

  /**
   * Add multiple categories to product
   * POST /products/{productId}/categories
   */
  addMultipleCategoriesToProduct(productId: number | string, categoryIds: (number | string)[]): Observable<any> {
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_MULTIPLE_CATEGORIES(productId), categoryIds);
  }

  /**
   * Update product categories (replace all)
   * PUT /products/{productId}/categories
   */
  updateProductCategories(productId: number | string, categoryIds: (number | string)[]): Observable<any> {
    return this.apiService.put(API_ENDPOINTS.PRODUCTS.UPDATE_CATEGORIES(productId), categoryIds);
  }

  /**
   * List categories for a product
   * GET /products/{productId}/categories
   */
  listProductCategories(productId: number | string, forceRefresh = false): Observable<any[]> {
    if (!forceRefresh && this.productCategoriesCache.has(productId)) {
      return of(this.productCategoriesCache.get(productId)!);
    }
    return this.apiService.get<any[]>(API_ENDPOINTS.PRODUCTS.LIST_CATEGORIES(productId)).pipe(
      tap(categories => this.productCategoriesCache.set(productId, categories))
    );
  }

  /**
   * Add image to product
   * POST /products/{productId}/images
   */
  addImage(productId: number | string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_IMAGE(productId), formData);
  }

  /**
   * Bulk upload images to product
   * POST /products/{productId}/images/bulk
   */
  bulkUploadImages(productId: number | string, primaryFile: File, additionalFiles: File[]): Observable<any[]> {
    const formData = new FormData();
    formData.append('primary_image', primaryFile);
    additionalFiles.forEach(file => {
      formData.append('gallery_images', file);
    });
    return this.apiService.post<any[]>(API_ENDPOINTS.PRODUCTS.BULK_UPLOAD_IMAGES(productId), formData);
  }

  /**
   * Remove image from product
   * DELETE /products/{productId}/images/{imageId}
   */
  removeImage(productId: number | string, imageId: number | string): Observable<any> {
    return this.apiService.delete(API_ENDPOINTS.PRODUCTS.REMOVE_IMAGE(productId, imageId));
  }

  /**
   * Set primary image
   * PATCH /products/{productId}/images/{imageId}/set-primary
   */
  setPrimaryImage(productId: number | string, imageId: number | string): Observable<any> {
    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId), null);
  }

  /**
   * Batch update images
   * PATCH /products/{productId}/images/batch?new_primary_id={newPrimaryId}
   */
  batchUpdateImages(
    productId: number | string,
    newPrimaryId?: number | string | null,
    newPrimaryFile?: File,
    newGalleryFiles?: File[],
    deleteImageIds?: (number | string)[]
  ): Observable<any[]> {
    const formData = new FormData();

    if (newPrimaryFile) {
      formData.append('primary_image', newPrimaryFile);
    }

    if (newGalleryFiles && newGalleryFiles.length > 0) {
      newGalleryFiles.forEach(file => {
        formData.append('gallery_images', file);
      });
    }

    if (deleteImageIds && deleteImageIds.length > 0) {
      deleteImageIds.forEach(id => {
        formData.append('delete_image_ids', String(id));
      });
    }

    let url = API_ENDPOINTS.PRODUCTS.BATCH_UPDATE_IMAGES(productId);
    if (newPrimaryId !== undefined && newPrimaryId !== null) {
      url += `?new_primary_id=${newPrimaryId}`;
    }

    return this.apiService.patch<any[]>(url, formData);
  }

  /**
   * Reduce stock (used when order is placed)
   */
  reduceStock(items: { product: Product, quantity: number }[]): Observable<void> {
    const updates = items.map(item => {
      const productId = item.product.id;
      const newQuantity = (item.product.stock || 0) - item.quantity;
      return this.updateInventory(productId, Math.max(0, newQuantity));
    });

    return forkJoin(updates).pipe(
      map(() => void 0)
    );
  }

  /**
   * Restore stock (used when order is cancelled)
   */
  restoreStock(items: { product: Product, quantity: number }[]): Observable<void> {
    const updates = items.map(item => {
      const productId = item.product.id;
      const newQuantity = (item.product.stock || 0) + item.quantity;
      return this.updateInventory(productId, newQuantity);
    });

    return forkJoin(updates).pipe(
      map(() => void 0)
    );
  }

  /**
   * Get products with low stock
   */
  getLowStockProducts(threshold = 5): Observable<Product[]> {
    return this.getProducts().pipe(
      map(products => products.filter(p => (p.stock || 0) <= threshold))
    );
  }

  /**
   * Map backend product format to frontend format
   * FIX: Added URL deduplication to prevent duplicate images in gallery
   */
  public mapBackendToFrontend(data: any): Product {
    // Collect potential stock fields
    const stockQty = data.stock_quantity ?? data.available_quantity ?? data.quantity ?? data.stock;
    const stock = stockQty !== undefined ? parseInt(String(stockQty), 10) : 0;

    // Normalize manual status (handle lowercase from some API versions)
    let rawStatus = data.stock_status || data.manual_stock_status || data.manualStockStatus || 'AUTO';
    if (typeof rawStatus === 'string') {
      rawStatus = rawStatus.toUpperCase();
      // Handle common variations
      if (rawStatus === 'INSTOCK') rawStatus = 'IN_STOCK';
      if (rawStatus === 'OUTOFSTOCK') rawStatus = 'OUT_OF_STOCK';
    }
    const manualStatus = rawStatus as 'IN_STOCK' | 'OUT_OF_STOCK' | 'AUTO';

    // Map Images
    let mainImageUrl = data.primary_image_url || data.imageUrl || 'assets/images/placeholder.jpg';
    let galleryImages: string[] = [];

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      // 1. Identify the primary image object
      const primaryImage = data.images.find((img: any) => img.is_primary) || data.images[0];

      if (primaryImage) {
        // Enforce image_medium for home/list cards for optimal loading/quality balance
        mainImageUrl = primaryImage.image_medium || primaryImage.image_large || primaryImage.image_thumb || primaryImage.image_path || mainImageUrl;
      }

      // 2. Map all image records to their high-quality 'large' variant for the product details carousel
      galleryImages = data.images
        .map((img: any) => img.image_large || img.image_medium || img.image_thumb || img.image_path)
        .filter(Boolean);

    } else if (data.image) {
      mainImageUrl = data.image;
      galleryImages = [data.image];
    }

    // Determine final in-stock status
    let isInStock = false;
    if (data.is_in_stock !== undefined) {
      isInStock = !!data.is_in_stock;
    } else if (manualStatus === 'IN_STOCK') {
      isInStock = true;
    } else if (manualStatus === 'OUT_OF_STOCK') {
      isInStock = false;
    } else {
      isInStock = stock > 0;
    }

    return {
      id: data.id?.toString() || '',
      code: data.code || `PROD-${data.id}`,
      name: data.name || '',
      description: data.description ? this.decodeHtml(data.description) : '',
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      imageUrl: mainImageUrl,
      images: galleryImages,
      imageObjects: data.images || [],
      categoryId: data.category_id?.toString() ||
        (data.categories && data.categories.length > 0 ? data.categories[0].id.toString() : 'uncategorized'),
      categories: data.categories || [],
      stock: stock,
      manualStockStatus: manualStatus,
      isInStock: isInStock
    };
  }



  /**
   * Helper to decode HTML entities (e.g., &lt; to <)
   * This handles double-encoded content from backends or manual entries.
   */
  private decodeHtml(html: string): string {
    if (!html) return '';

    if (isPlatformBrowser(this.platformId)) {
      try {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
      } catch (e) {
        console.warn('HTML decoding failed:', e);
        return html;
      }
    }

    // SSR fallback: basic entity decoding
    return html
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Map frontend product format to backend format
   */
  private mapFrontendToBackend(product: Product): any {
    return {
      name: product.name,
      price: product.price,
      description: product.description || null
    };
  }
}
