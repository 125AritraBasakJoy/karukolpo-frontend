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
  status: 'Pending' | 'Confirmed' | 'Shipping' | 'Delivered' | 'Cancelled';
  paymentMethod?: 'COD' | 'bKash' | string | null; // Allow null
  paymentStatus?: 'Pending' | 'Paid' | string;
  paymentId?: number;
  transactionId?: string;
  bkashNumber?: string;
  deliveryLocation?: string;
  deliveryCharge?: number;
  additionalInfo?: string;
  orderDate: Date;
}
