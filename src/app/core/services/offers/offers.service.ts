import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '../api/api.service';

export interface Offer {
  product_id: string;
  slug: string;
  name: string;
  original_price: string;
  effective_price: string;
  ends_at: string;
  reason: 'returning_visitor' | 'repeat_product_views' | string;
}

export interface OffersResponse {
  offer: Offer | null;
}

@Injectable({
  providedIn: 'root'
})
export class OffersService {
  constructor(private apiService: ApiService) {}

  getOffer(): Observable<Offer | null> {
    return this.apiService.get<OffersResponse>('track/offers').pipe(
      map(r => r?.offer || null),
      // An offer is a nice-to-have. Never let it break a page.
      catchError(() => of(null))
    );
  }
}
