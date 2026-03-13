import { CartItem } from './cart.model';

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
  paymentStatus?: 'Pending' | 'Paid' | string;
  paymentId?: number;
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
    additional_info: string;
  };
  payments?: {
    id: string;
    order_id: string;
    status: string;
    payment_method: string;
    transaction_id: string;
  };
  created_at?: string;
}
