import { Component, OnInit, signal, computed, ChangeDetectionStrategy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category/category.service';
import { ProductService } from '../../core/services/product/product.service';
import { CartService } from '../../core/services/cart/cart.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { DrawerModule } from 'primeng/drawer';
import { PaginatorModule } from 'primeng/paginator';

@Component({
    selector: 'app-category-products',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        SkeletonModule,
        ToastModule,
        DropdownModule,
        DrawerModule,
        PaginatorModule,
        RouterLink
    ],
    templateUrl: './category-products.component.html',
    styleUrls: ['./category-products.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryProductsComponent implements OnInit {
    category = signal<Category | null>(null);
    rawProducts = signal<Product[]>([]);
    loading = signal<boolean>(true);

    // Search & Filter signals
    searchQuery = signal<string>('');
    selectedPriceRange = signal<string>('all');
    selectedAvailability = signal<'all' | 'in_stock'>('all');
    sortOrder = signal<string>('featured');

    // Pagination signals
    first = signal<number>(0);
    rows = signal<number>(12);

    // Categories
    categories = this.categoryService.categories;

    // Mobile right-drawer state
    isMobileFilterOpen = signal<boolean>(false);
    draftCategoryId = signal<string | null>(null);
    draftPriceRange = signal<string>('all');
    draftAvailability = signal<'all' | 'in_stock'>('all');
    draftSortOrder = signal<string>('featured');

    activeDrawerFilterCount = computed(() => {
        let count = 0;
        if (this.selectedPriceRange() !== 'all') count++;
        if (this.selectedAvailability() !== 'all') count++;
        if (this.sortOrder() !== 'featured') count++;
        return count;
    });

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
        { label: 'In Stock', value: 'in_stock' }
    ];

    sortOptions = [
        { label: 'Featured / Recommended', value: 'featured' },
        { label: 'Price: Low to High', value: 'price_asc' },
        { label: 'Price: High to Low', value: 'price_desc' },
        { label: 'Newest Arrivals', value: 'newest' }
    ];

    hasActiveFilters = computed(() => {
        return !!(
            this.searchQuery() ||
            this.selectedPriceRange() !== 'all' ||
            this.selectedAvailability() !== 'all' ||
            this.sortOrder() !== 'featured'
        );
    });

    // Filtered and sorted products
    filteredProducts = computed(() => {
        let items = [...this.rawProducts()];
        const q = this.searchQuery().toLowerCase().trim();

        if (q) {
            items = items.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.description && p.description.toLowerCase().includes(q))
            );
        }

        const priceRange = this.selectedPriceRange();
        if (priceRange !== 'all') {
            items = items.filter(p => {
                const price = p.effective_price || p.price;
                if (priceRange === 'under-300') return price < 300;
                if (priceRange === '300-600') return price >= 300 && price <= 600;
                if (priceRange === '600-1000') return price >= 600 && price <= 1000;
                if (priceRange === '1000-2000') return price >= 1000 && price <= 2000;
                if (priceRange === '2000-above') return price > 2000;
                return true;
            });
        }

        if (this.selectedAvailability() === 'in_stock') {
            items = items.filter(p => p.isInStock);
        }

        const sort = this.sortOrder();
        if (sort === 'price_asc') {
            items.sort((a, b) => (a.effective_price || a.price) - (b.effective_price || b.price));
        } else if (sort === 'price_desc') {
            items.sort((a, b) => (b.effective_price || b.price) - (a.effective_price || a.price));
        } else if (sort === 'newest') {
            items.sort((a, b) => ((b as any).created_at ? new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime() : 0));
        }

        return items;
    });

    pagedProducts = computed(() => {
        const items = this.filteredProducts();
        const start = this.first();
        return items.slice(start, start + this.rows());
    });

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private categoryService: CategoryService,
        private productService: ProductService,
        public cartService: CartService,
        private titleService: Title,
        private metaService: Meta,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        this.route.params.subscribe(params => {
            const id = params['id'];
            if (id) {
                this.first.set(0);
                if (isPlatformBrowser(this.platformId)) {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }
                this.loadCategoryAndProducts(id);
            }
        });
    }

    loadCategoryAndProducts(id: string) {
        this.loading.set(true);

        this.categoryService.getCategoryById(id).subscribe({
            next: (cat) => {
                if (cat) {
                    this.category.set(cat);
                    this.updateSeo(cat);

                    if (cat.slug && id !== cat.slug) {
                        this.router.navigate(['/category', cat.slug], { replaceUrl: true });
                    }

                    if (cat.products && cat.products.length > 0) {
                        this.rawProducts.set(cat.products);
                        this.loading.set(false);
                    } else {
                        this.fetchProductsSeparately(cat.id || id);
                    }
                } else {
                    this.fetchProductsSeparately(id);
                }
            },
            error: () => {
                this.fetchProductsSeparately(id);
            }
        });
    }

    private fetchProductsSeparately(id: string) {
        this.categoryService.getProductsByCategory(id).subscribe({
            next: (products) => {
                this.rawProducts.set(products || []);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching category products', err);
                this.loading.set(false);
            }
        });
    }

    updateSeo(category: Category) {
        const title = `${category.name} | Karukolpo Handicrafts`;
        this.titleService.setTitle(title);
        this.metaService.updateTag({ name: 'description', content: `Browse authentic handcrafted ${category.name} from Bangladesh.` });
    }

    getCategorySubtitle(): string {
        const cat = this.category();
        if (!cat) return 'Discover authentic handmade treasures rooted in Bangladeshi heritage.';
        const name = cat.name.toLowerCase();
        if (name.includes('protima') || name.includes('প্রতিমা') || name.includes('idol')) {
            return 'Sacred forms, handcrafted with devotion. Discover idols of Durga, Ganesh, and deities shaped from clay, bronze, and stone.';
        }
        if (name.includes('clay') || name.includes('মাটি') || name.includes('terracotta')) {
            return 'Timeless terracotta and earthenware, fired with heritage techniques passed down through generations.';
        }
        if (name.includes('decor') || name.includes('home')) {
            return 'Adorn your living spaces with the warmth of rustic artisanal craftsmanship and tradition.';
        }
        return `Discover our handpicked collection of authentic ${cat.name}, crafted with soul and precision.`;
    }

    onSearchInput(val: string) {
        this.first.set(0);
        this.searchQuery.set(val);
    }

    onPriceRangeChange(val: string) {
        this.first.set(0);
        this.selectedPriceRange.set(val);
    }

    onSortChange(val: string) {
        this.first.set(0);
        this.sortOrder.set(val);
    }

    setAvailability(avail: any) {
        this.first.set(0);
        this.selectedAvailability.set(avail as 'all' | 'in_stock');
    }

    isCategorySelected(catId: any): boolean {
        const currentCat = this.category();
        if (!currentCat) return false;
        return String(currentCat.id) === String(catId);
    }

    clearFilters() {
        this.first.set(0);
        this.searchQuery.set('');
        this.selectedPriceRange.set('all');
        this.selectedAvailability.set('all');
        this.sortOrder.set('featured');
        this.draftPriceRange.set('all');
        this.draftAvailability.set('all');
        this.draftSortOrder.set('featured');
    }

    openMobileFilters() {
        const curCat = this.category();
        this.draftCategoryId.set(curCat ? (curCat.id as string) : null);
        this.draftPriceRange.set(this.selectedPriceRange());
        this.draftAvailability.set(this.selectedAvailability());
        this.draftSortOrder.set(this.sortOrder());
        this.isMobileFilterOpen.set(true);
    }

    applyMobileFilters() {
        const targetCatId = this.draftCategoryId();
        const curCat = this.category();

        this.first.set(0);
        this.selectedPriceRange.set(this.draftPriceRange());
        this.selectedAvailability.set(this.draftAvailability());
        this.sortOrder.set(this.draftSortOrder());
        this.isMobileFilterOpen.set(false);

        // If category changed from the dropdown, navigate to that category or all-products
        if (!targetCatId) {
            this.router.navigate(['/all-products']);
        } else if (!curCat || String(curCat.id) !== String(targetCatId)) {
            const targetCat = this.categories().find(c => String(c.id) === String(targetCatId));
            const slug = targetCat ? (targetCat.slug || targetCat.id) : targetCatId;
            this.router.navigate(['/category', slug]);
        }
    }

    resetDraftFilters() {
        const curCat = this.category();
        this.draftCategoryId.set(curCat ? (curCat.id as string) : null);
        this.draftPriceRange.set('all');
        this.draftAvailability.set('all');
        this.draftSortOrder.set('featured');
    }

    onFilterDrawerHide() {
        this.isMobileFilterOpen.set(false);
    }

    onPageChange(event: any) {
        this.first.set(event.first);
        this.rows.set(event.rows);
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    showProductDetails(product: Product) {
        const cat = this.category();
        this.router.navigate(['/products', product.slug || product.id], {
            queryParams: cat ? { category: cat.slug || cat.id } : undefined
        });
    }

    quickAddToCart(event: Event, product: Product) {
        event.stopPropagation();
        if (this.isOutOfStock(product)) return;
        this.cartService.addToCart(product);
    }

    isOutOfStock(product: Product): boolean {
        return !product.isInStock;
    }
}
