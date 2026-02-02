import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { ApiService } from './api.service';
import { API_ENDPOINTS, buildListQuery } from '../../core/api-endpoints';

/**
 * ProductService - Backend API Integration
 * Connects to: https://karukolpo-backend.onrender.com/products
 */
@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private apiService: ApiService) { }

  /**
   * Get all products from backend
   * GET /products
   */
  getProducts(skip = 0, limit = 100): Observable<Product[]> {
    const query = buildListQuery(skip, limit);
    return this.apiService.get<any[]>(`${API_ENDPOINTS.PRODUCTS.LIST}${query}`).pipe(
      tap(products => console.log('Raw products from backend:', products)),
      map(backendProducts => backendProducts.map(this.mapBackendToFrontend))
    );
  }

  /**
   * Get product by ID
   * GET /products/{id}
   */
  getProductById(id: number | string): Observable<Product | undefined> {
    const productId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.apiService.get<any>(API_ENDPOINTS.PRODUCTS.GET_BY_ID(productId)).pipe(
      map(this.mapBackendToFrontend),
      catchError(() => {
        // Return undefined if product not found
        return new Observable<Product | undefined>(observer => {
          observer.next(undefined);
          observer.complete();
        });
      })
    );
  }

  /**
   * Create new product
   * POST /products (requires auth)
   */
  addProduct(product: Product): Observable<Product> {
    // Backend only accepts name, price, description
    const backendProduct = {
      name: product.name,
      price: product.price,
      description: product.description || null
    };
    
    return this.apiService.post<any>(API_ENDPOINTS.PRODUCTS.CREATE, backendProduct).pipe(
      map(this.mapBackendToFrontend)
    );
  }

  /**
   * Update existing product
   * PATCH /products/{id} (requires auth)
   */
  updateProduct(product: Product): Observable<Product> {
    const productId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
    // Backend only accepts name, price, description
    const backendProduct = {
      name: product.name,
      price: product.price,
      description: product.description || null
    };

    return this.apiService.patch<any>(API_ENDPOINTS.PRODUCTS.UPDATE(productId), backendProduct).pipe(
      map(this.mapBackendToFrontend)
    );
  }

  /**
   * Delete product
   * DELETE /products/{id} (requires auth)
   */
  deleteProduct(id: number | string): Observable<void> {
    const productId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.apiService.delete<void>(API_ENDPOINTS.PRODUCTS.DELETE(productId));
  }

  /**
   * Get product inventory
   * GET /products/{id}/inventory (requires auth)
   */
  getInventory(productId: number): Observable<{ product_id: number; quantity: number }> {
    return this.apiService.get(API_ENDPOINTS.PRODUCTS.GET_INVENTORY(productId));
  }

  /**
   * Update product inventory
   * PATCH /products/{id}/inventory (requires auth)
   */
  updateInventory(productId: number, quantity: number): Observable<any> {
    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.UPDATE_INVENTORY(productId), { quantity });
  }

  /**
   * Add category to product
   * POST /products/{productId}/categories/{categoryId}
   */
  addCategoryToProduct(productId: number, categoryId: number): Observable<any> {
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_CATEGORY(productId, categoryId), {});
  }

  /**
   * List categories for a product
   * GET /products/{productId}/categories
   */
  listProductCategories(productId: number): Observable<any[]> {
    return this.apiService.get<any[]>(API_ENDPOINTS.PRODUCTS.LIST_CATEGORIES(productId));
  }

  /**
   * Add image to product
   * POST /products/{productId}/images
   */
  addImage(productId: number, file: File): Observable<any> {
    const formData = new FormData();
    // Changed 'file' to 'image' as a potential fix for backend expectation
    formData.append('image', file);
    return this.apiService.post(API_ENDPOINTS.PRODUCTS.ADD_IMAGE(productId), formData);
  }

  /**
   * Remove image from product
   * DELETE /products/{productId}/images/{imageId}
   */
  removeImage(productId: number, imageId: number): Observable<any> {
    return this.apiService.delete(API_ENDPOINTS.PRODUCTS.REMOVE_IMAGE(productId, imageId));
  }

  /**
   * Set primary image
   * PATCH /products/{productId}/images/{imageId}/set-primary
   */
  setPrimaryImage(productId: number, imageId: number): Observable<any> {
    return this.apiService.patch(API_ENDPOINTS.PRODUCTS.SET_PRIMARY_IMAGE(productId, imageId), {});
  }

  /**
   * Reduce stock (used when order is placed)
   * Note: This updates inventory on the backend
   */
  reduceStock(items: { product: Product, quantity: number }[]): Observable<void> {
    // Create an observable that updates each product's inventory
    const updates = items.map(item => {
      const productId = typeof item.product.id === 'string' ? parseInt(item.product.id, 10) : item.product.id;
      const newQuantity = (item.product.stock || 0) - item.quantity;
      return this.updateInventory(productId, Math.max(0, newQuantity));
    });

    // Execute all updates
    return new Observable(observer => {
      Promise.all(updates.map(obs => obs.toPromise()))
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  /**
   * Restore stock (used when order is cancelled)
   */
  restoreStock(items: { product: Product, quantity: number }[]): Observable<void> {
    const updates = items.map(item => {
      const productId = typeof item.product.id === 'string' ? parseInt(item.product.id, 10) : item.product.id;
      const newQuantity = (item.product.stock || 0) + item.quantity;
      return this.updateInventory(productId, newQuantity);
    });

    return new Observable(observer => {
      Promise.all(updates.map(obs => obs.toPromise()))
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
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
  private mapBackendToFrontend(backendProduct: any): Product {
    return {
      id: backendProduct.id?.toString() || '',
      code: backendProduct.code || `P${backendProduct.id}`,
      name: backendProduct.name,
      description: backendProduct.description || '',
      price: parseFloat(backendProduct.price),
      imageUrl: backendProduct.imageUrl || backendProduct.image_url || '',
      images: backendProduct.images || [],
      stock: backendProduct.stock || 0,
      manualStockStatus: backendProduct.manualStockStatus || 'AUTO',
      categoryId: backendProduct.categoryId?.toString() || 
                  backendProduct.category_id?.toString() || 
                  (backendProduct.categories && backendProduct.categories.length > 0 ? backendProduct.categories[0].id.toString() : undefined) ||
                  (backendProduct.category ? backendProduct.category.id.toString() : undefined)
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
      category_id: product.categoryId ? parseInt(product.categoryId, 10) : null,
      image_url: product.imageUrl || null,
      images: product.images || []
    };
  }
}
