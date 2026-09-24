import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, forkJoin, timer, from } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay, finalize } from 'rxjs/operators';
import { Product, ProductImage } from '../../../models/product.model';
import { ApiService } from '../api/api.service';
import { PRODUCTS_API } from './product.api';
import { buildListQuery } from '../api/helpers';
import { environment } from '../../../../environments/environment';
import { downscaleImage, validateImageFile } from '../../utils/image-resize';

const API_ENDPOINTS = {
  PRODUCTS: PRODUCTS_API
} as const;

export interface ProductQueryOptions {
  skip?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name' | string;
}

export interface ProductsResponse {
  items: Product[];
  total: number;
}

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

  private buildProductQueryParams(options: ProductQueryOptions): string {
    const params = new URLSearchParams();
    if (options.skip !== undefined && options.skip !== null) params.append('skip', options.skip.toString());
    if (options.limit !== undefined && options.limit !== null) params.append('limit', options.limit.toString());
    if (options.q && options.q.trim()) params.append('q', options.q.trim());
    if (options.categoryId) params.append('category_id', options.categoryId);
    if (options.minPrice !== undefined && options.minPrice !== null) params.append('min_price', options.minPrice.toString());
    if (options.maxPrice !== undefined && options.maxPrice !== null) params.append('max_price', options.maxPrice.toString());
    if (options.inStock !== undefined && options.inStock !== null) params.append('in_stock', options.inStock.toString());
    if (options.sort) params.append('sort', options.sort);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Get products with unpaginated total count from X-Total-Count header.
   * Leverages backend server-side search, category filter, price filter, stock filter, and sort.
   */
  getProductsWithCount(options: ProductQueryOptions = {}): Observable<ProductsResponse> {
    const qs = this.buildProductQueryParams(options);
    return this.apiService.getResponse<any[]>(`${API_ENDPOINTS.PRODUCTS.LIST}${qs}`).pipe(
      map(res => {
        const items = (res.body || []).map(p => this.mapBackendToFrontend(p));
        const totalHeader = res.headers.get('x-total-count') || res.headers.get('X-Total-Count');
        const total = totalHeader ? parseInt(totalHeader, 10) : items.length;
        return { items, total };
      })
    );
  }

  /**
   * Get all products from backend
   * GET /products
   */
  getProducts(
    optionsOrSkip: ProductQueryOptions | number = 0,
    limit = 100,
    categoryId?: string | number,
    forceRefresh = false
  ): Observable<Product[]> {
    if (typeof optionsOrSkip === 'object') {
      return this.getProductsWithCount(optionsOrSkip).pipe(map(res => res.items));
    }

    const skip = optionsOrSkip;

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
   * Poll image upload job status until SUCCESS or FAILURE.
   *
   * Duration-based deadline (not attempt-based): a slow worker no longer
   * reports failure for a job that actually succeeded. Polls fast (1.5 s)
   * while the job is likely running, then backs off to 3 s. On deadline the
   * observable errors with a "still running" notice — the job keeps going
   * server-side either way.
   */
  pollImageJob(productId: string, jobId: string, maxDurationMs = 5 * 60_000): Observable<any[]> {
    const FAST_MS = 1500;
    const SLOW_MS = 3000;
    const SLOW_AFTER_POLLS = 10;
    const deadline = Date.now() + maxDurationMs;

    const poll = (attempt: number): Observable<any> =>
      this.getImageJobStatus(productId, jobId).pipe(
        switchMap(job => {
          if (job.status === 'SUCCESS') {
            return of(job);
          }
          if (job.status === 'FAILURE') {
            throw new Error(job.error || 'Async image processing job failed');
          }
          if (Date.now() > deadline) {
            throw new Error(
              'Image processing is still running in the background. It will finish on its own — refresh in a few minutes to see the images.'
            );
          }
          const interval = attempt < SLOW_AFTER_POLLS ? FAST_MS : SLOW_MS;
          return timer(interval).pipe(switchMap(() => poll(attempt + 1)));
        })
      );

    return poll(0).pipe(map(job => job.images || []));
  }

  /**
   * Validate and downscale an image before it enters a FormData payload.
   * Throws immediately for files the upload could never succeed with
   * (wrong type / over the size cap) instead of letting the admin wait out
   * the upload only to receive a 413.
   */
  private prepareImageForUpload(file: File): Promise<File> {
    validateImageFile(file);
    return downscaleImage(file);
  }

  /**
   * Add image to product. Uploads only — the 202 means processing continues
   * in a background job; subscribe to pollImageJob(job_id) if you need to
   * observe completion. POST /products/{productId}/images
   */
  addImage(productId: string, file: File): Observable<{ job_id: string }> {
    return from(this.prepareImageForUpload(file)).pipe(
      switchMap(prepared => {
        const formData = new FormData();
        formData.append('file', prepared);
        return this.apiService.post<{ job_id: string }>(API_ENDPOINTS.PRODUCTS.ADD_IMAGE(productId), formData);
      })
    );
  }

  /**
   * Bulk upload images to product. Uploads only — the 202 means processing
   * continues in a background job; subscribe to pollImageJob(job_id) if you
   * need to observe completion. POST /products/{productId}/images/bulk
   */
  bulkUploadImages(productId: string, primaryFile: File, additionalFiles: File[]): Observable<{ job_id: string }> {
    const prepared = this.prepareImageForUpload(primaryFile).then(primary =>
      Promise.all(additionalFiles.map(file => this.prepareImageForUpload(file))).then(
        gallery => [primary, ...gallery] as const
      )
    );
    return from(prepared).pipe(
      switchMap(files => {
        const formData = new FormData();
        formData.append('primary_image', files[0]);
        files.slice(1).forEach(file => {
          formData.append('gallery_images', file);
        });
        return this.apiService.post<{ job_id: string }>(API_ENDPOINTS.PRODUCTS.BULK_UPLOAD_IMAGES(productId), formData);
      })
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
   * Batch update images. Uploads/deletes only — the 202 means processing
   * continues in a background job; subscribe to pollImageJob(job_id) if you
   * need to observe completion.
   * PATCH /products/{productId}/images/batch?new_primary_id={newPrimaryId}
   */
  batchUpdateImages(
    productId: string,
    newPrimaryId?: string | null,
    newPrimaryFile?: File,
    newGalleryFiles?: File[],
    deleteImageIds?: string[]
  ): Observable<{ job_id: string }> {
    const preparePrimary = newPrimaryFile
      ? this.prepareImageForUpload(newPrimaryFile)
      : Promise.resolve(undefined);
    const prepareGallery = newGalleryFiles && newGalleryFiles.length > 0
      ? Promise.all(newGalleryFiles.map(file => this.prepareImageForUpload(file)))
      : Promise.resolve([]);

    return from(Promise.all([preparePrimary, prepareGallery])).pipe(
      switchMap(([primary, gallery]) => {
        const formData = new FormData();

        if (primary) {
          formData.append('primary_image', primary);
        }

        if (gallery.length > 0) {
          gallery.forEach(file => {
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
        return this.apiService.patch<{ job_id: string }>(url, formData);
      })
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
      tap(() => this.clearCache()),
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Replace all hot deal products
   * PUT /products/hot-deals
   */
  replaceHotDeals(productIds: string[]): Observable<Product[]> {
    return this.apiService.put<any[]>(API_ENDPOINTS.PRODUCTS.HOT_DEALS, productIds).pipe(
      tap(() => this.clearCache()),
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Clear all hot deal products
   * DELETE /products/hot-deals
   */
  clearHotDeals(): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.HOT_DEALS).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Remove specific product from hot deals
   * DELETE /products/hot-deals/{productId}
   */
  removeFromHotDeals(productId: string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.HOT_DEALS_DELETE(productId)).pipe(
      tap(() => this.clearCache())
    );
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
      tap(() => this.clearCache()),
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Replace all best seller products
   * PUT /products/best-sellers
   */
  replaceBestSellers(productIds: string[]): Observable<Product[]> {
    return this.apiService.put<any[]>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS, productIds).pipe(
      tap(() => this.clearCache()),
      map(products => products.map(p => this.mapBackendToFrontend(p)))
    );
  }

  /**
   * Clear all best seller products
   * DELETE /products/best-sellers
   */
  clearBestSellers(): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS).pipe(
      tap(() => this.clearCache())
    );
  }

  /**
   * Remove specific product from best sellers
   * DELETE /products/best-sellers/{productId}
   */
  removeFromBestSellers(productId: string): Observable<void> {
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.BEST_SELLERS_DELETE(productId)).pipe(
      tap(() => this.clearCache())
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

  public getImageUrl(url: string | null | undefined): string {
    if (!url) {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23FAF7F2"/><rect x="15" y="15" width="270" height="270" rx="12" fill="none" stroke="%23EDE4D8" stroke-width="1.5" stroke-dasharray="6,4"/><g transform="translate(150,115)" text-anchor="middle"><path d="M-20,30 C-24,20 -28,-5 -15,-20 C-10,-26 10,-26 15,-20 C28,-5 24,20 20,30 Z M-10,-24 L10,-24" fill="none" stroke="%23B84E29" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/><circle cx="0" cy="5" r="4" fill="%23B84E29" opacity="0.6"/></g><text x="50%" y="180" dominant-baseline="middle" text-anchor="middle" fill="%2326221F" font-family="Georgia,serif" font-size="14" font-weight="600" letter-spacing="0.5">KaruKolpo</text><text x="50%" y="202" dominant-baseline="middle" text-anchor="middle" fill="%238C7E72" font-family="system-ui,sans-serif" font-size="11" font-weight="500">Handcrafted Craft</text></svg>';
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

    // Extract cost price if provided
    const rawCost = data.cost ?? data.cost_price ?? data.costPrice;
    let cost: number | undefined = undefined;
    if (rawCost !== undefined && rawCost !== null && rawCost !== '') {
      const parsed = typeof rawCost === 'string' ? parseFloat(rawCost) : Number(rawCost);
      if (!isNaN(parsed)) {
        cost = parsed;
      }
    }

    // Compute price and discount
    const rawPrice = typeof data.price === 'string' ? parseFloat(data.price) : (Number(data.price) || 0);
    const discountVal = (data.discount_value !== undefined && data.discount_value !== null) ? parseFloat(String(data.discount_value)) : null;
    let effectivePrice = (data.effective_price !== undefined && data.effective_price !== null)
      ? parseFloat(String(data.effective_price))
      : rawPrice;

    if ((data.effective_price === undefined || data.effective_price === null || effectivePrice === rawPrice) && discountVal && discountVal > 0) {
      let isDiscountActive = true;
      const now = new Date().getTime();
      if (data.discount_starts_at) {
        const start = new Date(data.discount_starts_at).getTime();
        if (!isNaN(start) && now < start) isDiscountActive = false;
      }
      if (data.discount_ends_at) {
        const end = new Date(data.discount_ends_at).getTime();
        if (!isNaN(end) && now > end) isDiscountActive = false;
      }

      if (isDiscountActive) {
        const dType = (data.discount_type || '').toUpperCase();
        if (dType === 'PERCENT' || dType === 'PERCENTAGE') {
          effectivePrice = Math.max(0, Math.round((rawPrice - (rawPrice * (discountVal / 100))) * 100) / 100);
        } else {
          effectivePrice = Math.max(0, Math.round((rawPrice - discountVal) * 100) / 100);
        }
      }
    }

    return {
      id: data.id?.toString() || '',
      code: data.code || `PROD-${data.id}`,
      name: data.name || '',
      slug: data.slug || undefined,
      _originalSlug: data.slug || undefined,
      description: data.description ? this.decodeHtml(data.description) : '',
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      cost: cost,
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
      discount_value: discountVal,
      discount_starts_at: data.discount_starts_at || null,
      discount_ends_at: data.discount_ends_at || null,
      effective_price: effectivePrice
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

    // Only send the slug when the admin actually changed it, so an ordinary
    // edit does not re-submit the current value.
    if (product.slug && product.slug !== product._originalSlug) {
      payload.slug = product.slug;
    }

    if (product.cost !== undefined && product.cost !== null) {
      const parsedCost = typeof product.cost === 'string' ? parseFloat(product.cost) : Number(product.cost);
      if (!isNaN(parsedCost)) {
        payload.cost = parsedCost;
      } else {
        payload.cost = null;
      }
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
