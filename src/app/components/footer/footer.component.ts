import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-footer',
    imports: [CommonModule, RouterModule],
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
        { label: 'About Us', route: '/about' },
        { label: 'Track Order', route: '/track-order' }
    ];

    contactInfo = {
        email: 'contact@karukolpocrafts.com',
        phone: '01675-718846',
        address: 'Dhaka, Bangladesh'
    };

    navigateAndScroll(route: string) {
        // Scroll to top of the page when footer link is clicked
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
