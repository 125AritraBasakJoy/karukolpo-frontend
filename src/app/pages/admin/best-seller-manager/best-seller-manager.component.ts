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
                    this.loadSavedBestSelling();
                },
                error: (err) => {
                    console.error('Failed to load products', err);
                    this.messageService.add({ life: 2000,
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load products from API'
                    });
                }
            });
    }

    loadSavedBestSelling() {
        this.loading.set(true);
        this.productService.getBestSellers()
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (bestSellers) => {
                    this.selectedProducts.set(bestSellers);
                },
                error: (err) => {
                    console.error('Failed to load best sellers', err);
                    this.messageService.add({ life: 2000,
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Failed to load existing best sellers'
                    });
                }
            });
    }

    onSave() {
        const selectedIds = this.selectedProducts().map(p => Number(p.id));
        this.loading.set(true);

        this.productService.replaceBestSellers(selectedIds)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: () => {
                    this.messageService.add({ life: 2000,
                        severity: 'success',
                        summary: 'Saved Successfully',
                        detail: `${selectedIds.length} products are now marked as Best Sellers.`
                    });
                },
                error: (err) => {
                    console.error('Failed to save best sellers', err);
                    this.messageService.add({ life: 2000,
                        severity: 'error',
                        summary: 'Save Failed',
                        detail: 'Backend rejected the update.'
                    });
                }
            });
    }

    onClearAll() {
        this.loading.set(true);
        this.productService.clearBestSellers()
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: () => {
                    this.selectedProducts.set([]);
                    this.messageService.add({ life: 2000,
                        severity: 'success',
                        summary: 'Cleared Successfully',
                        detail: 'All products removed from Best Sellers.'
                    });
                },
                error: (err) => {
                    console.error('Failed to clear best sellers', err);
                    this.messageService.add({ life: 2000,
                        severity: 'error',
                        summary: 'Clear Failed',
                        detail: 'Backend rejected the clear request.'
                    });
                }
            });
    }

    onCancel() {
        this.loadSavedBestSelling();
        this.messageService.add({ life: 2000,
            severity: 'info',
            summary: 'Cancelled',
            detail: 'Selection reset to last saved state'
        });
    }
}
