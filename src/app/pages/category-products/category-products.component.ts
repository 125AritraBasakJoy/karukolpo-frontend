import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-category-products',
    standalone: true,
    imports: [CommonModule, ButtonModule, SkeletonModule, ToastModule, CurrencyPipe, RouterLink],
    providers: [MessageService],
    templateUrl: './category-products.component.html',
    styleUrls: ['./category-products.component.scss']
})
export class CategoryProductsComponent implements OnInit {
    category = signal<Category | null>(null);
    products = signal<Product[]>([]);
    loading = signal<boolean>(true);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private categoryService: CategoryService,
        private productService: ProductService,
        public cartService: CartService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.route.params.subscribe(params => {
            const id = params['id'];
            if (id) {
                this.loadCategoryAndProducts(id);
            }
        });
    }

    loadCategoryAndProducts(id: string) {
        this.loading.set(true);

        // Fetch Category Name
        this.categoryService.getCategoryById(id).subscribe(cat => {
            if (cat) {
                this.category.set(cat);
            }
        });

        // Fetch Category Products
        this.categoryService.getCategoryProducts(id).subscribe({
            next: (products) => {
                this.products.set(products);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error fetching category products', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load products' });
                this.loading.set(false);
            }
        });
    }

    showProductDetails(product: Product) {
        this.router.navigate(['/products', product.id]);
    }

    addToCart(product: Product) {
        this.cartService.addToCart(product);
    }

    isOutOfStock(product: Product): boolean {
        if (product.manualStockStatus === 'OUT_OF_STOCK') return true;
        if (product.manualStockStatus === 'IN_STOCK') return false;
        return (product.stock || 0) <= 0;
    }

    goBack() {
        this.router.navigate(['/']);
    }
}
