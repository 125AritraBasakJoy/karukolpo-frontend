import { Component, OnInit, signal, computed, ChangeDetectionStrategy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category/category.service';
import { ProductService } from '../../core/services/product/product.service';
import { CartService } from '../../core/services/cart/cart.service';
import { WishlistService } from '../../core/services/wishlist/wishlist.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';

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
    sortOrder = signal<string>('featured');

    priceRangeOptions = [
        { label: 'All Prices', value: 'all' },
        { label: 'Under ৳1,000', value: 'under_1000' },
        { label: '৳1,000 - ৳2,500', value: '1000_2500' },
        { label: '৳2,500 - ৳5,000', value: '2500_5000' },
        { label: 'Above ৳5,000', value: 'above_5000' }
    ];

    sortOptions = [
        { label: 'Featured / Recommended', value: 'featured' },
        { label: 'Price: Low to High', value: 'price_asc' },
        { label: 'Price: High to Low', value: 'price_desc' },
        { label: 'Newest Arrivals', value: 'newest' }
    ];

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
                if (priceRange === 'under_1000') return price < 1000;
                if (priceRange === '1000_2500') return price >= 1000 && price <= 2500;
                if (priceRange === '2500_5000') return price > 2500 && price <= 5000;
                if (priceRange === 'above_5000') return price > 5000;
                return true;
            });
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

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private categoryService: CategoryService,
        private productService: ProductService,
        public cartService: CartService,
        public wishlistService: WishlistService,
        private messageService: MessageService,
        private titleService: Title,
        private metaService: Meta,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        this.route.params.subscribe(params => {
            const id = params['id'];
            if (id) {
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
        this.searchQuery.set(val);
    }

    onPriceRangeChange(val: string) {
        this.selectedPriceRange.set(val);
    }

    onSortChange(val: string) {
        this.sortOrder.set(val);
    }

    clearFilters() {
        this.searchQuery.set('');
        this.selectedPriceRange.set('all');
        this.sortOrder.set('featured');
    }

    hasActiveFilters(): boolean {
        return this.searchQuery().trim() !== '' || this.selectedPriceRange() !== 'all' || this.sortOrder() !== 'featured';
    }

    showProductDetails(product: Product) {
        this.router.navigate(['/products', product.slug || product.id]);
    }

    quickAddToCart(event: Event, product: Product) {
        event.stopPropagation();
        if (this.isOutOfStock(product)) return;
        this.cartService.addToCart(product);
        this.messageService.add({
            severity: 'success',
            summary: 'Added to Cart',
            detail: `${product.name} added to your cart`,
            life: 2500
        });
    }

    toggleWishlist(event: Event, product: Product) {
        event.stopPropagation();
        this.wishlistService.toggleWishlist(product);
    }

    isOutOfStock(product: Product): boolean {
        return !product.isInStock;
    }
}
