export interface OverviewResponse {
  total_revenue: number;
  revenue_growth_percentage: number;
  total_orders: number;
  orders_growth_percentage: number;
  average_order_value: number;
  conversion_rate: number;
  active_customers: number;
}

export interface RevenueTimeseriesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RevenueTimeseriesResponse {
  data: RevenueTimeseriesPoint[];
  period: string;
  granularity: string;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  value: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  value: number;
}

export interface OrdersBreakdownResponse {
  by_status: StatusBreakdown[];
  by_payment_method: PaymentMethodBreakdown[];
}

export interface GeographyPoint {
  location: string;
  revenue: number;
  orders: number;
  customers: number;
}

export interface GeographyResponse {
  data: GeographyPoint[];
}

export interface TopProduct {
  product_id: string;
  name: string;
  code: string;
  revenue: number;
  units_sold: number;
  stock: number;
}

export interface TopCategory {
  category_id: string;
  name: string;
  revenue: number;
  units_sold: number;
}

export interface InventoryHealthResponse {
  total_products: number;
  in_stock: number;
  out_of_stock: number;
  low_stock: number;
  estimated_value: number;
}

export interface TopCustomer {
  customer_name: string;
  email: string;
  orders_count: number;
  total_spent: number;
}

export interface CustomersResponse {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  top_customers: TopCustomer[];
}

export interface PromoCodeUsage {
  code: string;
  count: number;
  discount_value: number;
}

export interface DiscountsResponse {
  total_discount_amount: number;
  promo_code_usage: PromoCodeUsage[];
  discount_impact: number;
}

export interface CustomerSegment {
  name: string;
  count: number;
  description: string;
  revenue_contribution: number;
}

export interface CustomerSegmentsResponse {
  segments: CustomerSegment[];
}

export interface Cohort {
  cohort_month: string;
  size: number;
  retention: number[];
}

export interface CohortsResponse {
  cohorts: Cohort[];
}

export interface TimePatternPoint {
  hour?: number;
  day?: string;
  revenue: number;
  orders: number;
}

export interface PatternsTimeResponse {
  by_hour: TimePatternPoint[];
  by_day_of_week: TimePatternPoint[];
}

export interface BasketPair {
  product_a: string;
  product_b: string;
  support: number;
  confidence: number;
  co_occurrences: number;
}

export interface PatternsBasketResponse {
  pairs: BasketPair[];
}

export interface SlowMover {
  name: string;
  sold: number;
  on_hand: number;
  sell_through_pct: number;
  frozen_value: number;
}

export interface SlowMoversResponse {
  products: SlowMover[];
}

export interface OrderRisk {
  order_id: string;
  order_number: string;
  customer_name: string;
  risk_score: number;
  risk_reasons: string[];
  value: number;
}

export interface OrdersRiskResponse {
  orders: OrderRisk[];
}

export interface ProfitableProduct {
  product_id: string;
  name: string;
  cost: number;
  revenue: number;
  profit: number;
  margin_percentage: number;
  units_sold?: number;
  units?: number;
}

export interface MarketingChannel {
  channel: string;
  orders: number;
  revenue: number;
  roi?: number;
}

export interface AttributionResponse {
  channels: MarketingChannel[];
}

export interface TrafficOverviewResponse {
  total_sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface TrafficSource {
  source: string;
  sessions: number;
  conversions: number;
  conversion_rate: number;
}

export interface TrafficSourcesResponse {
  sources: TrafficSource[];
}

export interface LandingPageTraffic {
  path: string;
  sessions: number;
  bounce_rate: number;
}

export interface TrafficLandingResponse {
  pages: LandingPageTraffic[];
}

export interface GeoRegionTraffic {
  region: string;
  country: string;
  sessions: number;
  conversion_rate: number;
}

export interface TrafficGeoResponse {
  regions: GeoRegionTraffic[];
}

export interface ConversionStep {
  step_name: string;
  count: number;
  drop_off_percentage: number;
}

export interface TrafficConversionResponse {
  steps: ConversionStep[];
}

export interface SalesBySourceItem {
  key: string;
  orders: number;
  goods_revenue: number;
  total_revenue: number;
}

export interface SalesBySourceResponse {
  period: string;
  by_source: SalesBySourceItem[];
}
