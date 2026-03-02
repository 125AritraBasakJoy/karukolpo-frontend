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
    selector: 'app-hot-deals-manager',
    standalone: true,
    imports: [CommonModule, TableModule, ButtonModule, ToastModule, TooltipModule, TagModule],
    templateUrl: './hot-deals-manager.component.html',
    styleUrls: ['./hot-deals-manager.component.scss']
})
export class HotDealsManagerComponent implements OnInit {
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
        // Fetch a large enough limit to show all products for selection
        this.productService.getProducts(0, 1000, undefined, true)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (products) => {
                    this.products.set(products);
                    this.loadSavedHotDeals();
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

    loadSavedHotDeals() {
        this.loading.set(true);
        this.productService.getHotDeals()
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (hotDeals) => {
                    this.selectedProducts.set(hotDeals);
                },
                error: (err) => {
                    console.error('Failed to load hot deals', err);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load existing hot deals'
                    });
                }
            });
    }

    onSave() {
        const selectedIds = this.selectedProducts().map(p => Number(p.id));
        this.loading.set(true);

        this.productService.replaceHotDeals(selectedIds)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Saved Successfully',
                        detail: `${selectedIds.length} products are now marked for Hot Deals.`
                    });
                },
                error: (err) => {
                    console.error('Failed to save hot deals', err);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Save Failed',
                        detail: 'Backend rejected the update.'
                    });
                }
            });
    }

    onClearAll() {
        this.loading.set(true);
        this.productService.clearHotDeals()
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: () => {
                    this.selectedProducts.set([]);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Cleared Successfully',
                        detail: 'All products removed from Hot Deals.'
                    });
                },
                error: (err) => {
                    console.error('Failed to clear hot deals', err);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Clear Failed',
                        detail: 'Backend rejected the clear request.'
                    });
                }
            });
    }

    onCancel() {
        this.loadSavedHotDeals();
        this.messageService.add({
            severity: 'info',
            summary: 'Cancelled',
            detail: 'Selection reset to last saved state'
        });
    }
}
