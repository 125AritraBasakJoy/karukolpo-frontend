import { Component, OnInit, OnDestroy, signal, ChangeDetectionStrategy, Inject, PLATFORM_ID, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductService, ProductQueryOptions } from '../../core/services/product/product.service';
import { CartService } from '../../core/services/cart/cart.service';
import { CategoryService } from '../../core/services/category/category.service';
import { WishlistService } from '../../core/services/wishlist/wishlist.service';
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-all-products',
    standalone: true,
    imports: [
        CommonModule, 
        ButtonModule, 
        FormsModule,
        TooltipModule,
        TagModule,
        SkeletonModule,
        ToastModule,
        DropdownModule,
        InputTextModule,
        DividerModule
    ],
    templateUrl: './all-products.component.html',
    styleUrls: ['./all-products.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllProductsComponent implements OnInit, OnDestroy {
    products = signal<Product[]>([]);
    allCatalogProducts = signal<Product[]>([]);
    loading = signal<boolean>(true);
    totalCount = signal<number>(0);
    
    // Server-side & Client-side Filtering State
    searchQuery = signal<string>('');
    selectedCategoryId = signal<string | null>(null);
    sortOrder = signal<string>('newest');
    filterType = signal<string | null>(null);
    selectedAvailability = signal<'all' | 'in_stock' | 'out_of_stock'>('all');
    selectedPriceRange = signal<string>('all');
    
    categories = this.categoryService.categories;

    private searchSubject = new Subject<string>();
    private searchSubscription?: Subscription;

    sortOptions = [
        { label: 'Featured / Newest', value: 'newest' },
        { label: 'Price: Low to High', value: 'price_asc' },
        { label: 'Price: High to Low', value: 'price_desc' },
        { label: 'Name: A-Z', value: 'name' }
    ];

    priceRangeOptions = [
        { label: 'All Prices', value: 'all' },
        { label: 'Under ৳ 300', value: 'under-300' },
        { label: '৳ 300 - ৳ 600', value: '300-600' },
        { label: '৳ 600 - ৳ 1,000', value: '600-1000' },
        { label: '৳ 1,000 - ৳ 2,000', value: '1000-2000' },
        { label: 'Above ৳ 2,000', value: '2000-above' }
    ];

    availabilityOptions = [
        { label: 'All Availability', value: 'all' },
        { label: 'In Stock', value: 'in_stock' },
        { label: 'Out of Stock', value: 'out_of_stock' }
    ];

    hasActiveFilters = computed(() => {
        return !!(
            this.searchQuery() ||
            this.selectedCategoryId() ||
            this.sortOrder() !== 'newest' ||
            this.selectedAvailability() !== 'all' ||
            this.selectedPriceRange() !== 'all'
        );
    });

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private productService: ProductService,
        public cartService: CartService,
        public categoryService: CategoryService,
        public wishlistService: WishlistService,
        private messageService: MessageService,
        private titleService: Title,
        private metaService: Meta,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Debounce search input to avoid querying on every keystroke
        this.searchSubscription = this.searchSubject.pipe(
            debounceTime(350),
            distinctUntilChanged()
        ).subscribe(() => {
            this.fetchProducts();
        });

        this.route.queryParams.subscribe(params => {
            if (params['filter']) {
                this.filterType.set(params['filter']);
            } else {
                this.filterType.set(null);
            }
            if (params['q']) {
                this.searchQuery.set(params['q']);
            }
            if (params['category']) {
                this.selectedCategoryId.set(params['category']);
            }
            this.updateSeo();
            this.fetchProducts();
        });

        this.cartService.refreshCartProducts();
    }

    ngOnDestroy() {
        this.searchSubscription?.unsubscribe();
    }

    onSearchInput(text: string) {
        this.searchQuery.set(text);
        this.searchSubject.next(text);
    }

    onCategoryChange(catId: string | null) {
        this.selectedCategoryId.set(catId);
        this.fetchProducts();
    }

    onSortChange(sort: string) {
        this.sortOrder.set(sort);
        this.fetchProducts();
    }

    onPriceRangeChange(range: string) {
        this.selectedPriceRange.set(range);
        this.fetchProducts();
    }

    isCategorySelected(catId: any): boolean {
        if (!catId && !this.selectedCategoryId()) return true;
        return String(this.selectedCategoryId()) === String(catId);
    }

    setAvailability(avail: any) {
        this.selectedAvailability.set(avail as 'all' | 'in_stock' | 'out_of_stock');
        this.fetchProducts();
    }

    private getPriceBounds(): { min?: number; max?: number } {
        const range = this.selectedPriceRange();
        switch (range) {
            case 'under-300': return { max: 300 };
            case '300-600': return { min: 300, max: 600 };
            case '600-1000': return { min: 600, max: 1000 };
            case '1000-2000': return { min: 1000, max: 2000 };
            case '2000-above': return { min: 2000 };
            default: return {};
        }
    }

    fetchProducts() {
        this.loading.set(true);

        const filter = this.filterType();
        if (filter === 'hot-deals') {
            this.productService.getHotDeals().subscribe({
                next: (items) => {
                    this.applyClientSideFilters(items);
                    this.loading.set(false);
                },
                error: (err) => {
                    console.error('Error fetching hot deals:', err);
                    this.loading.set(false);
                }
            });
            return;
        }

        if (filter === 'best-selling') {
            this.productService.getBestSellers().subscribe({
                next: (items) => {
                    this.applyClientSideFilters(items);
                    this.loading.set(false);
                },
                error: (err) => {
                    console.error('Error fetching best sellers:', err);
                    this.loading.set(false);
                }
            });
            return;
        }

        const priceBounds = this.getPriceBounds();
        const inStockFilter = this.selectedAvailability() === 'in_stock' 
            ? true 
            : (this.selectedAvailability() === 'out_of_stock' ? false : undefined);

        const options: ProductQueryOptions = {
            skip: 0,
            limit: 100,
            q: this.searchQuery() || undefined,
            categoryId: this.selectedCategoryId() || undefined,
            minPrice: priceBounds.min,
            maxPrice: priceBounds.max,
            inStock: inStockFilter,
            sort: this.sortOrder()
        };

        this.productService.getProductsWithCount(options).subscribe({
            next: (res) => {
                this.products.set(res.items);
                this.totalCount.set(res.total);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching catalog products:', err);
                this.loading.set(false);
            }
        });
    }

    private applyClientSideFilters(items: Product[]) {
        let filtered = [...items];
        if (this.searchQuery()) {
            const q = this.searchQuery().toLowerCase().trim();
            filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
        }
        if (this.selectedCategoryId()) {
            filtered = filtered.filter(p => String(p.categoryId) === String(this.selectedCategoryId()));
        }
        if (this.selectedAvailability() === 'in_stock') {
            filtered = filtered.filter(p => p.isInStock);
        } else if (this.selectedAvailability() === 'out_of_stock') {
            filtered = filtered.filter(p => !p.isInStock);
        }
        this.products.set(filtered);
        this.totalCount.set(filtered.length);
    }

    updateSeo() {
        const filter = this.filterType();
        if (filter === 'hot-deals') {
            this.titleService.setTitle('Hot Deals | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Explore our hot deals and special offers on authentic Bangladeshi handcrafted items.' });
        } else if (filter === 'best-selling') {
            this.titleService.setTitle('Best Selling | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Shop our best-selling authentic Bangladeshi handcrafted items.' });
        } else {
            this.titleService.setTitle('All Products | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Explore our complete collection of authentic Bangladeshi handicrafts, terracotta and traditional pieces.' });
        }
    }

    getPageTitle(): string {
        const filter = this.filterType();
        if (filter === 'hot-deals') return 'Hot Deals';
        if (filter === 'best-selling') return 'Best Selling';
        return 'All Products';
    }

    showProductDetails(product: Product) {
        this.router.navigate(['/products', product.slug || product.id]);
    }

    quickAddToCart(product: Product, event: Event) {
        event.stopPropagation();
        event.preventDefault();
        this.cartService.addToCart(product);
        this.messageService.add({
            severity: 'success',
            summary: 'Added to Cart',
            detail: `"${product.name}" added to your shopping bag!`,
            life: 2500
        });
    }

    isOutOfStock(product: Product): boolean {
        return !product.isInStock;
    }

    clearFilters() {
        this.searchQuery.set('');
        this.selectedCategoryId.set(null);
        this.sortOrder.set('newest');
        this.selectedAvailability.set('all');
        this.selectedPriceRange.set('all');
        this.fetchProducts();
    }
}
