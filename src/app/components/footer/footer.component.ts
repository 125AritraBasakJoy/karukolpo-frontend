import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-footer',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage, RouterModule],
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
    currentYear = new Date().getFullYear();

    socialLinks = [
        { icon: 'pi pi-facebook', url: 'https://www.facebook.com/karukalpo', label: 'Facebook' },
        { icon: 'pi pi-instagram', url: 'https://www.instagram.com/karukolpo.crafts/', label: 'Instagram' },
        { icon: 'pi pi-whatsapp', url: 'https://wa.me/8801675718846', label: 'WhatsApp' }
    ];

    quickLinks = [
        { label: 'Home', route: '/' },
        { label: 'Shop Now', route: '/all-products' },
        { label: 'About Us', route: '/about' },
        { label: 'Track Order', route: '/track-order' }
    ];

    contactInfo = {
        email: 'contact@karukolpocrafts.com',
        phone: '01675-718846',
        address: 'Pathrail, Tangail-1912, Bangladesh.'
    };

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

    navigateAndScroll(route: string) {
        if (!isPlatformBrowser(this.platformId)) return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
}
