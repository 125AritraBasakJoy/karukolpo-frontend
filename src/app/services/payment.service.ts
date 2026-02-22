import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../../core/api-endpoints';
import { Observable } from 'rxjs';
import { Payment } from '../models/payment.model';

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private readonly QR_STORAGE_KEY = 'bkash_qr_code';
    qrCodeSignal = signal<string | null>(null);

    constructor(
        private apiService: ApiService,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.loadQrCode();
    }

    private getStoredQRCode(): string | null {
        if (isPlatformBrowser(this.platformId)) {
            return localStorage.getItem(this.QR_STORAGE_KEY);
        }
        return null;
    }

    private storeQRCode(base64Image: string) {
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.QR_STORAGE_KEY, base64Image);
        }
    }

    private loadQrCode() {
        const stored = this.getStoredQRCode();
        this.qrCodeSignal.set(stored);
    }

    reloadQrCode() {
        this.loadQrCode();
    }

    saveQrCode(base64Image: string) {
        this.storeQRCode(base64Image);
        this.qrCodeSignal.set(base64Image);
    }

    getQrCode(): string | null {
        return this.qrCodeSignal();
    }

    /**
     * Create a payment for an order
     * POST /orders/{orderId}/payments
     */
    createPayment(orderId: number | string, paymentMethod: string): Observable<Payment> {
        const id = orderId;
        const payload = { payment_method: paymentMethod };
        return this.apiService.post<Payment>(API_ENDPOINTS.PAYMENTS.CREATE(id), payload);
    }

    /**
     * Confirm a payment
     * PATCH /orders/{orderId}/payments/{paymentId}/confirm
     */
    confirmPayment(orderId: number | string, paymentId: number | string, transactionId: string): Observable<Payment> {
        const oId = orderId;
        const pId = paymentId;

        const payload = { transaction_id: transactionId.trim() };

        return this.apiService.patch<Payment>(API_ENDPOINTS.PAYMENTS.CONFIRM(oId, pId), payload);
    }

    /**
     * Verify a payment (Admin)
     * PATCH /orders/{order_id}/payment/verify
     */
    verifyPayment(orderId: number | string, payload: any = {}): Observable<Payment> {
        const oId = orderId;
        return this.apiService.patch<Payment>(API_ENDPOINTS.PAYMENTS.VERIFY(oId), payload);
    }
}
