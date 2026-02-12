import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { of } from 'rxjs';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CarouselModule,
    TagModule,
    ProgressSpinnerModule,
    ToastModule
  ],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss']
})
export class ProductDetailsComponent implements OnInit {
  product = signal<Product | null>(null);
  loading = signal<boolean>(true);
  responsiveOptions = [
    {
      breakpoint: '1024px',
      numVisible: 1,
      numScroll: 1
    },
    {
      breakpoint: '768px',
      numVisible: 1,
      numScroll: 1
    },
    {
      breakpoint: '560px',
      numVisible: 1,
      numScroll: 1
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private messageService: MessageService
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadProduct(id);
      }
    });
  }

  loadProduct(id: string | number) {
    this.loading.set(true);
    const pid = typeof id === 'string' ? parseInt(id, 10) : id;

    // Fetch Product details (stock is included in the response, no auth required)
    this.productService.getProductById(pid).subscribe({
      next: (product) => {
        if (product) {
          this.product.set(product);
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Product not found' });
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load product', err);
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product' });
      }
    });
  }

  get images(): string[] {
    const p = this.product();
    if (!p) return [];
    if (p.images && p.images.length > 0) return p.images;
    return p.imageUrl ? [p.imageUrl] : [];
  }

  isOutOfStock(): boolean {
    const p = this.product();
    if (!p) return true;
    if (p.manualStockStatus === 'OUT_OF_STOCK') return true;
    if (p.manualStockStatus === 'IN_STOCK') return false;
    return (p.stock || 0) <= 0;
  }

  addToCart() {
    const p = this.product();
    if (p) {
      this.cartService.addToCart(p);
    }
  }

  buyNow() {
    const p = this.product();
    if (p) {
      this.cartService.addToCart(p);
      this.router.navigate(['/'], { queryParams: { checkout: 'true' } });
    }
  }
}
