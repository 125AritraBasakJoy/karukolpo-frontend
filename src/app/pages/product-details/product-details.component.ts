import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { DomSanitizer } from '@angular/platform-browser';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
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
    ToastModule,
    SkeletonModule,
    CurrencyPipe,
    RouterLink,
    SafeHtmlPipe,
    NgOptimizedImage
  ],
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailsComponent implements OnInit {
  product = signal<Product | null>(null);
  relatedProducts = signal<Product[]>([]);
  loading = signal<boolean>(true);
  loadingRelated = signal<boolean>(false);
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
    private messageService: MessageService,
    private titleService: Title,
    private metaService: Meta
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.loadProduct(id);
        this.loadRelatedProducts(id);
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
          this.updateSeo(product);
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

  updateSeo(product: Product) {
    const title = `${product.name} | Karukolpo`;
    this.titleService.setTitle(title);

    // Extract plain text for meta description (removing HTML tags)
    const plainDescription = product.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 'Handmade crafts from Karukolpo';
    this.metaService.updateTag({ name: 'description', content: plainDescription });

    // OpenGraph tags
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: plainDescription });
    this.metaService.updateTag({ property: 'og:image', content: product.imageUrl || '' });
    this.metaService.updateTag({ property: 'og:type', content: 'product' });
  }

  loadRelatedProducts(id: string | number) {
    this.loadingRelated.set(true);
    // Fetch products belonging to the same category
    this.productService.getProducts().subscribe({
      next: (products) => {
        const currentProduct = this.product();
        if (currentProduct) {
          this.relatedProducts.set(
            products.filter(p => p.categoryId === currentProduct.categoryId && p.id !== currentProduct.id).slice(0, 4)
          );
        } else {
          // Fallback if product not loaded yet
          this.relatedProducts.set(products.slice(0, 4));
        }
        this.loadingRelated.set(false);
      },
      error: (err) => {
        console.error('Failed to load related products', err);
        this.loadingRelated.set(false);
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
    return !p || !p.isInStock;
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
      this.router.navigate(['/cart']);
    }
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
