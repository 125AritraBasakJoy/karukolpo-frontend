import { Product } from './product.model';

export type ComboKind = 'fixed' | 'mix_and_match';
export type ComboPricingType = 'fixed_price' | 'percentage' | 'cheapest_free';
export type ComboStatus = 'active' | 'scheduled' | 'expired' | 'inactive' | 'unavailable';

export interface ComboItem {
  product: Product;
  quantity?: number;
}

export interface ComboView {
  id: string;
  name: string;
  description?: string | null;
  kind: ComboKind;
  slot_count?: number | null;
  pricing_type: ComboPricingType;
  pricing_value: string | number;
  items: ComboItem[];
  list_total: string | number;
  combo_price: string | number;
  savings: string | number;
  savings_percent?: number | null;
  price_is_from?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface AdminCombo extends ComboView {
  status: ComboStatus;
  status_reason?: string | null;
  is_active?: boolean;
  sets_sold?: number;
  orders?: number;
  discount_given?: string | number;
}

export interface AdminComboItemPayload {
  product_id: string;
  quantity?: number;
}

export interface AdminComboPayload {
  name: string;
  description?: string | null;
  kind: ComboKind;
  slot_count?: number | null;
  pricing_type: ComboPricingType;
  pricing_value: string | number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  items: AdminComboItemPayload[];
}

export interface ComboSuggestion {
  products: Product[];
  orders_together: number;
  list_total: string | number;
}

export interface RelatedPinsResponse {
  product_ids: string[];
  products: (Product & { is_active?: boolean })[];
}

export interface RelatedPinsUpdatePayload {
  product_ids: string[];
}
