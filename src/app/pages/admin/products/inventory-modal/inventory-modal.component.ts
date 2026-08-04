import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../core/services';;;
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { RadioButtonModule } from 'primeng/radiobutton';

@Component({
    selector: 'app-inventory-modal',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DialogModule,
        ButtonModule,
        InputNumberModule,
        DropdownModule,
        RadioButtonModule
    ],
    templateUrl: './inventory-modal.component.html'
})
export class InventoryModalComponent {
    @Input() visible = false;
    @Input() productId!: string;
    @Output() closed = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();

    quantity = 0;
    stockStatus = 'AUTO';
    loading = signal(false);

    constructor(
        private productService: ProductService,
        private messageService: MessageService
    ) { }

    close() {
        this.visible = false;
        this.closed.emit();
    }

    save() {
        if (!this.productId) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid Product ID' });
            return;
        }

        this.loading.set(true);
        // Assuming backend endpoint specifically for inventory or patch product
        // Per ProductService service: updateInventory(productId, quantity)

        this.productService.updateInventory(this.productId, this.quantity).subscribe({
            next: () => {
                this.loading.set(false);
                this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Inventory updated' });
                this.saved.emit();
            },
            error: (err) => {
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update inventory' });
                console.error(err);
            }
        });

        // If stockStatus needs to be saved separately, handle it here or modify service
    }
}
