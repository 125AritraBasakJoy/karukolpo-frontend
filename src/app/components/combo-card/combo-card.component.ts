import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ComboView } from '../../models/combo.model';

@Component({
  selector: 'app-combo-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './combo-card.component.html',
  styleUrls: ['./combo-card.component.scss']
})
export class ComboCardComponent {
  @Input({ required: true }) combo!: ComboView;
  @Input() compact = false;

  @Output() addCombo = new EventEmitter<{ combo: ComboView; picks?: string[] }>();
  @Output() configure = new EventEmitter<ComboView>();

  get isMultipack(): boolean {
    return this.combo.kind === 'fixed' &&
      this.combo.items.length === 1 &&
      (this.combo.items[0]?.quantity || 0) > 1;
  }

  get isMixAndMatch(): boolean {
    return this.combo.kind === 'mix_and_match';
  }

  get multipackItem() {
    return this.combo.items[0];
  }

  get multipackPerUnitPrice(): number {
    const qty = this.multipackItem?.quantity || 1;
    const price = typeof this.combo.combo_price === 'string'
      ? parseFloat(this.combo.combo_price)
      : Number(this.combo.combo_price || 0);
    return Math.round((price / qty) * 100) / 100;
  }

  get kickerText(): string {
    if (this.combo.pricing_type === 'cheapest_free') {
      const free = Number(this.combo.pricing_value || 1);
      const slots = this.combo.slot_count || this.combo.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      return `BUY ${slots - free} GET ${free} FREE`;
    }
    if (this.isMultipack) {
      return 'VALUE MULTIPACK';
    }
    if (this.isMixAndMatch) {
      return `PICK ANY ${this.combo.slot_count || ''}`;
    }
    return 'SAVE MORE TOGETHER';
  }

  get endsRelativeText(): string | null {
    if (!this.combo.ends_at) return null;
    const end = new Date(this.combo.ends_at).getTime();
    const now = Date.now();
    const diffMs = end - now;
    if (diffMs <= 0) return null;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      return diffDays === 1 ? 'Ends today' : `Ends in ${diffDays} days`;
    }
    return null;
  }

  get hasSavings(): boolean {
    const s = Number(this.combo.savings);
    return !isNaN(s) && s > 0;
  }

  onActionClick(event: Event) {
    event.stopPropagation();
    if (this.isMixAndMatch) {
      this.configure.emit(this.combo);
    } else {
      this.addCombo.emit({ combo: this.combo });
    }
  }
}
