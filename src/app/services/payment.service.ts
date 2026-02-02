import { Injectable, signal } from '@angular/core';
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

    constructor(private apiService: ApiService) {
        this.loadQrCode();
    }

    private loadQrCode() {
        const stored = localStorage.getItem(this.QR_STORAGE_KEY);
        this.qrCodeSignal.set(stored);
    }

    reloadQrCode() {
        this.loadQrCode();
    }

    saveQrCode(base64Image: string) {
        localStorage.setItem(this.QR_STORAGE_KEY, base64Image);
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
        const id = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
        const payload = { payment_method: paymentMethod };
        console.log('Creating payment:', payload);
        return this.apiService.post<Payment>(API_ENDPOINTS.PAYMENTS.CREATE(id), payload);
    }

    /**
     * Confirm a payment
     * PATCH /orders/{orderId}/payments/{paymentId}/confirm
     */
    confirmPayment(orderId: number | string, paymentId: number | string, transactionId: string): Observable<Payment> {
        const oId = typeof orderId === 'string' ? parseInt(orderId, 10) : orderId;
        const pId = typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
        
        const payload = { transaction_id: transactionId.trim() };
        console.log('Confirming payment:', payload);
        
        return this.apiService.patch<Payment>(API_ENDPOINTS.PAYMENTS.CONFIRM(oId, pId), payload);
    }
}
