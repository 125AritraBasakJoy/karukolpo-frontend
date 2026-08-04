import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
        address: 'Pathrail, Tangail-1912, Bangladesh.',
        phone: '+880 1234 567890',
        email: 'contact@karukolpo.com'
    });

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private http: HttpClient
    ) {
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

    submitContactForm(data: { name: string, contact: string, message: string }): Observable<any> {
        // Replace this URL with your actual Google Apps Script Web App URL
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbyUerPmcrk3OakXnPKrJPMXQZnBU8P3gdHO4tvG5sOjxTMRExSRORux536rPPoY2WRUIQ/exec';
        
        // We must send it as text/plain and stringify the JSON to avoid CORS preflight (OPTIONS) errors with Google Apps Script
        return this.http.post(scriptUrl, JSON.stringify(data), {
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
    }
}
