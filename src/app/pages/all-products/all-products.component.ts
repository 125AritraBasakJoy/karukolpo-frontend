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
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';

@Component({
    selector: 'app-all-products',
    standalone: true,
    imports: [
        CommonModule, 
        ButtonModule, 
        TooltipModule, 
        TagModule, 
        SkeletonModule, 
        ToastModule, 
        DropdownModule, 
        InputTextModule, 
        DividerModule,
        FormsModule,
        CurrencyPipe, 
        NgOptimizedImage
    ],
    templateUrl: './all-products.component.html',
    styleUrls: ['./all-products.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllProductsComponent implements OnInit, OnDestroy {
    products = signal<Product[]>([]);
    loading = signal<boolean>(true);
    totalCount = signal<number>(0);
    
    // Server-side Filtering and Sorting State
    searchQuery = signal<string>('');
    selectedCategoryId = signal<string | null>(null);
    sortOrder = signal<string>('newest');
    filterType = signal<string | null>(null);
    inStockOnly = signal<boolean>(false);
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
        { label: 'Under ৳500', value: 'under-500' },
        { label: '৳500 - ৳1,000', value: '500-1000' },
        { label: '৳1,000 - ৳2,500', value: '1000-2500' },
        { label: '৳2,500+', value: '2500-above' }
    ];

    hasActiveFilters = computed(() => {
        return !!(
            this.searchQuery() ||
            this.selectedCategoryId() ||
            this.sortOrder() !== 'newest' ||
            this.inStockOnly() ||
            this.selectedPriceRange() !== 'all'
        );
    });

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private productService: ProductService,
        public cartService: CartService,
        private categoryService: CategoryService,
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

    toggleInStockOnly() {
        this.inStockOnly.set(!this.inStockOnly());
        this.fetchProducts();
    }

    private getPriceBounds(): { min?: number; max?: number } {
        const range = this.selectedPriceRange();
        switch (range) {
            case 'under-500': return { max: 500 };
            case '500-1000': return { min: 500, max: 1000 };
            case '1000-2500': return { min: 1000, max: 2500 };
            case '2500-above': return { min: 2500 };
            default: return {};
        }
    }

    fetchProducts() {
        this.loading.set(true);

        const filter = this.filterType();
        if (filter === 'hot-deals') {
            this.productService.getHotDeals().subscribe({
                next: (items) => {
                    this.products.set(items);
                    this.totalCount.set(items.length);
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
                    this.products.set(items);
                    this.totalCount.set(items.length);
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
        const options: ProductQueryOptions = {
            skip: 0,
            limit: 100,
            q: this.searchQuery() || undefined,
            categoryId: this.selectedCategoryId() || undefined,
            minPrice: priceBounds.min,
            maxPrice: priceBounds.max,
            inStock: this.inStockOnly() ? true : undefined,
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

    updateSeo() {
        const filter = this.filterType();
        if (filter === 'hot-deals') {
            this.titleService.setTitle('Hot Deals | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Explore our hot deals and special offers on authentic Bangladeshi handcrafted items.' });
        } else if (filter === 'best-selling') {
            this.titleService.setTitle('Best Selling | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Shop our best-selling authentic Bangladeshi handcrafted items.' });
        } else {
            this.titleService.setTitle('Our Collections | Karukolpo');
            this.metaService.updateTag({ name: 'description', content: 'Explore our full collection of authentic Bangladeshi handcrafted items, from traditional Shora to modern home decor.' });
        }
    }

    getPageTitle(): string {
        const filter = this.filterType();
        if (filter === 'hot-deals') {
            return 'Hot Deals';
        } else if (filter === 'best-selling') {
            return 'Best Selling';
        }
        return 'Our Collections';
    }

    showProductDetails(product: Product) {
        this.router.navigate(['/products', product.slug || product.id]);
    }

    addToCart(product: Product) {
        this.cartService.addToCart(product);
    }

    isOutOfStock(product: Product): boolean {
        return !product.isInStock;
    }

    goBack() {
        this.router.navigate(['/']);
    }

    clearFilters() {
        this.searchQuery.set('');
        this.selectedCategoryId.set(null);
        this.sortOrder.set('newest');
        this.inStockOnly.set(false);
        this.selectedPriceRange.set('all');
        this.fetchProducts();
    }
}
