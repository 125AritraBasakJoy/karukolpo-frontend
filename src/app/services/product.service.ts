import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly STORAGE_KEY = 'products';
  private products: Product[] = [];

  constructor() {
    this.loadProducts();
    // Listen for storage changes in other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY) {
        this.loadProducts();
      }
    });
  }

  private loadProducts() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.products = JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing products from local storage', e);
        this.products = [];
      }
    } else {
      this.products = [
        {
          id: '1',
          code: 'HP001',
          name: 'Nakshi Kantha',
          description: 'Traditional embroidered quilt from Bangladesh.',
          price: 2500,
          imageUrl: 'assets/nakshi-kantha.jpg',
          images: ['assets/nakshi-kantha.jpg', 'assets/nakshi-kantha-detail.jpg'],
          stock: 10
        },
        {
          id: '2',
          code: 'HP002',
          name: 'Jute Bag',
          description: 'Eco-friendly handmade jute bag.',
          price: 500,
          imageUrl: 'assets/jute-bag.jpg',
          images: ['assets/jute-bag.jpg', 'assets/jute-bag-side.jpg'],
          stock: 10
        },
        {
          id: '3',
          code: 'HP003',
          name: 'Terracotta Vase',
          description: 'Handcrafted clay vase with intricate designs.',
          price: 800,
          imageUrl: 'assets/terracotta.jpg',
          images: ['assets/terracotta.jpg'],
          stock: 10
        }
      ];
      this.saveToStorage();
    }
  }

  private saveToStorage(): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.products));
      return true;
    } catch (e) {
      console.error('Error saving products to local storage', e);
      return false;
    }
  }

  getProducts(): Observable<Product[]> {
    // Reload from storage to ensure we have the latest data
    this.loadProducts();
    return of([...this.products]);
  }

  getProductById(id: string): Observable<Product | undefined> {
    this.loadProducts();
    return of(this.products.find(p => p.id === id));
  }

  addProduct(product: Product): Observable<void> {
    const newProduct = { ...product, id: Date.now().toString() };
    this.products.push(newProduct);

    if (!this.saveToStorage()) {
      this.products.pop(); // Rollback
      return throwError(() => new Error('Storage Full! Images are likely too large.'));
    }

    return of(void 0);
  }

  updateProduct(product: Product): Observable<void> {
    const index = this.products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      const originalProduct = this.products[index];
      this.products[index] = product;

      if (!this.saveToStorage()) {
        this.products[index] = originalProduct; // Rollback
        return throwError(() => new Error('Storage Full! Images are likely too large.'));
      }
    }
    return of(void 0);
  }

  deleteProduct(id: string): Observable<void> {
    const originalProducts = [...this.products];
    this.products = this.products.filter(p => p.id !== id);

    if (!this.saveToStorage()) {
      this.products = originalProducts; // Rollback
      return throwError(() => new Error('Could not delete product. Storage error.'));
    }

    return of(void 0);
  }
  reduceStock(items: { product: Product, quantity: number }[]): Observable<void> {
    let updated = false;
    items.forEach(item => {
      const productIndex = this.products.findIndex(p => p.id === item.product.id);
      if (productIndex !== -1) {
        const product = this.products[productIndex];
        if (product.stock !== undefined) {
          product.stock = Math.max(0, product.stock - item.quantity);
          updated = true;
        }
      }
    });

    if (updated) {
      if (!this.saveToStorage()) {
        return throwError(() => new Error('Failed to update stock in storage.'));
      }
    }
    return of(void 0);
  }

  getLowStockProducts(threshold = 5): Product[] {
    return this.products.filter(p => p.stock !== undefined && p.stock <= threshold);
  }
}
