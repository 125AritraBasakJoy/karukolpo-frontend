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
    const backendProduct = {
      name: product.name,
      price: product.price,
      description: product.description || null
    };

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
    const backendProduct = {
      name: product.name,
      price: product.price,
      description: product.description || null
    };

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
   */
  public mapBackendToFrontend(backendProduct: any): Product {
    // Correct mapping for public API fields: available_quantity and is_in_stock
    const stock = backendProduct.available_quantity !== undefined ? backendProduct.available_quantity :
      (backendProduct.stock !== undefined ? backendProduct.stock :
        (backendProduct.quantity !== undefined ? backendProduct.quantity : 0));

    // Handle manual stock status if present, otherwise default to AUTO
    // We avoid deriving it from is_in_stock to prevent "(Forced)" labels in the UI
    const manualStatus = backendProduct.manualStockStatus || backendProduct.manual_stock_status || 'AUTO';

    return {
      id: backendProduct.id?.toString() || '',
      code: backendProduct.code || `P${backendProduct.id}`,
      name: backendProduct.name,
      description: backendProduct.description || '',
      price: parseFloat(backendProduct.price),
      imageUrl: backendProduct.imageUrl || backendProduct.image_url || '',
      images: backendProduct.images || [],
      stock: parseInt(String(stock), 10),
      manualStockStatus: manualStatus as 'IN_STOCK' | 'OUT_OF_STOCK' | 'AUTO',
      categoryId: backendProduct.categoryId?.toString() ||
        backendProduct.category_id?.toString() ||
        (backendProduct.categories && backendProduct.categories.length > 0
          ? backendProduct.categories.map((c: any) => typeof c === 'object' ? c.id : c).join(',')
          : undefined) ||
        (backendProduct.category
          ? (typeof backendProduct.category === 'object' ? backendProduct.category.id?.toString() : backendProduct.category.toString())
          : undefined)
    };
  }

  /**
   * Map frontend product format to backend format
   */
  private mapFrontendToBackend(product: Product): any {
    return {
      name: product.name,
      price: product.price,
      description: product.description || null,
      category_id: product.categoryId ? product.categoryId : null,
      image_url: product.imageUrl || null,
      images: product.images || []
    };
  }
}
