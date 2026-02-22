import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ContactInfo {
    address: string;
    phone: string;
    email: string;
}

@Injectable({
    providedIn: 'root'
})
export class ContactService {
    private readonly STORAGE_KEY = 'contactConfig';

    contactInfo = signal<ContactInfo>({
        address: '123 Handicraft Lane, Dhaka, Bangladesh',
        phone: '+880 1234 567890',
        email: 'contact@karukolpo.com'
    });

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        this.loadContactInfo();
    }

    private loadContactInfo() {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    this.contactInfo.set({ ...this.contactInfo(), ...parsed });
                } catch (e) {
                    console.error('Failed to parse contact info', e);
                }
            }
        }
    }

    updateContactInfo(info: ContactInfo) {
        this.contactInfo.set(info);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(info));
        }
    }
}
