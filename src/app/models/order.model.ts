import { CartItem } from './cart.model';
import { Payment, PaymentStatus, PaymentTransaction } from './payment.model';

export interface OrderRevision {
  id: string;
  admin_id?: string | null;
  created_at: string;
  reason?: string | null;
  changes: {
    before?: any;
    after?: any;
    [key: string]: any;
  };
}

export interface OrderEditItem {
  product_id: string;
  quantity: number;
}

export interface OrderAddressUpdate {
  full_name?: string;
  phone?: string;
  email?: string;
  district?: string;
  subdistrict?: string;
  address_line?: string;
  additional_info?: string | null;
}

export interface OrderAdminUpdate {
  items?: OrderEditItem[];
  address?: OrderAddressUpdate;
  reason?: string;
}

export interface OrderEditResult {
  order: any;
  coupon_removed: boolean;
  coupon_removed_reason?: string | null;
  dry_run: boolean;
}

export interface OrderCompletePayload {
  collected_via?: string;
}

export interface Order {
  id?: string;
  orderNumber?: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  district: string;
  subDistrict?: string;
  postalCode: string;
  fullAddress: string;
  items: CartItem[];
  totalAmount: number;
  status: 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Completed' | 'Cancelled';
  paymentMethod?: 'COD' | 'bKash' | string | null; // Allow null
  paymentStatus?: PaymentStatus | string;
  payment_status?: PaymentStatus;
  amount_paid?: number;
  amount_refunded?: number;
  amount_due?: number;
  paymentId?: string;
  transactionId?: string;
  bkashNumber?: string;
  deliveryLocation?: string;
  deliveryCharge?: number;
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  additionalInfo?: string;
  orderDate: Date;

  // New fields to match backend response structure
  address?: {
    id: string;
    full_name: string;
    phone: string;
    district: string;
    subdistrict: string;
    address_line: string;
    additional_info?: string | null;
    email?: string | null;
    postal_code?: string | null;
    address?: string | null;
  };
  payments?: Payment | null;
  payment_transactions?: PaymentTransaction[];
  revisions?: OrderRevision[];
  edited_at?: string | null;
  edited_by?: string | null;
  created_at?: string;
  channel?: 'online' | 'offline' | string;
  note?: string;
  source?: string | null;
  fulfillment?: 'handover' | 'delivery' | 'unreviewed';
  rawStatus?: string;
  isVoided?: boolean;
  completedAt?: string | null;
}
