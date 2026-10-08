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
      title: 'Terracotta Prodip',
      subtitle: 'Earth & Ritual Flame',
      image: 'assets/about/about-1.webp',
      alt: 'Handcrafted traditional terracotta clay prodip lamp',
      description: 'Wheel-thrown and sculpted from natural riverbed soil, each prodip is kiln-fired to a rich earthen tone, bringing authentic ritual warmth and ambient light to festive spaces.'
    },
    {
      title: 'Clay Protima Sculpture',
      subtitle: 'Sacred Soil Art',
      image: 'assets/about/about-2.webp',
      alt: 'Handcrafted Durga and deity clay protima sculpture',
      description: 'Hand-molded by hereditary Kumar sculptors using pure river clay and natural straw armatures, preserving centuries of sacred devotion and sculptural folk heritage.'
    },
    {
      title: 'Hand-Painted Folk Shora',
      subtitle: 'Devotional Earthen Canvas',
      image: 'assets/about/about-3.webp',
      alt: 'Traditional Bengali hand-painted terracotta folk shora',
      description: 'Curved earthen discs crafted from baked soil and painted with living folk deities, Lakshmi motifs, and floral patterns celebrating traditional Bengali household rites.'
    }
  ];

  values = [
    {
      icon: 'pi pi-compass',
      title: '100% Pure Natural Soil',
      description: 'Honoring alluvial river soil and organic earth without synthetic substitutes or harmful chemical binders.'
    },
    {
      icon: 'pi pi-heart',
      title: 'Dignity for Kumar Artisans',
      description: 'Partnering directly with hereditary potter families and Kumar artisans to sustain generational livelihoods.'
    },
    {
      icon: 'pi pi-sun',
      title: 'Time-Honored Kiln Firing',
      description: 'Preserving traditional slow wood-and-mud kiln baking that gives authentic terracotta its signature earthy texture.'
    }
  ];

  scrollToStory() {
    const el = document.getElementById('story');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
