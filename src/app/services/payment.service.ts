import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private readonly QR_STORAGE_KEY = 'bkash_qr_code';
    qrCodeSignal = signal<string | null>(null);

    constructor() {
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
}
