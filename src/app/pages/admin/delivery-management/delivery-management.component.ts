import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { DeliveryService } from '../../../services/delivery.service';

@Component({
    selector: 'app-delivery-management',
    standalone: true,
    imports: [CommonModule, FormsModule, InputNumberModule, ButtonModule, CardModule, ToastModule, NotificationButtonComponent],
    providers: [MessageService],
    template: `
    <div class="card">
        <div class="flex justify-content-between align-items-center mb-4">
            <h2 class="m-0">Delivery Charge Management</h2>
            <div class="flex gap-2">
                <app-notification-button></app-notification-button>
                <p-button icon="pi pi-refresh" (onClick)="refreshCharges()" styleClass="p-button-outlined p-button-secondary" pTooltip="Refresh Charges" tooltipPosition="bottom"></p-button>
            </div>
        </div>
        
        <div class="grid p-fluid">
            <div class="col-12 md:col-6">
                <div class="field">
                    <label for="insideDhaka" class="font-bold">Inside Dhaka (BDT)</label>
                    <p-inputNumber id="insideDhaka" [(ngModel)]="insideDhaka" mode="currency" currency="BDT" locale="en-BD"></p-inputNumber>
                </div>
            </div>
            
            <div class="col-12 md:col-6">
                <div class="field">
                    <label for="outsideDhaka" class="font-bold">Outside Dhaka (BDT)</label>
                    <p-inputNumber id="outsideDhaka" [(ngModel)]="outsideDhaka" mode="currency" currency="BDT" locale="en-BD"></p-inputNumber>
                </div>
            </div>
            
            <div class="col-12">
                <p-button label="Update Charges" icon="pi pi-save" (onClick)="saveCharges()"></p-button>
            </div>
        </div>
    </div>
    <p-toast></p-toast>
  `
})
export class DeliveryManagementComponent implements OnInit {
    insideDhaka: number = 0;
    outsideDhaka: number = 0;

    constructor(
        private deliveryService: DeliveryService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.loadCharges();
    }

    loadCharges() {
        const current = this.deliveryService.getCharges();
        this.insideDhaka = current.insideDhaka;
        this.outsideDhaka = current.outsideDhaka;
    }

    refreshCharges() {
        // Force reload from storage if needed, though getCharges uses signal which is already synced.
        // But to be safe and give feedback:
        this.loadCharges();
        this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Delivery charges updated' });
    }

    saveCharges() {
        this.deliveryService.updateCharges(this.insideDhaka, this.outsideDhaka);
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Delivery charges updated successfully' });
    }
}
