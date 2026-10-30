import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ComboView, ComboItem } from '../../models/combo.model';
import { ComboService } from '../../core/services/combo/combo.service';
import { CartQuoteResponse } from '../../models/quote.model';
import { Subject, of } from 'rxjs';
import { debounceTime, switchMap, catchError, tap } from 'rxjs/operators';

@Component({
  selector: 'app-bundle-picker',
  standalone: true,
  imports: [CommonModule, DialogModule],
  templateUrl: './bundle-picker.component.html',
  styleUrls: ['./bundle-picker.component.scss']
})
export class BundlePickerComponent implements OnChanges {
  @Input() combo: ComboView | null = null;
  @Input() initialPicks: string[] = [];
  @Input() visible = false;
  @Input() actionLabel = 'Add Bundle to Cart';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() picksConfirmed = new EventEmitter<{ combo: ComboView; picks: string[] }>();

  slots: (ComboItem | null)[] = [];
  activeSlotIndex = 0;

  quote: CartQuoteResponse | null = null;
  quoteLoading = false;
  quoteProblem: string | null = null;

  private quoteSubject = new Subject<string[]>();

  constructor(private comboService: ComboService) {
    this.quoteSubject.pipe(
      debounceTime(250),
      switchMap(picks => {
        if (!this.combo || picks.length !== (this.combo.slot_count || 0)) {
          this.quote = null;
          this.quoteProblem = null;
          this.quoteLoading = false;
          return of(null);
        }

        this.quoteLoading = true;
        this.quoteProblem = null;

        return this.comboService.quoteCart({
          items: [],
          combos: [{ combo_id: this.combo.id, quantity: 1, picks }]
        }).pipe(
          tap({
            next: (res) => {
              this.quote = res;
              this.quoteLoading = false;
              if (res.problems && res.problems.length > 0) {
                this.quoteProblem = res.problems.join(', ');
              } else {
                this.quoteProblem = null;
              }
            },
            error: (err) => {
              this.quoteLoading = false;
              this.quoteProblem = err?.error?.detail || err?.message || 'Pricing error';
            }
          }),
          catchError(() => of(null))
        );
      })
    ).subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initSlots();
    }
  }

  initSlots() {
    if (!this.combo) return;
    const count = this.combo.slot_count || 4;
    this.slots = new Array(count).fill(null);

    if (this.initialPicks && this.initialPicks.length) {
      for (let i = 0; i < Math.min(count, this.initialPicks.length); i++) {
        const prodId = this.initialPicks[i];
        const item = this.combo.items.find(it => it.product.id === prodId);
        if (item) {
          this.slots[i] = item;
        }
      }
    }

    this.activeSlotIndex = this.slots.findIndex(s => s === null);
    if (this.activeSlotIndex === -1) {
      this.activeSlotIndex = 0;
    }
    this.triggerQuoteIfFull();
  }

  get pickedCount(): number {
    return this.slots.filter(s => s !== null).length;
  }

  get totalSlots(): number {
    return this.combo?.slot_count || this.slots.length;
  }

  get isAllSlotsFilled(): boolean {
    return this.slots.length > 0 && this.slots.every(s => s !== null);
  }

  get currentPicks(): string[] {
    return this.slots.filter((s): s is ComboItem => s !== null).map(s => s.product.id);
  }

  get displayPrice(): number {
    if (this.isAllSlotsFilled && this.quote) {
      const summary = this.quote.combos.find(c => c.combo_id === this.combo?.id);
      if (summary) {
        return typeof summary.combo_price === 'string'
          ? parseFloat(summary.combo_price)
          : Number(summary.combo_price);
      }
      return typeof this.quote.total === 'string' ? parseFloat(this.quote.total) : Number(this.quote.total);
    }
    return typeof this.combo?.combo_price === 'string'
      ? parseFloat(this.combo.combo_price)
      : Number(this.combo?.combo_price || 0);
  }

  get displaySavings(): number {
    if (this.isAllSlotsFilled && this.quote) {
      const summary = this.quote.combos.find(c => c.combo_id === this.combo?.id);
      if (summary) {
        return typeof summary.savings === 'string'
          ? parseFloat(summary.savings)
          : Number(summary.savings);
      }
    }
    return typeof this.combo?.savings === 'string'
      ? parseFloat(this.combo.savings)
      : Number(this.combo?.savings || 0);
  }

  selectSlot(index: number) {
    this.activeSlotIndex = index;
  }

  clearSlot(event: Event, index: number) {
    event.stopPropagation();
    this.slots[index] = null;
    this.activeSlotIndex = index;
    this.quote = null;
    this.quoteProblem = null;
    this.triggerQuoteIfFull();
  }

  pickProduct(item: ComboItem) {
    if (!item.product.isInStock) return;

    let targetIndex = this.activeSlotIndex;
    if (targetIndex < 0 || targetIndex >= this.slots.length || this.slots[targetIndex] !== null) {
      const nextEmpty = this.slots.findIndex(s => s === null);
      if (nextEmpty !== -1) {
        targetIndex = nextEmpty;
      }
    }

    this.slots[targetIndex] = item;
    const nextEmpty = this.slots.findIndex(s => s === null);
    this.activeSlotIndex = nextEmpty !== -1 ? nextEmpty : targetIndex;

    this.triggerQuoteIfFull();
  }

  private triggerQuoteIfFull() {
    if (this.isAllSlotsFilled) {
      this.quoteSubject.next(this.currentPicks);
    } else {
      this.quote = null;
      this.quoteProblem = null;
    }
  }

  confirm() {
    if (!this.isAllSlotsFilled || !this.combo || this.quoteProblem) return;
    this.picksConfirmed.emit({
      combo: this.combo,
      picks: this.currentPicks
    });
    this.close();
  }

  close() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
