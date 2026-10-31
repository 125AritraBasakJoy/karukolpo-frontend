import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() compact = false;
  @Input() queryParams?: Record<string, any>;

  @Output() addToCart = new EventEmitter<Product>();
  @Output() cardClick = new EventEmitter<Product>();

  constructor(private router: Router) {}

  get isOutOfStock(): boolean {
    return !this.product.isInStock;
  }

  get hasDiscount(): boolean {
    return !!(
      this.product.effective_price &&
      this.product.effective_price < this.product.price
    );
  }

  get discountBadgeText(): string {
    if (!this.hasDiscount) return '';
    if (this.product.discount_type === 'percentage') {
      const pct = this.product.discount_percent || this.product.discount_value;
      return `${pct}% OFF`;
    }
    const saving = this.product.savings || this.product.discount_value || (this.product.price - (this.product.effective_price || 0));
    return `৳${Math.round(saving)} OFF`;
  }

  onCardClick() {
    if (this.cardClick.observed) {
      this.cardClick.emit(this.product);
    } else {
      const target = this.product.slug || this.product.id;
      this.router.navigate(['/products', target], { queryParams: this.queryParams });
    }
  }

  onQuickAdd(event: Event) {
    event.stopPropagation();
    if (!this.isOutOfStock) {
      this.addToCart.emit(this.product);
    }
  }
}
