import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
    selector: 'app-about',
    imports: [CommonModule, RouterModule, CardModule, ButtonModule, ThemeToggleComponent],
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss']
})
export class AboutComponent {
    features = [
        {
            icon: 'pi pi-check-circle',
            title: 'Authentic Products',
            description: 'All our products are handcrafted by skilled artisans from Bangladesh, ensuring authenticity and quality.'
        },
        {
            icon: 'pi pi-users',
            title: 'Support Local Artisans',
            description: 'Every purchase directly supports local craftspeople and helps preserve traditional Bangladeshi art forms.'
        },
        {
            icon: 'pi pi-shield',
            title: 'Quality Guarantee',
            description: 'We carefully inspect each item to ensure it meets our high standards before shipping to you.'
        },
        {
            icon: 'pi pi-truck',
            title: 'Fast Delivery',
            description: 'Quick and reliable delivery across Bangladesh with tracking available for all orders.'
        }
    ];

    team = [
        {
            name: 'Aritra Basak',
            role: 'Founder & CEO',
            image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231e293b"/><circle cx="150" cy="120" r="50" fill="%23475569"/><path d="M70,240 C70,180 230,180 230,240" fill="%23475569"/></svg>',
            description: 'Passionate about preserving Bangladeshi heritage through handcrafts.'
        }
    ];
}
