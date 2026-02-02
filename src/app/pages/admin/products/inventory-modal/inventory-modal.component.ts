import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../services/product.service';
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
    template: `
    <p-dialog 
      header="Set Inventory" 
      [(visible)]="visible" 
      [modal]="true" 
      [style]="{width: '450px'}" 
      (onHide)="close()">
      
      <div class="p-fluid">
        <!-- Quantity -->
        <div class="field mb-4">
          <label for="quantity" class="font-bold block mb-2">Initial Quantity</label>
          <p-inputNumber id="quantity" [(ngModel)]="quantity" [min]="0" [showButtons]="true"></p-inputNumber>
        </div>

        <!-- Stock Status (Optional, if backend supports it directly or derived) -->
        <div class="field mb-4">
            <label class="font-bold block mb-2">Stock Availability</label>
            <div class="flex flex-column gap-2">
                <div class="flex align-items-center">
                    <p-radioButton name="stockStatus" value="AUTO" [(ngModel)]="stockStatus" inputId="status1"></p-radioButton>
                    <label for="status1" class="ml-2">Auto (Based on Quantity)</label>
                </div>
                <div class="flex align-items-center">
                    <p-radioButton name="stockStatus" value="IN_STOCK" [(ngModel)]="stockStatus" inputId="status2"></p-radioButton>
                    <label for="status2" class="ml-2">In Stock</label>
                </div>
                <div class="flex align-items-center">
                    <p-radioButton name="stockStatus" value="OUT_OF_STOCK" [(ngModel)]="stockStatus" inputId="status3"></p-radioButton>
                    <label for="status3" class="ml-2">Out of Stock</label>
                </div>
            </div>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Skip" icon="pi pi-times" styleClass="p-button-text" (click)="close()"></p-button>
        <p-button label="Save Inventory" icon="pi pi-check" (click)="save()" [loading]="loading()"></p-button>
      </ng-template>
    </p-dialog>
  `
})
export class InventoryModalComponent {
    @Input() visible = false;
    @Input() productId!: number;
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
