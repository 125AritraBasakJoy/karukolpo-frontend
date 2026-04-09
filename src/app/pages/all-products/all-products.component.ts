import { Component, OnInit, signal, ChangeDetectionStrategy, Inject, PLATFORM_ID, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { CategoryService } from '../../services/category.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
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
        SafeHtmlPipe, 
        NgOptimizedImage
    ],
    templateUrl: './all-products.component.html',
    styleUrls: ['./all-products.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllProductsComponent implements OnInit {
    products = signal<Product[]>([]);
    loading = signal<boolean>(true);
    
    // Filtering and Sorting State
    searchQuery = signal<string>('');
    selectedCategoryId = signal<string | null>(null);
    sortOrder = signal<string>('featured');
    
    categories = this.categoryService.categories;

    /**
     * Build a map of productId -> categoryIds[] from the loaded categories.
     * This is necessary because the primary products API does not return category info.
     */
    productCategoryMap = computed(() => {
        const map = new Map<string, string[]>();
        this.categories().forEach(cat => {
            if (cat.products && Array.isArray(cat.products)) {
                cat.products.forEach(p => {
                    const productId = p.id?.toString();
                    if (productId) {
                        const existing = map.get(productId) || [];
                        if (!existing.includes(cat.id)) {
                            existing.push(cat.id);
                        }
                        map.set(productId, existing);
                    }
                });
            }
        });
        return map;
    });

    sortOptions = [
        { label: 'Featured', value: 'featured' },
        { label: 'Price: Low to High', value: 'price-low' },
        { label: 'Price: High to Low', value: 'price-high' },
        { label: 'Name: A-Z', value: 'name-asc' },
        { label: 'Name: Z-A', value: 'name-desc' }
    ];

    filteredProducts = computed(() => {
        let result = [...this.products()];

        // 1. Search Filter (Case-insensitive)
        if (this.searchQuery()) {
            const query = this.searchQuery().toLowerCase().trim();
            result = result.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.description && p.description.toLowerCase().includes(query)) ||
                (p.code && p.code.toLowerCase().includes(query))
            );
        }

        // 2. Category Filter (Supports multi-category products via client-side mapping)
        const selectedId = this.selectedCategoryId();
        if (selectedId) {
            result = result.filter(p => {
                // Check primary category ID on product
                if (p.categoryId === selectedId) return true;
                
                // Check if product belongs to this category via the map built from CategoryService
                const productCats = this.productCategoryMap().get(p.id) || [];
                if (productCats.includes(selectedId)) return true;
                
                // Check categories array on product if populated
                if (p.categories && p.categories.some((c: any) => (c.id || c).toString() === selectedId)) return true;
                
                return false;
            });
        }

        // 3. Sorting & Prioritization
        switch (this.sortOrder()) {
            case 'price-low':
                result.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                result.sort((a, b) => b.price - a.price);
                break;
            case 'name-asc':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                result.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'featured':
            default:
                // Prioritize Hot Deals and Best Sellers first, then by date/id (default)
                result.sort((a, b) => {
                    const scoreA = (a.isHotDeal ? 2 : 0) + (a.isBestSeller ? 1 : 0);
                    const scoreB = (b.isHotDeal ? 2 : 0) + (b.isBestSeller ? 1 : 0);
                    if (scoreA !== scoreB) return scoreB - scoreA;
                    // For stable sort if scores are equal, maintain original array order
                    return 0;
                });
                break;
        }

        return result;
    });

    constructor(
        private router: Router,
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
        this.updateSeo();
        this.cartService.refreshCartProducts();
        this.loadProducts();
    }

    loadProducts() {
        this.loading.set(true);
        this.productService.getProducts().subscribe({
            next: (products) => {
                this.products.set(products);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching products', err);
                this.loading.set(false);
            }
        });
    }

    updateSeo() {
        this.titleService.setTitle('Our Collections | Karukolpo');
        this.metaService.updateTag({ name: 'description', content: 'Explore our full collection of authentic Bangladeshi handcrafted items, from traditional Shora to modern home decor.' });
    }

    showProductDetails(product: Product) {
        this.router.navigate(['/products', product.id]);
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
        this.sortOrder.set('featured');
    }
}
