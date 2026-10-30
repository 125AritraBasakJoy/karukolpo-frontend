import { Product } from './product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  product_id?: string;
  name?: string;
  unit_price?: number;
  price_at_purchase?: number;
  unit_discount?: number;
  price?: number;
}
