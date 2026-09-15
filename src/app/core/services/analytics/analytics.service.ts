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

  getOverview(period = '30d', channel = 'all'): Observable<Models.OverviewResponse> {
    return this.apiService.get<Models.OverviewResponse>(
      API_ENDPOINTS.ANALYTICS.OVERVIEW(period, channel)
    );
  }

  getRevenueTimeseries(period = '30d', granularity = 'day', channel = 'all'): Observable<Models.RevenueTimeseriesResponse> {
    return this.apiService.get<Models.RevenueTimeseriesResponse>(
      API_ENDPOINTS.ANALYTICS.REVENUE_TIMESERIES(period, granularity, channel)
    );
  }

  getOrdersBreakdown(period = '30d', channel = 'all'): Observable<Models.OrdersBreakdownResponse> {
    return this.apiService.get<Models.OrdersBreakdownResponse>(
      API_ENDPOINTS.ANALYTICS.ORDERS_BREAKDOWN(period, channel)
    );
  }

  getGeography(period = '30d', groupBy = 'district', channel = 'all'): Observable<Models.GeographyResponse> {
    return this.apiService.get<Models.GeographyResponse>(
      API_ENDPOINTS.ANALYTICS.GEOGRAPHY(period, groupBy, channel)
    );
  }

  getTopProducts(period = '30d', by = 'revenue', limit = 10, channel = 'all'): Observable<Models.TopProduct[]> {
    return this.apiService.get<Models.TopProduct[]>(
      API_ENDPOINTS.ANALYTICS.TOP_PRODUCTS(period, by, limit, channel)
    );
  }

  getTopCategories(period = '30d', limit = 10, channel = 'all'): Observable<Models.TopCategory[]> {
    return this.apiService.get<Models.TopCategory[]>(
      API_ENDPOINTS.ANALYTICS.TOP_CATEGORIES(period, limit, channel)
    );
  }

  getInventoryHealth(): Observable<Models.InventoryHealthResponse> {
    return this.apiService.get<Models.InventoryHealthResponse>(
      API_ENDPOINTS.ANALYTICS.INVENTORY_HEALTH
    );
  }

  getCustomers(period = '30d', limit = 10, channel = 'all'): Observable<Models.CustomersResponse> {
    return this.apiService.get<Models.CustomersResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMERS(period, limit, channel)
    );
  }

  getDiscounts(period = '30d', channel = 'all'): Observable<Models.DiscountsResponse> {
    return this.apiService.get<Models.DiscountsResponse>(
      API_ENDPOINTS.ANALYTICS.DISCOUNTS(period, channel)
    );
  }

  getCustomerSegments(period = '30d', channel = 'all'): Observable<Models.CustomerSegmentsResponse> {
    return this.apiService.get<Models.CustomerSegmentsResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMER_SEGMENTS(period, channel)
    );
  }

  getCustomerCohorts(months = 6, channel = 'all'): Observable<Models.CohortsResponse> {
    return this.apiService.get<Models.CohortsResponse>(
      API_ENDPOINTS.ANALYTICS.CUSTOMER_COHORTS(months, channel)
    );
  }

  getPatternsTime(period = '30d', channel = 'all'): Observable<Models.PatternsTimeResponse> {
    return this.apiService.get<Models.PatternsTimeResponse>(
      API_ENDPOINTS.ANALYTICS.PATTERNS_TIME(period, channel)
    );
  }

  getPatternsBasket(period = '30d', limit = 10, channel = 'all'): Observable<Models.PatternsBasketResponse> {
    return this.apiService.get<Models.PatternsBasketResponse>(
      API_ENDPOINTS.ANALYTICS.PATTERNS_BASKET(period, limit, channel)
    );
  }

  getInventorySlowMovers(period = '30d', channel = 'all'): Observable<Models.SlowMoversResponse> {
    return this.apiService.get<Models.SlowMoversResponse>(
      API_ENDPOINTS.ANALYTICS.INVENTORY_SLOW_MOVERS(period, channel)
    );
  }

  getOrdersRisk(period = '30d', channel = 'all'): Observable<Models.OrdersRiskResponse> {
    return this.apiService.get<Models.OrdersRiskResponse>(
      API_ENDPOINTS.ANALYTICS.ORDERS_RISK(period, channel)
    );
  }

  getProfitableProducts(period = '30d', limit = 10, channel = 'all'): Observable<Models.ProfitableProduct[]> {
    return this.apiService.get<Models.ProfitableProduct[]>(
      API_ENDPOINTS.ANALYTICS.PRODUCTS_PROFITABLE(period, limit, channel)
    );
  }

  getSalesBySource(period = '30d'): Observable<Models.SalesBySourceResponse> {
    return this.apiService.get<Models.SalesBySourceResponse>(
      API_ENDPOINTS.ANALYTICS.SALES_BY_SOURCE(period)
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

  getJourneyFunnel(period = '30d'): Observable<Models.JourneyFunnelResponse> {
    return this.apiService.get<Models.JourneyFunnelResponse>(
      API_ENDPOINTS.ANALYTICS.JOURNEY_FUNNEL(period)
    );
  }

  getJourneyProductInterest(period = '30d', limit = 20): Observable<Models.ProductInterestResponse> {
    return this.apiService.get<Models.ProductInterestResponse>(
      API_ENDPOINTS.ANALYTICS.JOURNEY_PRODUCT_INTEREST(period, limit)
    );
  }

  getJourneyAbandonedCarts(period = '30d', limit = 50): Observable<Models.AbandonedCartsResponse> {
    return this.apiService.get<Models.AbandonedCartsResponse>(
      API_ENDPOINTS.ANALYTICS.JOURNEY_ABANDONED_CARTS(period, limit)
    );
  }

  getJourneyEngagement(limit = 50): Observable<Models.EngagementResponse> {
    return this.apiService.get<Models.EngagementResponse>(
      API_ENDPOINTS.ANALYTICS.JOURNEY_ENGAGEMENT(limit)
    );
  }

  getDeviceJourney(deviceIdHash: string, limit = 200): Observable<Models.JourneyEventRead[]> {
    return this.apiService.get<Models.JourneyEventRead[]>(
      API_ENDPOINTS.ANALYTICS.JOURNEY_DEVICE_TIMELINE(deviceIdHash, limit)
    );
  }
}
