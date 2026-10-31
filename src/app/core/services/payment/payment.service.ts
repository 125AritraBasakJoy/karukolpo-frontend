import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiService } from '../api/api.service';
import { PAYMENTS_API } from './payment.api';
import { Observable } from 'rxjs';
import {
  Payment,
  PaymentVerifyPayload,
  PaymentRejectPayload,
  LedgerEntryCreate,
  LedgerEntryVoid
} from '../../../models/payment.model';

const API_ENDPOINTS = {
    PAYMENTS: PAYMENTS_API
} as const;

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
     * Verify a bKash TrxID (Admin)
     * PATCH /orders/{order_id}/payment/verify
     * Body: { amount?: "570.00", confirm?: true }
     */
    verifyPayment(orderId: number | string, payload: PaymentVerifyPayload = {}): Observable<Payment> {
        return this.apiService.patch<Payment>(API_ENDPOINTS.PAYMENTS.VERIFY(orderId), payload);
    }

    /**
     * Reject a bKash TrxID (Admin)
     * PATCH /orders/{order_id}/payment/reject
     * Body: { reason?: string }
     */
    rejectPayment(orderId: number | string, payload: PaymentRejectPayload = {}): Observable<Payment> {
        return this.apiService.patch<Payment>(API_ENDPOINTS.PAYMENTS.REJECT(orderId), payload);
    }

    /**
     * Record a payment or refund by hand (Admin)
     * POST /admin/orders/{order_id}/payments
     * Body: LedgerEntryCreate
     */
    recordManualPayment(orderId: number | string, payload: LedgerEntryCreate): Observable<any> {
        return this.apiService.post<any>(API_ENDPOINTS.PAYMENTS.RECORD_MANUAL(orderId), payload);
    }

    /**
     * Void a manual or delivery ledger entry (Admin)
     * DELETE /admin/orders/{order_id}/payments/{entry_id}
     * Body: { reason?: string }
     */
    voidPaymentEntry(orderId: number | string, entryId: string, reason?: string): Observable<any> {
        const body: LedgerEntryVoid = reason ? { reason } : {};
        return this.apiService.delete<any>(API_ENDPOINTS.PAYMENTS.VOID_ENTRY(orderId, entryId), { body });
    }
}
