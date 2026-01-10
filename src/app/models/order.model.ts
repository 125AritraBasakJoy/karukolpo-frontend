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
  paymentMethod?: 'COD' | 'bKash';
  paymentStatus?: 'Pending' | 'Paid';
  bkashNumber?: string;
  deliveryLocation?: string;
  deliveryCharge?: number;
  orderDate: Date;
}
