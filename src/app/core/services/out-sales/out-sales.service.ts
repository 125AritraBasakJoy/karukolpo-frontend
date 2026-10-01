import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { OUT_SALES_API } from './out-sales.api';
import { OrderService } from '../order/order.service';
import { Order } from '../../../models/order.model';

export interface OfflineSaleItem {
    product_id: string;
    quantity: number;
    unit_price: number;
    unit_cost?: number | null;
}

export interface OfflineSaleCustomer {
    name?: string | null;
    phone?: string | null;
    district?: string | null;
    subdistrict?: string | null;
    address_line?: string | null;
}

export interface OfflineSaleCreate {
    items: OfflineSaleItem[];
    fulfillment?: 'handover' | 'delivery';
    payment_method?: 'cod' | 'cash' | 'bkash' | 'nagad' | 'bank' | 'other' | string;
    sold_at?: string | null;
    delivery_charge?: number | null;
    customer?: OfflineSaleCustomer | null;
    note?: string | null;
    source?: string | null;
}

export interface OfflineSaleUpdate {
    items?: OfflineSaleItem[];
    payment_method?: 'cod' | 'cash' | 'bkash' | 'nagad' | 'bank' | 'other' | string;
    sold_at?: string | null;
    delivery_charge?: number | null;
    customer?: OfflineSaleCustomer | null;
    note?: string | null;
    source?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class OutSalesService {
    constructor(
        private apiService: ApiService,
        private orderService: OrderService
    ) { }

    /**
     * List offline sales, newest first, paginated.
     * Optional status and fulfillment query filters.
     * GET /admin/sales?skip&limit[&status=...][&fulfillment=...]
     */
    listSales(skip = 0, limit = 100, status?: string, fulfillment?: string): Observable<Order[]> {
        let url = `${OUT_SALES_API.LIST}?skip=${skip}&limit=${limit}`;
        if (status) {
            url += `&status=${encodeURIComponent(status)}`;
        }
        if (fulfillment) {
            url += `&fulfillment=${encodeURIComponent(fulfillment)}`;
        }
        return this.apiService.get<any[]>(url).pipe(
            map(sales => sales.map(sale => this.orderService.mapBackendOrder(sale)))
        );
    }

    /**
     * Record an offline sale.
     * POST /admin/sales
     */
    createSale(payload: OfflineSaleCreate): Observable<Order> {
        return this.apiService.post<any>(OUT_SALES_API.CREATE, payload).pipe(
            map(sale => this.orderService.mapBackendOrder(sale))
        );
    }

    /**
     * Correct a recorded offline sale in place.
     * PATCH /admin/sales/{sale_id}
     */
    updateSale(saleId: string, payload: OfflineSaleUpdate): Observable<Order> {
        return this.apiService.patch<any>(OUT_SALES_API.UPDATE(saleId), payload).pipe(
            map(sale => this.orderService.mapBackendOrder(sale))
        );
    }

    /**
     * Classify or re-classify the fulfillment of a sale.
     * POST /admin/sales/{sale_id}/fulfillment
     */
    setFulfillment(saleId: string, body: {
        fulfillment: 'handover' | 'delivery';
        delivered?: boolean;
        delivered_at?: string | null;
        payment_method?: string;
    }): Observable<Order> {
        return this.apiService.post<any>(OUT_SALES_API.FULFILLMENT(saleId), body).pipe(
            map(sale => this.orderService.mapBackendOrder(sale))
        );
    }

    /**
     * Void a mis-entered offline sale (restocks units, marks order cancelled).
     * DELETE /admin/sales/{sale_id}
     */
    voidSale(saleId: string): Observable<Order> {
        return this.apiService.delete<any>(OUT_SALES_API.VOID(saleId)).pipe(
            map(sale => this.orderService.mapBackendOrder(sale))
        );
    }
}
