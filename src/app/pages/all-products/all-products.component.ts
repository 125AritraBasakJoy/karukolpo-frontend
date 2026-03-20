import { Component, OnInit, signal, ChangeDetectionStrategy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, CurrencyPipe, NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { Router } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-all-products',
    standalone: true,
    imports: [CommonModule, ButtonModule, TooltipModule, TagModule, SkeletonModule, ToastModule, CurrencyPipe, SafeHtmlPipe, NgOptimizedImage],
    templateUrl: './all-products.component.html',
    styleUrls: ['./all-products.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllProductsComponent implements OnInit {
    products = signal<Product[]>([]);
    loading = signal<boolean>(true);

    constructor(
        private router: Router,
        private productService: ProductService,
        public cartService: CartService,
        private titleService: Title,
        private metaService: Meta,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
        this.updateSeo();
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
        this.titleService.setTitle('All Products | Karukolpo');
        this.metaService.updateTag({ name: 'description', content: 'Browse our entire collection of authentic Bangladeshi handmade crafts.' });
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
}
