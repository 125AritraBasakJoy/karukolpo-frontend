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
        { icon: 'pi pi-facebook', url: 'https://facebook.com', label: 'Facebook' },
        { icon: 'pi pi-instagram', url: 'https://instagram.com', label: 'Instagram' },
        { icon: 'pi pi-twitter', url: 'https://twitter.com', label: 'Twitter' },
        { icon: 'pi pi-youtube', url: 'https://youtube.com', label: 'YouTube' }
    ];

    quickLinks = [
        { label: 'Home', route: '/' },
        { label: 'About Us', route: '/about' },
        { label: 'Track Order', route: '/track-order' }
    ];

    contactInfo = {
        email: 'info@karukolpo.com',
        phone: '+880 1XXX-XXXXXX',
        address: 'Dhaka, Bangladesh'
    };

    navigateAndScroll(route: string) {
        // Scroll to top of the page when footer link is clicked
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
