export type PaymentStatus =
  | 'unpaid'
  | 'awaiting_verification'
  | 'partially_paid'
  | 'paid'
  | 'refund_due'
  | 'refunded'
  | 'void';

export type PaymentMethod = 'cash' | 'cod' | 'bkash' | 'nagad' | 'bank' | 'other' | string;

export interface Payment {
  id: string; // UUID string
  order_id: string; // UUID string
  status: string; // bKash claim: 'submitted' | 'verified' | 'rejected'
  payment_method: string;
  transaction_id?: string | null;
  amount?: number | string | null;
  verified_at?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  sender_phone?: string | null;
  verified_by?: string | null;
  rejected_by?: string | null;
}

export interface PaymentTransaction {
  id: string;
  kind: 'payment' | 'refund' | string;
  method: string;
  amount: number;
  source: 'bkash_verification' | 'delivery_collection' | 'sale_record' | 'manual' | 'backfill' | string;
  reference?: string | null;
  note?: string | null;
  created_at: string;
  created_by?: string | null;
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string | null;
}

export interface LedgerEntryCreate {
  kind: 'payment' | 'refund';
  method: 'cash' | 'cod' | 'bkash' | 'nagad' | 'bank' | 'other' | string;
  amount: string; // "200.00"
  reference?: string | null;
  note?: string | null;
}

export interface LedgerEntryVoid {
  reason?: string;
}

export interface PaymentVerifyPayload {
  amount?: string;
  confirm?: boolean;
}

export interface PaymentRejectPayload {
  reason?: string;
}

export interface PaymentStatusInfo {
  label: string;
  severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
  rawStatus: PaymentStatus;
}

export function formatPaymentStatus(
  status: string | undefined | null,
  amountDue: number = 0,
  method?: string | null
): PaymentStatusInfo {
  const norm = (status || '').toLowerCase().trim() as PaymentStatus;

  switch (norm) {
    case 'unpaid': {
      const isCod = (method || '').toLowerCase() === 'cod';
      const label = isCod && amountDue > 0 ? `To collect ৳${amountDue.toFixed(0)}` : 'Unpaid';
      return { label, severity: 'warn', rawStatus: 'unpaid' };
    }
    case 'awaiting_verification':
      return { label: 'Verify payment', severity: 'info', rawStatus: 'awaiting_verification' };
    case 'partially_paid': {
      const label = amountDue > 0 ? `Partially paid · ৳${amountDue.toFixed(0)} due` : 'Partially paid';
      return { label, severity: 'warn', rawStatus: 'partially_paid' };
    }
    case 'paid':
      return { label: 'Paid', severity: 'success', rawStatus: 'paid' };
    case 'refund_due': {
      const refundAmt = Math.abs(amountDue);
      const label = refundAmt > 0 ? `Refund ৳${refundAmt.toFixed(0)}` : 'Refund due';
      return { label, severity: 'danger', rawStatus: 'refund_due' };
    }
    case 'refunded':
      return { label: 'Refunded', severity: 'secondary', rawStatus: 'refunded' };
    case 'void':
      return { label: 'Cancelled', severity: 'secondary', rawStatus: 'void' };
    default:
      return { label: status ? status : 'Unpaid', severity: 'warn', rawStatus: 'unpaid' };
  }
}
