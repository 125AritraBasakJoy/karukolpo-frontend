import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ComboService } from '../../core/services/combo/combo.service';
import { CartService } from '../../core/services/cart/cart.service';
import { ComboView } from '../../models/combo.model';
import { ComboCardComponent } from '../../components/combo-card/combo-card.component';
import { BundlePickerComponent } from '../../components/bundle-picker/bundle-picker.component';

@Component({
  selector: 'app-combos-listing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SkeletonModule,
    ToastModule,
    ComboCardComponent,
    BundlePickerComponent
  ],
  providers: [MessageService],
  templateUrl: './combos.component.html',
  styleUrls: ['./combos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombosListingComponent implements OnInit {
  combos = signal<ComboView[]>([]);
  loading = signal<boolean>(true);
  selectedMixCombo = signal<ComboView | null>(null);
  mixPickerVisible = signal<boolean>(false);

  constructor(
    private comboService: ComboService,
    private cartService: CartService,
    private titleService: Title,
    private metaService: Meta
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Combo Offers & Bundles | Karukolpo');
    this.metaService.updateTag({
      name: 'description',
      content: 'Shop authentic handcrafted combos, curated gift sets, and value bundles at discounted prices.'
    });
    this.loadCombos();
  }

  loadCombos() {
    this.loading.set(true);
    this.comboService.getCombos(20).subscribe({
      next: (list) => {
        this.combos.set(list || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onAddCombo(event: { combo: ComboView; picks?: string[] }) {
    this.cartService.addComboToCart(event.combo, 1, event.picks);
  }

  onConfigureCombo(combo: ComboView) {
    this.selectedMixCombo.set(combo);
    this.mixPickerVisible.set(true);
  }

  onPicksConfirmed(event: { combo: ComboView; picks: string[] }) {
    this.cartService.addComboToCart(event.combo, 1, event.picks);
  }
}
