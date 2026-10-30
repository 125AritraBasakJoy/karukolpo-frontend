import { Product } from './product.model';
import { ComboView } from './combo.model';

export interface CartItem {
  product: Product;
  quantity: number;
  product_id?: string;
  name?: string;
  unit_price?: number;
  price_at_purchase?: number;
  unit_discount?: number;
  price?: number;
  order_combo_id?: string | null;
  combo_discount_per_unit?: string | number;
}

export interface CartCombo {
  combo: ComboView;
  quantity: number;
  picks?: string[];
}

