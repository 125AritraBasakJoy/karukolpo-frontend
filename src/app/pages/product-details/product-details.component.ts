import { Component, OnInit, signal, ChangeDetectionStrategy, computed, HostListener } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product/product.service';
import { CartService } from '../../core/services/cart/cart.service';
import { CategoryService } from '../../core/services/category/category.service';
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
  activeTab = signal<'about' | 'care' | 'shipping'>('about');

  // Hover magnifier state
  isZooming = signal<boolean>(false);
  lensLeft = signal<number>(0);
  lensTop = signal<number>(0);
  zoomBgX = signal<number>(0);
  zoomBgY = signal<number>(0);
  readonly zoomFactor = 2.5;
  readonly lensSize = 140;

  // Reactive image array
  images = computed(() => {
    const p = this.product();
    if (!p) return [];
    if (p.images && p.images.length > 0) return p.images;
    return p.imageUrl ? [p.imageUrl] : [];
  });

  // Query param from category page
  sourceCategoryParam = signal<string | null>(null);
  sourceFromParam = signal<string | null>(null);

  categoryName = computed(() => {
    // 1. Explicitly came from All Collections / All Products page
    if (this.sourceFromParam() === 'all-collections') {
      return 'All Collections';
    }

    const cats = this.categoryService.categories();

    // 2. Check query param if passed from category page (e.g., ?category=protima)
    const param = this.sourceCategoryParam();
    if (param) {
      const matchParam = cats.find(c => String(c.slug).toLowerCase() === param.toLowerCase() || String(c.id) === param);
      if (matchParam) return matchParam.name;
    }

    const p = this.product();
    // 3. Check product.categories array
    if (p && p.categories && p.categories.length > 0) {
      const firstCat = p.categories[0];
      const firstCatId = typeof firstCat === 'object' ? (firstCat.id ?? firstCat.categoryId)?.toString() : firstCat?.toString();
      const firstCatSlug = typeof firstCat === 'object' ? (firstCat.slug || firstCat.name) : null;
      const matchCat = cats.find(c =>
        (firstCatId && String(c.id) === String(firstCatId)) ||
        (firstCatSlug && String(c.slug).toLowerCase() === String(firstCatSlug).toLowerCase())
      );
      if (matchCat) return matchCat.name;
      if (typeof firstCat === 'object' && firstCat.name) return firstCat.name;
    }

    // 4. Match by product's categoryId
    if (p && p.categoryId && p.categoryId !== 'uncategorized') {
      const cat = cats.find(c => String(c.id) === String(p.categoryId) || String(c.slug).toLowerCase() === String(p.categoryId).toLowerCase());
      if (cat) return cat.name;
    }

    // 5. Fallback to capitalised query param if it exists, otherwise 'All Collections'
    if (param) {
      return param.charAt(0).toUpperCase() + param.slice(1);
    }
    return 'All Collections';
  });

  categoryLink = computed(() => {
    // 1. Explicitly came from All Collections / All Products page
    if (this.sourceFromParam() === 'all-collections') {
      return ['/all-products'];
    }

    const cats = this.categoryService.categories();

    // 2. Check query param from category page
    const param = this.sourceCategoryParam();
    if (param) {
      const matchParam = cats.find(c => String(c.slug).toLowerCase() === param.toLowerCase() || String(c.id) === param);
      const slug = matchParam ? (matchParam.slug || matchParam.id) : param;
      return ['/category', slug];
    }

    const p = this.product();
    // 3. Check product.categories array
    if (p && p.categories && p.categories.length > 0) {
      const firstCat = p.categories[0];
      const firstCatId = typeof firstCat === 'object' ? (firstCat.id ?? firstCat.categoryId)?.toString() : firstCat?.toString();
      const firstCatSlug = typeof firstCat === 'object' ? (firstCat.slug || firstCat.name) : null;
      const matchCat = cats.find(c =>
        (firstCatId && String(c.id) === String(firstCatId)) ||
        (firstCatSlug && String(c.slug).toLowerCase() === String(firstCatSlug).toLowerCase())
      );
      const slug = matchCat ? (matchCat.slug || matchCat.id) : (firstCatSlug || firstCatId);
      if (slug) return ['/category', slug];
    }

    // 4. Match by product's categoryId
    if (p && p.categoryId && p.categoryId !== 'uncategorized') {
      const cat = cats.find(c => String(c.id) === String(p.categoryId) || String(c.slug).toLowerCase() === String(p.categoryId).toLowerCase());
      const slug = cat ? (cat.slug || cat.id) : null;
      if (slug) return ['/category', slug];
    }

    return ['/all-products'];
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
    private messageService: MessageService,
    private titleService: Title,
    private metaService: Meta
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(qParams => {
      this.sourceCategoryParam.set(qParams['category'] || null);
      this.sourceFromParam.set(qParams['from'] || null);
    });

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
            this.router.navigate(['/products', product.slug], {
              replaceUrl: true,
              queryParamsHandling: 'preserve'
            });
          }

          // Fetch product categories if categoryId is missing or uncategorized
          if (!product.categories?.length || !product.categoryId || product.categoryId === 'uncategorized') {
            this.productService.listProductCategories(product.id).subscribe({
              next: (cats) => {
                if (cats && cats.length > 0) {
                  const firstCat = cats[0];
                  const catId = (typeof firstCat === 'object' ? (firstCat.id ?? firstCat.categoryId) : firstCat)?.toString();
                  this.product.update(p => p ? { ...p, categories: cats, categoryId: catId } : p);
                }
              },
              error: () => {}
            });
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

  isOutOfStock(targetProduct?: Product): boolean {
    const p = targetProduct ?? this.product();
    return !!p && p.isInStock === false;
  }

  addToCart() {
    const p = this.product();
    if (p) {
      this.cartService.addToCart(p, this.quantity());
    }
  }

  buyNow() {
    const p = this.product();
    if (p) {
      const added = this.cartService.addToCart(p, this.quantity());
      if (added > 0) {
        this.router.navigate(['/cart']);
      }
    }
  }

  incrementQuantity() {
    this.quantity.update(q => q + 1);
  }

  decrementQuantity() {
    if (this.quantity() > 1) {
      this.quantity.update(q => q - 1);
    }
  }

  selectTab(tab: 'about' | 'care' | 'shipping') {
    this.activeTab.set(tab);
  }

  showGalleria(index: number) {
    this.isZooming.set(false);
    this.activeImageIndex.set(index);
    this.displayGalleria.set(true);
  }

  showProductDetails(product: Product) {
    const catSlug = this.sourceCategoryParam();
    const fromParam = this.sourceFromParam();
    const queryParams: any = {};
    if (catSlug) queryParams.category = catSlug;
    if (fromParam) queryParams.from = fromParam;

    this.router.navigate(['/products', product.slug || product.id], {
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
    });
  }

  quickAddToCart(event: Event, product: Product) {
    event.stopPropagation();
    this.cartService.addToCart(product, 1);
  }

  nextImage(event?: Event) {
    if (event) event.stopPropagation();
    this.isZooming.set(false);
    const current = this.activeImageIndex();
    const total = this.images().length;
    if (total > 1) {
      this.activeImageIndex.set((current + 1) % total);
    }
  }

  prevImage(event?: Event) {
    if (event) event.stopPropagation();
    this.isZooming.set(false);
    const current = this.activeImageIndex();
    const total = this.images().length;
    if (total > 1) {
      this.activeImageIndex.set((current - 1 + total) % total);
    }
  }

  selectImage(idx: number) {
    this.isZooming.set(false);
    this.activeImageIndex.set(idx);
  }

  onMouseMove(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const halfLens = this.lensSize / 2;
    const maxLeft = width - this.lensSize;
    const maxTop = height - this.lensSize;

    const clampedLeft = Math.max(0, Math.min(x - halfLens, maxLeft));
    const clampedTop = Math.max(0, Math.min(y - halfLens, maxTop));

    this.lensLeft.set(clampedLeft);
    this.lensTop.set(clampedTop);

    const percentX = maxLeft > 0 ? (clampedLeft / maxLeft) * 100 : 0;
    const percentY = maxTop > 0 ? (clampedTop / maxTop) * 100 : 0;

    this.zoomBgX.set(percentX);
    this.zoomBgY.set(percentY);
    this.isZooming.set(true);
  }

  onMouseLeave() {
    this.isZooming.set(false);
  }

  closeLightbox() {
    this.displayGalleria.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (!this.displayGalleria()) return;
    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowLeft') {
      this.prevImage();
    } else if (event.key === 'ArrowRight') {
      this.nextImage();
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
