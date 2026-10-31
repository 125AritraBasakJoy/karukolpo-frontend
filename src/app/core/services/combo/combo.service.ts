import { Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { ProductService } from '../product/product.service';
import { COMBOS_API } from './combo.api';
import {
  ComboView,
  AdminCombo,
  AdminComboPayload,
  ComboSuggestion,
  ComboItem
} from '../../../models/combo.model';
import { CartQuoteRequest, CartQuoteResponse } from '../../../models/quote.model';
import { SKIP_GLOBAL_LOADER } from '../../interceptors/http-context-tokens';

@Injectable({
  providedIn: 'root'
})
export class ComboService {
  constructor(
    private apiService: ApiService,
    private productService: ProductService
  ) {}

  mapBackendCombo(raw: any): ComboView {
    const items: ComboItem[] = (raw.items || []).map((it: any) => ({
      product: this.productService.mapBackendToFrontend(it.product || it),
      quantity: it.quantity ?? 1
    }));

    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? null,
      kind: raw.kind || (raw.slot_count ? 'mix_and_match' : 'fixed'),
      slot_count: raw.slot_count ?? null,
      pricing_type: raw.pricing_type || 'fixed_price',
      pricing_value: raw.pricing_value,
      items,
      list_total: raw.list_total ?? 0,
      combo_price: raw.combo_price ?? 0,
      savings: raw.savings ?? 0,
      savings_percent: raw.savings_percent ?? null,
      price_is_from: !!raw.price_is_from,
      starts_at: raw.starts_at ?? null,
      ends_at: raw.ends_at ?? null
    };
  }

  mapAdminCombo(raw: any): AdminCombo {
    const base = this.mapBackendCombo(raw);
    return {
      ...base,
      status: raw.status || (raw.is_active ? 'active' : 'inactive'),
      status_reason: raw.status_reason ?? null,
      is_active: raw.is_active !== false,
      sets_sold: raw.sets_sold ?? 0,
      orders: raw.orders ?? 0,
      discount_given: raw.discount_given ?? 0
    };
  }

  getCombos(limit = 20): Observable<ComboView[]> {
    return this.apiService.get<any[]>(COMBOS_API.LIST(limit)).pipe(
      map(list => (list || []).map(raw => this.mapBackendCombo(raw))),
      catchError(err => {
        console.error('Failed to load combos:', err);
        return of([]);
      })
    );
  }

  getProductCombos(slugOrId: string): Observable<ComboView[]> {
    return this.apiService.get<any[]>(COMBOS_API.PRODUCT_COMBOS(slugOrId)).pipe(
      map(list => (list || []).map(raw => this.mapBackendCombo(raw))),
      catchError(err => {
        console.error(`Failed to load combos for product ${slugOrId}:`, err);
        return of([]);
      })
    );
  }

  quoteCart(req: CartQuoteRequest, skipLoader = true): Observable<CartQuoteResponse> {
    const context = skipLoader ? new HttpContext().set(SKIP_GLOBAL_LOADER, true) : undefined;
    return this.apiService.post<CartQuoteResponse>(COMBOS_API.CART_QUOTE, req, { context });
  }

  getAdminCombos(): Observable<AdminCombo[]> {
    return this.apiService.get<any[]>(COMBOS_API.ADMIN_LIST).pipe(
      map(list => (list || []).map(raw => this.mapAdminCombo(raw)))
    );
  }

  getAdminComboById(id: string): Observable<AdminCombo> {
    return this.apiService.get<any>(COMBOS_API.ADMIN_GET_BY_ID(id)).pipe(
      map(raw => this.mapAdminCombo(raw))
    );
  }

  createAdminCombo(payload: AdminComboPayload): Observable<AdminCombo> {
    return this.apiService.post<any>(COMBOS_API.ADMIN_CREATE, payload).pipe(
      map(raw => this.mapAdminCombo(raw))
    );
  }

  updateAdminCombo(id: string, payload: Partial<AdminComboPayload>): Observable<AdminCombo> {
    return this.apiService.patch<any>(COMBOS_API.ADMIN_UPDATE(id), payload).pipe(
      map(raw => this.mapAdminCombo(raw))
    );
  }

  deleteAdminCombo(id: string): Observable<{ deleted: boolean; deactivated?: boolean }> {
    return this.apiService.delete<{ deleted: boolean; deactivated?: boolean }>(COMBOS_API.ADMIN_DELETE(id));
  }

  getAdminSuggestions(limit = 10): Observable<ComboSuggestion[]> {
    return this.apiService.get<any[]>(COMBOS_API.ADMIN_SUGGESTIONS(limit)).pipe(
      map(list => (list || []).map(raw => ({
        products: (raw.products || []).map((p: any) => this.productService.mapBackendToFrontend(p)),
        orders_together: raw.orders_together ?? 0,
        list_total: raw.list_total ?? 0
      }))),
      catchError(err => {
        console.error('Failed to load combo suggestions:', err);
        return of([]);
      })
    );
  }
}
