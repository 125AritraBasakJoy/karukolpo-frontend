import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ANALYTICS_API } from './analytics.api';
import * as Models from '../../../models/analytics.model';

const API_ENDPOINTS = {
  ANALYTICS: ANALYTICS_API
} as const;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private apiService: ApiService) {}

  getOverview(period = '30d'): Observable<Models.OverviewResponse> {
    return this.apiService.get<Models.OverviewResponse>(
      API_ENDPOINTS.ANALYTICS.OVERVIEW(period)
    );
  }

  getRevenueTimeseries(period = '30d', granularity = 'day'): Observable<Models.RevenueTimeseriesResponse> {
    return this.apiService.get<Models.RevenueTimeseriesResponse>(
      API_ENDPOINTS.ANALYTICS.REVENUE_TIMESERIES(period, granularity)
    );
  }

  getOrdersBreakdown(period = '30d'): Observable<Models.OrdersBreakdownResponse> {
    return this.apiService.get<Models.OrdersBreakdownResponse>(
      API_ENDPOINTS.ANALYTICS.ORDERS_BREAKDOWN(period)
    );
  }

  getGeography(period = '30d', groupBy = 'district'): Observable<Models.GeographyResponse> {
    return this.apiService.get<Models.GeographyResponse>(
      API_ENDPOINTS.ANALYTICS.GEOGRAPHY(period, groupBy)
    );
  }

  getTopProducts(period = '30d', by = 'revenue', limit = 10): Observable<Models.TopProduct[]> {
    return this.apiService.get<Models.TopProduct[]>(
      API_ENDPOINTS.ANALYTICS.TOP_PRODUCTS(period, by, limit)
    );
  }

  getTopCategories(period = '30d', limit = 10): Observable<Models.TopCategory[]> {
    return this.apiService.get<Models.TopCategory[]>(
      API_ENDPOINTS.ANALYTICS.TOP_CATEGORIES(period, limit)
    );
  }

  getInventoryHealth(): Observable<Models.InventoryHealthResponse> {
    return this.apiService.get<Models.InventoryHealthResponse>(
      API_ENDPOINTS.ANALYTICS.INVENTORY_HEALTH
    );
  }

  getCustomers(period = '30d', limit = 10): Observable<Models.CustomersResponse> {
    return this.apiService.get<Models.CustomersResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMERS(period, limit)
    );
  }

  getDiscounts(period = '30d'): Observable<Models.DiscountsResponse> {
    return this.apiService.get<Models.DiscountsResponse>(
      API_ENDPOINTS.ANALYTICS.DISCOUNTS(period)
    );
  }

  getCustomerSegments(period = '30d'): Observable<Models.CustomerSegmentsResponse> {
    return this.apiService.get<Models.CustomerSegmentsResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMER_SEGMENTS(period)
    );
  }

  getCustomerCohorts(months = 6): Observable<Models.CohortsResponse> {
    return this.apiService.get<Models.CohortsResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMER_COHORTS(months)
    );
  }

  getPatternsTime(period = '30d'): Observable<Models.PatternsTimeResponse> {
    return this.apiService.get<Models.PatternsTimeResponse>(
      API_ENDPOINTS.ANALYTICS.PATTERNS_TIME(period)
    );
  }

  getPatternsBasket(period = '30d', limit = 10): Observable<Models.PatternsBasketResponse> {
    return this.apiService.get<Models.PatternsBasketResponse>(
      API_ENDPOINTS.ANALYTICS.PATTERNS_BASKET(period, limit)
    );
  }

  getInventorySlowMovers(period = '30d'): Observable<Models.SlowMoversResponse> {
    return this.apiService.get<Models.SlowMoversResponse>(
      API_ENDPOINTS.ANALYTICS.INVENTORY_SLOW_MOVERS(period)
    );
  }

  getOrdersRisk(period = '30d'): Observable<Models.OrdersRiskResponse> {
    return this.apiService.get<Models.OrdersRiskResponse>(
      API_ENDPOINTS.ANALYTICS.ORDERS_RISK(period)
    );
  }

  getProfitableProducts(period = '30d', limit = 10): Observable<Models.ProfitableProduct[]> {
    return this.apiService.get<Models.ProfitableProduct[]>(
      API_ENDPOINTS.ANALYTICS.PRODUCTS_PROFITABLE(period, limit)
    );
  }

  getMarketingAttribution(period = '30d'): Observable<Models.AttributionResponse> {
    return this.apiService.get<Models.AttributionResponse>(
      API_ENDPOINTS.ANALYTICS.MARKETING_ATTRIBUTION(period)
    );
  }

  getTrafficOverview(period = '30d'): Observable<Models.TrafficOverviewResponse> {
    return this.apiService.get<Models.TrafficOverviewResponse>(
      API_ENDPOINTS.ANALYTICS.TRAFFIC_OVERVIEW(period)
    );
  }

  getTrafficSources(period = '30d'): Observable<Models.TrafficSourcesResponse> {
    return this.apiService.get<Models.TrafficSourcesResponse>(
      API_ENDPOINTS.ANALYTICS.TRAFFIC_SOURCES(period)
    );
  }

  getTrafficLanding(period = '30d'): Observable<Models.TrafficLandingResponse> {
    return this.apiService.get<Models.TrafficLandingResponse>(
      API_ENDPOINTS.ANALYTICS.TRAFFIC_LANDING(period)
    );
  }

  getTrafficGeo(period = '30d'): Observable<Models.TrafficGeoResponse> {
    return this.apiService.get<Models.TrafficGeoResponse>(
      API_ENDPOINTS.ANALYTICS.TRAFFIC_GEO(period)
    );
  }

  getTrafficConversion(period = '30d'): Observable<Models.TrafficConversionResponse> {
    return this.apiService.get<Models.TrafficConversionResponse>(
      API_ENDPOINTS.ANALYTICS.TRAFFIC_CONVERSION(period)
    );
  }
}
