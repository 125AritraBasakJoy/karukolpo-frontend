import { Component } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, RouterModule, ThemeToggleComponent],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  craftDisciplines = [
    {
      title: 'Protima & Clay Sculpture',
      subtitle: 'Sacred Clay Art',
      image: 'assets/categories/protima.webp',
      alt: 'Handcrafted Durga protima clay sculpture with traditional ornaments',
      description: 'Sculpted from riverbed clay, straw, and mineral colors by Bengal’s traditional Kumar artisans, each protima embodies centuries of sacred sculptural mastery.'
    },
    {
      title: 'Hand-Painted Folk Shora',
      subtitle: 'Living Folk Painting',
      image: 'assets/categories/shora.webp',
      alt: 'Traditional Bengali hand-painted terracotta Lakshmi shora',
      description: 'Earthen convex discs painted with sacred deities, floral borders, and folk motifs, preserving the devotional art traditions celebrated in Bengali households.'
    },
    {
      title: 'Terracotta Prodip & Earthenware',
      subtitle: 'Earth & Fire Craft',
      image: 'assets/categories/prodip.webp',
      alt: 'Handcrafted terracotta clay prodip oil lamp',
      description: 'Wheel-thrown from natural river clay and kiln-fired to a warm terracotta glow, bringing traditional warmth and ritual light into modern homes.'
    }
  ];

  values = [
    {
      icon: 'pi pi-compass',
      title: 'Cultural Preservation',
      description: 'Safeguarding Bengal’s sacred clay sculpture, terracotta artistry, and folk painting traditions for generations to come.'
    },
    {
      icon: 'pi pi-heart',
      title: 'Artisan Dignity & Respect',
      description: 'Honoring the generational Kumar sculptors and folk artists whose deep dedication and inherited knowledge breathe life into clay.'
    },
    {
      icon: 'pi pi-sparkles',
      title: 'Natural Earthen Materials',
      description: 'Celebrating authentic riverbed clay, organic binders, and natural earthenware crafted without harmful synthetic compromises.'
    }
  ];

  scrollToStory() {
    const el = document.getElementById('story');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
