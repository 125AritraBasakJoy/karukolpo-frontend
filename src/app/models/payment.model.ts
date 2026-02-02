export interface Payment {
    id: number;
    order_id: number;
    status: string;
    payment_method: string;
    transaction_id?: string;
}
