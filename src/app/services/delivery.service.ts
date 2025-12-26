import { Injectable, signal } from '@angular/core';

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

    constructor() {
        this.loadCharges();
    }

    private loadCharges() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.charges.set(JSON.parse(saved));
        }
    }

    updateCharges(inside: number, outside: number) {
        const newCharges = { insideDhaka: inside, outsideDhaka: outside };
        this.charges.set(newCharges);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newCharges));
    }

    getCharges() {
        return this.charges();
    }
}
