import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface DeliveryCharges {
    insideDhaka: number;
    outsideDhaka: number;
}

@Injectable({
    providedIn: 'root'
})
export class DeliveryService {
    private readonly STORAGE_KEY = 'delivery_charges';

    // Default charges
    charges = signal<DeliveryCharges>({
        insideDhaka: 60,
        outsideDhaka: 120
    });

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.loadCharges();
    }

    private loadCharges() {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                try {
                    this.charges.set(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse delivery charges', e);
                }
            }
        }
    }

    saveCharges(newCharges: DeliveryCharges) {
        this.charges.set(newCharges);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newCharges));
        }
    }

    getCharges() {
        return this.charges();
    }
}
