import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/product.model';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-best-seller-manager',
    standalone: true,
    imports: [CommonModule, TableModule, ButtonModule, ToastModule, TooltipModule, TagModule],
    templateUrl: './best-seller-manager.component.html',
    styleUrls: ['./best-seller-manager.component.scss']
})
export class BestSellerManagerComponent implements OnInit {
    private productService = inject(ProductService);
    private messageService = inject(MessageService);

    products = signal<Product[]>([]);
    selectedProducts = signal<Product[]>([]);
    loading = signal<boolean>(false);

    ngOnInit() {
        this.loadProducts();
    }

    loadProducts() {
        this.loading.set(true);
        this.productService.getProducts(0, 1000, undefined, true)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (products) => {
                    this.products.set(products);
                    this.loadSavedBestSelling(products);
                },
                error: (err) => {
                    console.error('Failed to load products', err);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load products from API'
                    });
                }
            });
    }

    loadSavedBestSelling(allProducts: Product[]) {
        const saved = localStorage.getItem('admin_best_selling_ids');
        if (saved) {
            try {
                const savedIds = new Set(JSON.parse(saved) as string[]);
                const preSelected = allProducts.filter(p => savedIds.has(p.id.toString()));
                this.selectedProducts.set(preSelected);
            } catch (e) {
                console.error('Failed to parse saved best selling deals', e);
            }
        }
    }

    onSave() {
        const selectedIds = this.selectedProducts().map(p => p.id.toString());
        localStorage.setItem('admin_best_selling_ids', JSON.stringify(selectedIds));

        this.messageService.add({
            severity: 'success',
            summary: 'Saved Successfully',
            detail: `${selectedIds.length} products are now marked as Best Sellers.`
        });
    }

    onCancel() {
        const saved = localStorage.getItem('admin_best_selling_ids');
        if (saved) {
            const savedIds = new Set(JSON.parse(saved) as string[]);
            const preSelected = this.products().filter(p => savedIds.has(p.id.toString()));
            this.selectedProducts.set(preSelected);
        } else {
            this.selectedProducts.set([]);
        }
        this.messageService.add({
            severity: 'info',
            summary: 'Cancelled',
            detail: 'Selection reset to last saved state'
        });
    }
}
