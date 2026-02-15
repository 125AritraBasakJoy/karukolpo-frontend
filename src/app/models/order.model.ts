import { CartItem } from './cart.model';

export interface Order {
  id?: string;
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
    id: number;
    full_name: string;
    phone: string;
    district: string;
    subdistrict: string;
    address_line: string;
    additional_info: string;
  };
  payments?: {
    id: number;
    order_id: number;
    status: string;
    payment_method: string;
    transaction_id: string;
  };
  created_at?: string;
}
