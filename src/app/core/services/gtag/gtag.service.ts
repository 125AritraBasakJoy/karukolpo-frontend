import { Injectable } from '@angular/core';
import { CartItem } from '../../../models/cart.model';

declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
        dataLayer?: any[];
    }
}

/**
 * Thin typed wrapper around Google's gtag.js global.
 *
 * The page_view (SPA) tracking is handled by GA4 Enhanced Measurement's
 * "Page changes based on browser history events" — do NOT send manual
 * `page_view` events or they will be duplicated.
 *
 * Only non-PII data is ever sent (product ids/names/prices/quantities and
 * the order id). Never pass customer names, emails, phones or addresses.
 */
@Injectable({ providedIn: 'root' })
export class GtagService {
    trackEvent(name: string, params?: Record<string, any>): void {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', name, params || {});
        }
    }

    /** GA4 `purchase` event with the order id as `transaction_id`. */
    trackPurchase(transactionId: string, value: number, items: CartItem[]): void {
        this.trackEvent('purchase', {
            transaction_id: transactionId,
            value,
            currency: 'BDT',
            items: items.map(item => ({
                item_id: item.product.id || item.product.code,
                item_name: item.product.name,
                price: item.product.effective_price ?? item.product.price,
                quantity: item.quantity
            }))
        });
    }
}
