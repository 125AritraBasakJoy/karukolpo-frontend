import { Component, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../../services/payment.service';
import { NotificationButtonComponent } from '../../../components/notification-button/notification-button.component';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-payment-management',
  standalone: true,
  imports: [CommonModule, ButtonModule, FileUploadModule, ToastModule, CardModule, NotificationButtonComponent],
  providers: [MessageService],
  template: `
    <div class="card">
        <div class="flex justify-content-between align-items-center mb-4">
            <h2 class="m-0">Payment Management</h2>
            <div class="flex gap-2">
                <app-notification-button></app-notification-button>
                <p-button icon="pi pi-refresh" (onClick)="refreshQrCode()" styleClass="p-button-outlined p-button-secondary" pTooltip="Refresh Payment Info" tooltipPosition="bottom"></p-button>
            </div>
        </div>
        
        <div class="grid">
            <div class="col-12 md:col-6">
                <p-card header="bKash QR Code">
                    <div class="flex flex-column gap-3">
                        <div *ngIf="currentQrCode" class="text-center mb-3">
                            <img [src]="currentQrCode" alt="Current QR" style="max-width: 200px; border: 1px solid #ddd; padding: 10px; border-radius: 8px;">
                            <p class="mt-2 text-gray-600">Current QR Code</p>
                        </div>
                        
                        <p-fileUpload #fileUpload mode="basic" chooseLabel="Browse" accept="image/*"
                            (onSelect)="onFileSelect($event)" [auto]="true" styleClass="p-button-outlined w-full"></p-fileUpload>
                    </div>
                </p-card>
            </div>
        </div>
    </div>
    <p-toast></p-toast>
  `
})
export class PaymentManagementComponent {
  currentQrCode: string | null = null;

  constructor(
    private paymentService: PaymentService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      this.currentQrCode = this.paymentService.qrCodeSignal();
      this.cdr.detectChanges();
    });
  }

  onFileSelect(event: any) {
    const file = event.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64 = e.target.result;
        this.paymentService.saveQrCode(base64);
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'QR Code updated successfully' });
      };
      reader.readAsDataURL(file);
    }
  }

  refreshQrCode() {
    this.paymentService.reloadQrCode();
    this.messageService.add({ severity: 'success', summary: 'Refreshed', detail: 'Payment Info updated' });
  }
}
