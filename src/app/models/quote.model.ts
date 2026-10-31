import { ComboKind } from './combo.model';

export interface CartQuoteRequestItem {
  product_id: string;
  quantity: number;
}

export interface CartQuoteRequestCombo {
  combo_id: string;
  quantity: number;
  picks?: string[];
}

export interface CartQuoteRequest {
  items: CartQuoteRequestItem[];
  combos: CartQuoteRequestCombo[];
  coupon_code?: string | null;
  district?: string | null;
  phone?: string | null;
}

export interface CartQuoteLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: string | number;
  unit_discount: string | number;
  unit_final: string | number;
  line_total: string | number;
  combo_id?: string | null;
}

export interface CartQuoteComboSummary {
  combo_id: string;
  name: string;
  kind?: ComboKind;
  picks?: string[] | null;
  quantity: number;
  list_total: string | number;
  combo_price: string | number;
  savings: string | number;
}

export interface CartQuoteCoupon {
  code: string;
  applied: boolean;
  message?: string;
  discount?: string | number;
  free_delivery?: boolean;
}

export interface CartQuoteResponse {
  lines: CartQuoteLine[];
  combos: CartQuoteComboSummary[];
  subtotal: string | number;
  product_discount: string | number;
  combo_discount: string | number;
  coupon?: CartQuoteCoupon | null;
  delivery_charge: string | number;
  delivery_discount: string | number;
  total: string | number;
  problems: string[];
}
