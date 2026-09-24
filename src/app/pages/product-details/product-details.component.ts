import { Component, OnInit, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product/product.service';
import { CartService } from '../../core/services/cart/cart.service';
import { CategoryService } from '../../core/services/category/category.service';
import { WishlistService } from '../../core/services/wishlist/wishlist.service';
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { ImageModule } from 'primeng/image';
import { GalleriaModule } from 'primeng/galleria';

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
    ImageModule,
    GalleriaModule
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
  activeImageIndex = signal<number>(0);
  displayGalleria = signal<boolean>(false);
  quantity = signal<number>(1);
  activeTab = signal<'about' | 'details' | 'care' | 'shipping'>('about');

  // Reactive image array
  images = computed(() => {
    const p = this.product();
    if (!p) return [];
    if (p.images && p.images.length > 0) return p.images;
    return p.imageUrl ? [p.imageUrl] : [];
  });

  categoryName = computed(() => {
    const p = this.product();
    if (!p || !p.categoryId) return 'Handicrafts';
    const cats = this.categoryService.categories();
    const cat = cats.find(c => String(c.id) === String(p.categoryId));
    return cat ? cat.name : 'Protima';
  });

  categorySlug = computed(() => {
    const p = this.product();
    if (!p || !p.categoryId) return 'all-products';
    const cats = this.categoryService.categories();
    const cat = cats.find(c => String(c.id) === String(p.categoryId));
    return cat ? (cat.slug || cat.id) : '';
  });

  savings = computed(() => {
    const p = this.product();
    if (!p || !p.price) return 0;
    const effective = p.effective_price ?? p.price;
    return Math.max(0, p.price - effective);
  });

  savingsPercentage = computed(() => {
    const p = this.product();
    if (!p || !p.price || !this.savings()) return 0;
    return Math.round((this.savings() / p.price) * 100);
  });

  responsiveOptions = [
    { breakpoint: '1024px', numVisible: 4, numScroll: 1 },
    { breakpoint: '768px', numVisible: 3, numScroll: 1 },
    { breakpoint: '560px', numVisible: 3, numScroll: 1 }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    public cartService: CartService,
    public categoryService: CategoryService,
    public wishlistService: WishlistService,
    private messageService: MessageService,
    private titleService: Title,
    private metaService: Meta
  ) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.cartService.refreshCartProducts();
        this.loadProduct(id);
        this.loadRelatedProducts(id);
      }
    });
  }

  loadProduct(id: string | number) {
    this.loading.set(true);
    const pid = id.toString();

    this.productService.getProductById(pid).subscribe({
      next: (product) => {
        if (product) {
          this.product.set(product);
          this.updateSeo(product);
          if (product.slug && pid !== product.slug) {
            this.router.navigate(['/products', product.slug], { replaceUrl: true });
          }
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
    const plainDescription = product.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 'Handmade crafts from Karukolpo';
    this.metaService.updateTag({ name: 'description', content: plainDescription });
    const canonicalUrl = this.buildCanonicalUrl(`/products/${product.slug || product.id}`);
    if (canonicalUrl) {
      this.metaService.updateTag({ rel: 'canonical', href: canonicalUrl }, 'rel="canonical"');
    }
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: plainDescription });
    this.metaService.updateTag({ property: 'og:image', content: product.imageUrl || '' });
    this.metaService.updateTag({ property: 'og:type', content: 'product' });
  }

  private buildCanonicalUrl(path: string): string | null {
    if (typeof window === 'undefined' || !window.location) return null;
    return `${window.location.origin}${path}`;
  }

  loadRelatedProducts(id: string | number) {
    this.loadingRelated.set(true);
    this.productService.getProducts().subscribe({
      next: (products) => {
        const currentProduct = this.product();
        if (currentProduct) {
          this.relatedProducts.set(
            products.filter(p => p.categoryId === currentProduct.categoryId && p.id !== currentProduct.id).slice(0, 4)
          );
        } else {
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

  isOutOfStock(): boolean {
    const p = this.product();
    return !!p && p.isInStock === false;
  }

  addToCart() {
    const p = this.product();
    if (p) {
      for (let i = 0; i < this.quantity(); i++) {
        this.cartService.addToCart(p);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'Cart Updated',
        detail: `Added ${this.quantity()} "${p.name}" to cart`,
        life: 2500
      });
    }
  }

  buyNow() {
    const p = this.product();
    if (p) {
      for (let i = 0; i < this.quantity(); i++) {
        this.cartService.addToCart(p);
      }
      this.router.navigate(['/cart']);
    }
  }

  toggleWishlist() {
    const p = this.product();
    if (p) {
      this.wishlistService.toggleWishlist(p);
    }
  }

  isWishlisted(): boolean {
    const p = this.product();
    return p ? this.wishlistService.isWishlisted(p.id) : false;
  }

  incrementQuantity() {
    this.quantity.update(q => q + 1);
  }

  decrementQuantity() {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }

  selectTab(tab: 'about' | 'details' | 'care' | 'shipping') {
    this.activeTab.set(tab);
  }

  showGalleria(index: number) {
    this.activeImageIndex.set(index);
    this.displayGalleria.set(true);
  }

  showProductDetails(product: Product) {
    this.router.navigate(['/products', product.slug || product.id]);
  }

  nextImage(event?: Event) {
    if (event) event.stopPropagation();
    const current = this.activeImageIndex();
    const total = this.images().length;
    if (total > 1) {
      this.activeImageIndex.set((current + 1) % total);
    }
  }

  prevImage(event?: Event) {
    if (event) event.stopPropagation();
    const current = this.activeImageIndex();
    const total = this.images().length;
    if (total > 1) {
      this.activeImageIndex.set((current - 1 + total) % total);
    }
  }

  private touchStartX = 0;
  private readonly minSwipeDistance = 50;

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    const touchEndX = event.changedTouches[0].screenX;
    const deltaX = touchEndX - this.touchStartX;
    if (Math.abs(deltaX) > this.minSwipeDistance) {
      if (deltaX > 0) {
        this.prevImage();
      } else {
        this.nextImage();
      }
    }
  }
}
