import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
    selector: 'app-about',
    standalone: true,
    imports: [CommonModule, NgOptimizedImage, RouterModule, CardModule, ButtonModule, ThemeToggleComponent],
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss']
})
export class AboutComponent {
    stats = [
        { label: 'Artisan Partners', value: '100+', icon: 'pi pi-users' },
        { label: 'Handcrafted Products', value: '500+', icon: 'pi pi-box' },
        { label: 'Happy Customers', value: '10,000+', icon: 'pi pi-heart' },
        { label: 'Craft Categories', value: '25+', icon: 'pi pi-tags' }
    ];

    features = [
        {
            icon: 'pi pi-check-circle',
            title: '100% Authentic Handcrafts',
            description: 'Every piece is crafted by verified traditional artisans from Bangladesh, ensuring genuine heritage quality.'
        },
        {
            icon: 'pi pi-heart',
            title: 'Empowering Communities',
            description: 'Your purchases directly sustain the livelihoods of local craft families and preserve ancient art traditions.'
        },
        {
            icon: 'pi pi-shield',
            title: 'Quality Guaranteed',
            description: 'Rigorous multi-point quality inspections ensure that every item meets our high standards of excellence.'
        },
        {
            icon: 'pi pi-truck',
            title: 'Reliable Nationwide Shipping',
            description: 'Fast, secure packaging and real-time order tracking to your doorstep across Bangladesh.'
        }
    ];

    values = [
        {
            icon: 'pi pi-sparkles',
            title: 'Cultural Heritage',
            description: 'Preserving centurie-old Bangladeshi crafting techniques and keeping traditional art alive for future generations.'
        },
        {
            icon: 'pi pi-star',
            title: 'Uncompromised Quality',
            description: 'Hand-selecting raw materials and honoring meticulous attention to detail in every finished craft.'
        },
        {
            icon: 'pi pi-globe',
            title: 'Sustainable Impact',
            description: 'Promoting eco-friendly, natural materials and ethical fair-trade practices with local artisan communities.'
        }
    ];

    scrollToStory() {
        const el = document.getElementById('story');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }
}
