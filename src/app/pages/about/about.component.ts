import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
    selector: 'app-about',
    standalone: true,
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
            image: 'assets/team/placeholder.jpg',
            description: 'Passionate about preserving Bangladeshi heritage through handcrafts.'
        }
    ];
}
