import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly STORAGE_KEY = 'products';
  private products: Product[] = [];

  constructor() {
    this.loadProducts();
  }

  private loadProducts() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.products = JSON.parse(saved);
    } else {
      this.products = [
        {
          id: '1',
          code: 'HP001',
          name: 'Nakshi Kantha',
          description: 'Traditional embroidered quilt from Bangladesh.',
          price: 2500,
          imageUrl: 'assets/nakshi-kantha.jpg',
          images: ['assets/nakshi-kantha.jpg', 'assets/nakshi-kantha-detail.jpg']
        },
        {
          id: '2',
          code: 'HP002',
          name: 'Jute Bag',
          description: 'Eco-friendly handmade jute bag.',
          price: 500,
          imageUrl: 'assets/jute-bag.jpg',
          images: ['assets/jute-bag.jpg', 'assets/jute-bag-side.jpg']
        },
        {
          id: '3',
          code: 'HP003',
          name: 'Terracotta Vase',
          description: 'Handcrafted clay vase with intricate designs.',
          price: 800,
          imageUrl: 'assets/terracotta.jpg',
          images: ['assets/terracotta.jpg']
        }
      ];
      this.saveToStorage();
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.products));
  }

  getProducts(): Observable<Product[]> {
    return of([...this.products]);
  }

  getProductById(id: string): Observable<Product | undefined> {
    return of(this.products.find(p => p.id === id));
  }

  addProduct(product: Product): Observable<void> {
    product.id = Date.now().toString();
    this.products.push(product);
    this.saveToStorage();
    return of(void 0);
  }

  updateProduct(product: Product): Observable<void> {
    const index = this.products.findIndex(p => p.id === product.id);
    if (index !== -1) {
      this.products[index] = product;
      this.saveToStorage();
    }
    return of(void 0);
  }

  deleteProduct(id: string): Observable<void> {
    this.products = this.products.filter(p => p.id !== id);
    this.saveToStorage();
    return of(void 0);
  }
}
