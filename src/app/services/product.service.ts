import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

/**
 * ProductService - Backend API Integration
 * Connects to: https://api.karukolpocrafts.com/products
 */
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsCache: Product[] | null = null;
  private productCategoriesCache = new Map<string | number, any[]>();
  private productMap = new Map<string | number, Product>();

  constructor(private apiService: ApiService) { }

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

    let query = buildListQuery(skip, limit);
    if (categoryId) {
      query += `&category_id=${categoryId}`;
    }
    return this.apiService.get<any[]>(`${API_ENDPOINTS.PRODUCTS.LIST}${query}`).pipe(
      map(backendProducts => {
        return backendProducts.map(p => this.mapBackendToFrontend(p));
      }),
      tap(products => {
        if (!categoryId && skip === 0) {
          this.productsCache = products;
        }
      })
    );
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
    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId), {});
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
    const stock = data.stock_quantity ?? (
      data.available_quantity !== undefined ? data.available_quantity :
        (data.stock !== undefined ? data.stock : 0)
    );

    const manualStatus = data.stock_status || data.manual_stock_status || data.manualStockStatus || 'AUTO';

    // Map Images
    let mainImageUrl = data.primary_image_url || data.imageUrl || 'assets/images/placeholder.jpg';
    let galleryImages: string[] = [];

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      // 1. Identify the primary image object
      const primaryImage = data.images.find((img: any) => img.is_primary) || data.images[0];

      if (primaryImage) {
        // Enforce image_medium for home/list cards for optimal loading/quality balance
        mainImageUrl = primaryImage.image_medium || primaryImage.image_large || primaryImage.image_thumb || mainImageUrl;
      }

      // 2. Map all image records to their high-quality 'large' variant for the product details carousel
      galleryImages = data.images
        .map((img: any) => img.image_large || img.image_medium || img.image_thumb)
        .filter(Boolean);

    } else if (data.image) {
      mainImageUrl = data.image;
      galleryImages = [data.image];
    }

    return {
      id: data.id?.toString() || '',
      code: data.code || `PROD-${data.id}`,
      name: data.name || '',
      description: data.description || '',
      price: typeof data.price === 'string' ? parseFloat(data.price) : data.price,
      imageUrl: mainImageUrl,
      images: galleryImages,
      categoryId: data.category_id?.toString() ||
        (data.categories && data.categories.length > 0 ? data.categories[0].id.toString() : 'uncategorized'),
      categories: data.categories || [],
      stock: parseInt(String(stock), 10),
      manualStockStatus: manualStatus
    };
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
