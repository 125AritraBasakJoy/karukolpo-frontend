import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, forkJoin, timer } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay, finalize, filter, take } from 'rxjs/operators';
import { Product, ProductImage } from '../../../models/product.model';
import { ApiService } from '../api/api.service';
import { PRODUCTS_API } from './product.api';
import { buildListQuery } from '../api/helpers';
import { environment } from '../../../../environments/environment';

const API_ENDPOINTS = {
  PRODUCTS: PRODUCTS_API
} as const;

/**
 * ProductService - Backend API Integration
 * URL configured in src/environments/environment.ts
 */
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsCache: Product[] | null = null;
  private hotDealsCache: Product[] | null = null;
  private bestSellersCache: Product[] | null = null;
  private productCategoriesCache = new Map<string | number, any[]>();
  private productMap = new Map<string | number, Product>();
  private pendingProductsRequest: Observable<Product[]> | null = null;
  private pendingHotDealsRequest: Observable<Product[]> | null = null;
  private pendingBestSellersRequest: Observable<Product[]> | null = null;

  constructor(
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  /**
   * Clear all in-memory caches
   */
  clearCache() {
    this.productsCache = null;
    this.hotDealsCache = null;
    this.bestSellersCache = null;
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
  getProductById(id: string, forceRefresh = false): Observable<Product | undefined> {
    if (!forceRefresh && this.productMap.has(id)) {
      return of(this.productMap.get(id));
    }

    return this.apiService.get<any>(API_ENDPOINTS.PRODUCTS.GET_BY_ID(id)).pipe(
      map(p => {
        const product = this.mapBackendToFrontend(p);
        this.productMap.set(id, product);
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
  deleteProduct(id: string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.DELETE(id));
  }

  /**
   * Get product inventory
   * GET /products/{id}/inventory (requires auth)
   */
  getInventory(productId: string): Observable<{ product_id: string; quantity: number }> {
    return this.apiService.get(API_ENDPOINTS.PRODUCTS.GET_INVENTORY(productId));
  }

  /**
   * Update product inventory
   * PATCH /products/{id}/inventory (requires auth)
   */
  updateInventory(productId: string, quantity: number): Observable<any> {
    const payload = { quantity: parseInt(String(quantity)) };

    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.UPDATE_INVENTORY(productId), payload);
  }

  /**
   * Add category to product
   * POST /products/{productId}/categories/{categoryId}
   */
  addCategoryToProduct(productId: string, categoryId: string): Observable<any> {
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_CATEGORY(productId, categoryId), {});
  }

  /**
   * Remove category from product
   * DELETE /products/{productId}/categories/{categoryId}
   */
  removeCategoryFromProduct(productId: string, categoryId: string): Observable<any> {
    return this.apiService.delete(API_ENDPOINTS.PRODUCTS.REMOVE_CATEGORY(productId, categoryId));
  }

  /**
   * Add multiple categories to product
   * POST /products/{productId}/categories
   */
  addMultipleCategoriesToProduct(productId: string, categoryIds: string[]): Observable<any> {
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_MULTIPLE_CATEGORIES(productId), categoryIds);
  }

  /**
   * Update product categories (replace all)
   * PUT /products/{productId}/categories
   */
  updateProductCategories(productId: string, categoryIds: string[]): Observable<any> {
    return this.apiService.put(API_ENDPOINTS.PRODUCTS.UPDATE_CATEGORIES(productId), categoryIds);
  }

  /**
   * List categories for a product
   * GET /products/{productId}/categories
   */
  listProductCategories(productId: string, forceRefresh = false): Observable<any[]> {
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
  /**
   * Get image upload job status
   * GET /products/{product_id}/images/jobs/{job_id}
   */
  getImageJobStatus(productId: string, jobId: string): Observable<any> {
    return this.apiService.get<any>(API_ENDPOINTS.PRODUCTS.GET_IMAGE_UPLOAD_JOB(productId, jobId));
  }

  /**
   * Poll image upload job status until SUCCESS or FAILURE
   */
  pollImageJob(productId: string, jobId: string, intervalMs = 1500, maxAttempts = 20): Observable<any[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getImageJobStatus(productId, jobId)),
      map(job => {
        if (job.status === 'SUCCESS') {
          return { done: true, images: job.images || [] };
        } else if (job.status === 'FAILURE') {
          throw new Error(job.error || 'Async image processing job failed');
        }
        return { done: false, images: null };
      }),
      filter(res => res.done),
      take(1),
      map(res => res.images!)
    );
  }

  /**
   * Add image to product (polls async job until finished)
   * POST /products/{productId}/images
   */
  addImage(productId: string, file: File): Observable<any[]> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiService.post<{ job_id: string }>(API_ENDPOINTS.PRODUCTS.ADD_IMAGE(productId), formData).pipe(
      switchMap(res => this.pollImageJob(productId, res.job_id))
    );
  }

  /**
   * Bulk upload images to product (polls async job until finished)
   * POST /products/{productId}/images/bulk
   */
  bulkUploadImages(productId: string, primaryFile: File, additionalFiles: File[]): Observable<any[]> {
    const formData = new FormData();
    formData.append('primary_image', primaryFile);
    additionalFiles.forEach(file => {
      formData.append('gallery_images', file);
    });
    return this.apiService.post<{ job_id: string }>(API_ENDPOINTS.PRODUCTS.BULK_UPLOAD_IMAGES(productId), formData).pipe(
      switchMap(res => this.pollImageJob(productId, res.job_id))
    );
  }

  /**
   * Remove image from product
   * DELETE /products/{productId}/images/{imageId}
   */
  removeImage(productId: string, imageId: string): Observable<any> {
    return this.apiService.delete(API_ENDPOINTS.PRODUCTS.REMOVE_IMAGE(productId, imageId));
  }

  /**
   * Set primary image
   * PATCH /products/{productId}/images/{imageId}/set-primary
   */
  setPrimaryImage(productId: string, imageId: string): Observable<any> {
    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId), {});
  }

  /**
   * Batch update images (polls async job until finished)
   * PATCH /products/{productId}/images/batch?new_primary_id={newPrimaryId}
   */
  batchUpdateImages(
    productId: string,
    newPrimaryId?: string | null,
    newPrimaryFile?: File,
    newGalleryFiles?: File[],
    deleteImageIds?: string[]
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

    if (newPrimaryId !== undefined && newPrimaryId !== null) {
      formData.append('new_primary_id', String(newPrimaryId));
    }

    const url = API_ENDPOINTS.PRODUCTS.BATCH_UPDATE_IMAGES(productId);

    return this.apiService.patch<{ job_id: string }>(url, formData).pipe(
      switchMap(res => this.pollImageJob(productId, res.job_id))
    );
  }

  /**
   * Preview price of a hypothetical discount without saving
   * POST /products/discount/preview
   */
  previewDiscount(payload: {
    discount_type: string | null;
    discount_value: number | string | null;
    discount_starts_at?: string | null;
    discount_ends_at?: string | null;
    price: number | string;
  }): Observable<{
    price: string;
    effective_price: string;
    savings: string;
    discount_percent: string;
    is_active_now: boolean;
  }> {
    return this.apiService.post<any>(API_ENDPOINTS.PRODUCTS.DISCOUNT_PREVIEW, payload);
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
   * Get all hot deal products
   * GET /products/hot-deals
   */
  getHotDeals(forceRefresh = false): Observable<Product[]> {
    if (!forceRefresh && this.hotDealsCache) {
      return of(this.hotDealsCache);
    }
    
    if (!forceRefresh && this.pendingHotDealsRequest) {
      return this.pendingHotDealsRequest;
    }

    const request = this.apiService.get<any[]>(API_ENDPOINTS.PRODUCTS.HOT_DEALS).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p))),
      tap(products => this.hotDealsCache = products),
      shareReplay(1),
      finalize(() => this.pendingHotDealsRequest = null)
    );

    if (!forceRefresh) {
      this.pendingHotDealsRequest = request;
    }

    return request;
  }

  /**
   * Set products as hot deals
   * POST /products/hot-deals
   */
  setHotDeals(productIds: string[]): Observable<Product[]> {
    return this.apiService.post<any[]>(API_ENDPOINTS.PRODUCTS.HOT_DEALS, productIds).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Replace all hot deal products
   * PUT /products/hot-deals
   */
  replaceHotDeals(productIds: string[]): Observable<Product[]> {
    return this.apiService.put<any[]>(API_ENDPOINTS.PRODUCTS.HOT_DEALS, productIds).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Clear all hot deal products
   * DELETE /products/hot-deals
   */
  clearHotDeals(): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.HOT_DEALS);
  }

  /**
   * Remove specific product from hot deals
   * DELETE /products/hot-deals/{productId}
   */
  removeFromHotDeals(productId: string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.HOT_DEALS_DELETE(productId));
  }

  /**
   * Get all best seller products
   * GET /products/best-sellers
   */
  getBestSellers(forceRefresh = false): Observable<Product[]> {
    if (!forceRefresh && this.bestSellersCache) {
      return of(this.bestSellersCache);
    }

    if (!forceRefresh && this.pendingBestSellersRequest) {
      return this.pendingBestSellersRequest;
    }

    const request = this.apiService.get<any[]>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p))),
      tap(products => this.bestSellersCache = products),
      shareReplay(1),
      finalize(() => this.pendingBestSellersRequest = null)
    );

    if (!forceRefresh) {
      this.pendingBestSellersRequest = request;
    }

    return request;
  }

  /**
   * Set products as best sellers
   * POST /products/best-sellers
   */
  setBestSellers(productIds: string[]): Observable<Product[]> {
    return this.apiService.post<any[]>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS, productIds).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Replace all best seller products
   * PUT /products/best-sellers
   */
  replaceBestSellers(productIds: string[]): Observable<Product[]> {
    return this.apiService.put<any[]>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS, productIds).pipe(
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Clear all best seller products
   * DELETE /products/best-sellers
   */
  clearBestSellers(): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS);
  }

  /**
   * Remove specific product from best sellers
   * DELETE /products/best-sellers/{productId}
   */
  removeFromBestSellers(productId: string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS_DELETE(productId));
  }

  /**
   * Get products with low stock
   */
  getLowStockProducts(threshold = 5): Observable<Product[]> {
    return this.getProducts().pipe(
      map(products => products.filter(p => (p.stock || 0) <= threshold))
    );
  }

  public getImageUrl(url: string | null | undefined): string {
    if (!url) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="system-ui, sans-serif" font-size="14" font-weight="500">No Image</text></svg>';
    }
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    let cleanPath = url;
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }
    if (!cleanPath.startsWith('uploads/') && !cleanPath.startsWith('assets/')) {
      cleanPath = 'uploads/' + cleanPath;
    }
    return `${environment.baseUrl}/${cleanPath}`;
  }

  /**
   * Map backend product format to frontend format
   * FIX: Added URL deduplication to prevent duplicate images in gallery
   */
  public mapBackendToFrontend(data: any): Product {
    // Collect potential stock fields
    const stockQty = data.stock_quantity ?? data.available_quantity ?? data.quantity ?? data.stock;
    const stock = (stockQty !== undefined && stockQty !== null) ? parseInt(String(stockQty), 10) : 0;

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
    let mainImageUrl = this.getImageUrl(data.primary_image_url || data.imageUrl);
    let galleryImages: string[] = [];

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      // 1. Identify the primary image object
      const primaryImage = data.images.find((img: any) => img.is_primary) || data.images[0];

      if (primaryImage) {
        // Enforce image_medium for home/list cards for optimal loading/quality balance
        mainImageUrl = this.getImageUrl(primaryImage.image_medium || primaryImage.image_large || primaryImage.image_thumb || primaryImage.image_path);
      }

      // 2. Map all image records to their high-quality 'large' variant for the product details carousel,
      //    ensuring the primary image always appears first.
      const galleryUrl = (img: any) => img.image_large || img.image_medium || img.image_thumb || img.image_path;
      galleryImages = data.images
        .map(galleryUrl)
        .filter(Boolean)
        .map((url: string) => this.getImageUrl(url))
        .sort((a: string, b: string) => {
          const aPrimary = data.images.find((img: any) => this.getImageUrl(galleryUrl(img)) === a)?.is_primary;
          const bPrimary = data.images.find((img: any) => this.getImageUrl(galleryUrl(img)) === b)?.is_primary;
          return Number(bPrimary) - Number(aPrimary);
        });

    } else if (data.image) {
      mainImageUrl = this.getImageUrl(data.image);
      galleryImages = [this.getImageUrl(data.image)];
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
      isInStock: isInStock,
      isHotDeal: !!(data.is_hot_deal || data.hot_deal),
      isBestSeller: !!(data.is_best_seller || data.best_seller),
      discount_type: data.discount_type || null,
      discount_value: data.discount_value !== undefined && data.discount_value !== null ? parseFloat(String(data.discount_value)) : null,
      discount_starts_at: data.discount_starts_at || null,
      discount_ends_at: data.discount_ends_at || null,
      effective_price: data.effective_price !== undefined && data.effective_price !== null ? parseFloat(String(data.effective_price)) : (typeof data.price === 'string' ? parseFloat(data.price) : data.price)
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
    const payload: any = {
      name: product.name,
      price: product.price,
      description: product.description || null
    };

    if (product.cost != null) {
      payload.cost = product.cost;
    }

    payload.discount_type = product.discount_type || null;
    payload.discount_value = (product.discount_value != null && product.discount_type) ? product.discount_value : null;
    payload.discount_starts_at = this.toIsoStringOrNull(product.discount_starts_at);
    payload.discount_ends_at = this.toIsoStringOrNull(product.discount_ends_at);

    return payload;
  }

  private toIsoStringOrNull(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
}
