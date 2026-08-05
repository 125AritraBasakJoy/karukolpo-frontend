import { Component, OnInit, signal, computed, effect, inject, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AnalyticsService, ProductService, TrackingService } from '../../../core/services';
import * as Models from '../../../models/analytics.model';

type AnalyticsTab = 'overview' | 'sales' | 'customers' | 'inventory' | 'traffic';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    CardModule,
    TableModule,
    TagModule,
    SkeletonModule,
    DropdownModule,
    ButtonModule,
    ProgressSpinnerModule
  ],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss', '../admin-styles.scss']
})
export class AnalyticsComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private productService = inject(ProductService);
  private trackingService = inject(TrackingService);
  private platformId = inject(PLATFORM_ID);

  // Tabs and Filters
  activeTab = signal<AnalyticsTab>('overview');
  selectedPeriod = signal<string>('30d');
  
  // sales-specific filters
  salesGranularity = signal<string>('day');

  // geography-specific filters
  geoGroupBy = signal<string>('district');

  // Loading States
  loadingStates = {
    overview: signal<boolean>(false),
    sales: signal<boolean>(false),
    customers: signal<boolean>(false),
    inventory: signal<boolean>(false),
    traffic: signal<boolean>(false)
  };

  // Data Stores
  overviewData = signal<Models.OverviewResponse | null>(null);
  revenueTimeseries = signal<Models.RevenueTimeseriesResponse | null>(null);
  ordersBreakdown = signal<Models.OrdersBreakdownResponse | null>(null);
  geographyData = signal<Models.GeographyResponse | null>(null);
  topProducts = signal<Models.TopProduct[]>([]);
  topCategories = signal<Models.TopCategory[]>([]);
  inventoryHealth = signal<Models.InventoryHealthResponse | null>(null);
  customersData = signal<Models.CustomersResponse | null>(null);
  discountsData = signal<Models.DiscountsResponse | null>(null);
  customerSegments = signal<Models.CustomerSegmentsResponse | null>(null);
  cohortsData = signal<Models.CohortsResponse | null>(null);
  patternsTime = signal<Models.PatternsTimeResponse | null>(null);
  patternsBasket = signal<Models.PatternsBasketResponse | null>(null);
  slowMovers = signal<Models.SlowMoversResponse | null>(null);
  ordersRisk = signal<Models.OrdersRiskResponse | null>(null);
  profitableProducts = signal<Models.ProfitableProduct[]>([]);
  salesBySource = signal<Models.SalesBySourceResponse | null>(null);
  marketingAttribution = signal<Models.AttributionResponse | null>(null);
  trafficOverview = signal<Models.TrafficOverviewResponse | null>(null);
  trafficSources = signal<Models.TrafficSourcesResponse | null>(null);
  trafficLanding = signal<Models.TrafficLandingResponse | null>(null);
  trafficGeo = signal<Models.TrafficGeoResponse | null>(null);
  trafficConversion = signal<Models.TrafficConversionResponse | null>(null);
  visitEvents = signal<any[]>([]);

  // Visitor Log Filters & Search
  visitorSearchQuery = signal<string>('');
  visitorDeviceFilter = signal<string>('all');
  visitorLocationFilter = signal<string>('all');

  // PrimeNG Dropdown options
  deviceDropdownOptions = [
    { label: 'All Devices', value: 'all' },
    { label: 'Desktop Only', value: 'desktop' },
    { label: 'Mobile Only', value: 'mobile' },
    { label: 'Tablet Only', value: 'tablet' }
  ];

  locationDropdownOptions = [
    { label: 'All Locations', value: 'all' },
    { label: 'Local Only', value: 'local' },
    { label: 'International', value: 'intl' }
  ];

  filteredVisitEvents = computed(() => {
    let list = this.visitEvents();
    
    // Search Query (Visitor ID, Landing Path, Referrer)
    const query = this.visitorSearchQuery().toLowerCase().trim();
    if (query) {
      list = list.filter(v => 
        (v.visitor_id && v.visitor_id.toLowerCase().includes(query)) ||
        (v.landing_path && v.landing_path.toLowerCase().includes(query)) ||
        (v.referrer && v.referrer.toLowerCase().includes(query))
      );
    }

    // Device Filter
    const device = this.visitorDeviceFilter();
    if (device !== 'all') {
      list = list.filter(v => {
        const name = this.getDeviceName(v.user_agent).toLowerCase();
        return name === device;
      });
    }

    // Location Filter
    const loc = this.visitorLocationFilter();
    if (loc === 'local') {
      list = list.filter(v => !v.country);
    } else if (loc === 'intl') {
      list = list.filter(v => !!v.country);
    }

    return list;
  });

  loadVisits(): void {
    this.trackingService.getVisits(150).subscribe({
      next: (data) => {
        this.visitEvents.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load visits:', err);
      }
    });
  }

  getDeviceIcon(ua: string): string {
    if (!ua) return 'pi pi-desktop';
    const lower = ua.toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return 'pi pi-phone';
    if (lower.includes('tablet') || lower.includes('ipad')) return 'pi pi-tablet';
    return 'pi pi-desktop';
  }

  getDeviceName(ua: string): string {
    if (!ua) return 'Desktop';
    const lower = ua.toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return 'Mobile';
    if (lower.includes('tablet') || lower.includes('ipad')) return 'Tablet';
    return 'Desktop';
  }

  // Chart Configurations
  charts: { [key: string]: { data: any; options: any } } = {};

  // Dropdown Options
  periods = [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 90 Days', value: '90d' },
    { label: 'Last 12 Months', value: '12m' }
  ];

  granularities = [
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' }
  ];

  geoGroups = [
    { label: 'District', value: 'district' },
    { label: 'Sub-district', value: 'subdistrict' }
  ];

  constructor() {
    // Automatically re-fetch tab data when active tab, period, granularity, or geo group changes
    effect(() => {
      this.loadTabData();
    });
  }

  ngOnInit(): void {
    // Initial fetch triggered by the signal effects
  }

  setTab(tab: AnalyticsTab): void {
    this.activeTab.set(tab);
  }

  setPeriod(period: string): void {
    this.selectedPeriod.set(period);
  }

  // Load Data based on the active tab
  private loadTabData(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const tab = this.activeTab();
    const period = this.selectedPeriod();

    switch (tab) {
      case 'overview':
        this.fetchOverviewTab(period);
        break;
      case 'sales':
        this.fetchSalesTab(period, this.salesGranularity());
        break;
      case 'customers':
        this.fetchCustomersTab(period, this.geoGroupBy());
        break;
      case 'inventory':
        this.fetchInventoryTab(period);
        break;
      case 'traffic':
        this.fetchTrafficTab(period);
        break;
    }
  }

  // --- TAB FETCHERS ---

  private fetchOverviewTab(period: string): void {
    this.loadingStates.overview.set(true);
    forkJoin({
      overview: this.analyticsService.getOverview(period).pipe(catchError(() => of({}))),
      timeseries: this.analyticsService.getRevenueTimeseries(period, 'day').pipe(catchError(() => of({}))),
      traffic: this.analyticsService.getTrafficOverview(period).pipe(catchError(() => of({}))),
      conversion: this.analyticsService.getTrafficConversion(period).pipe(catchError(() => of({})))
    })
    .pipe(finalize(() => this.loadingStates.overview.set(false)))
    .subscribe(res => {
      // Map overview
      const rawOverview = res.overview as any;
      const mappedOverview: Models.OverviewResponse = {
        total_revenue: rawOverview.revenue?.realized?.total ? parseFloat(rawOverview.revenue.realized.total) : (rawOverview.total_revenue || 0),
        revenue_growth_percentage: rawOverview.revenue?.realized_goods_change_pct ?? (rawOverview.revenue_growth_percentage || 0),
        total_orders: rawOverview.orders?.completed ?? (rawOverview.orders?.total ?? (rawOverview.total_orders || 0)),
        orders_growth_percentage: rawOverview.orders?.booked_change_pct ?? (rawOverview.orders_growth_percentage || 0),
        average_order_value: rawOverview.aov?.realized_total ? parseFloat(rawOverview.aov.realized_total) : (rawOverview.average_order_value || 0),
        conversion_rate: rawOverview.conversion_rate || 0,
        active_customers: rawOverview.customers?.total ?? (rawOverview.active_customers || 0)
      };

      // Map traffic overview
      const rawTraffic = res.traffic as any;
      const mappedTraffic: Models.TrafficOverviewResponse = {
        total_sessions: rawTraffic?.total_visits ?? (rawTraffic?.total_sessions ?? 0),
        bounce_rate: rawTraffic?.bounce_rate ?? 0,
        avg_session_duration: rawTraffic?.avg_session_duration ?? 0
      };

      // Map conversion
      const rawConv = res.conversion as any;
      const mappedSteps: Models.ConversionStep[] = [];
      if (rawConv && rawConv.by_source) {
        rawConv.by_source.forEach((item: any) => {
          mappedSteps.push({
            step_name: item.source || 'Direct',
            count: item.orders || 0,
            drop_off_percentage: item.conversion_pct || 0
          });
        });
      }
      const mappedConv: Models.TrafficConversionResponse = {
        steps: mappedSteps.length > 0 ? mappedSteps : (rawConv.steps || [])
      };

      // Compute conversion rate if it's 0 on overview
      if (mappedOverview.conversion_rate === 0) {
        const totalVisits = mappedTraffic.total_sessions || 1;
        mappedOverview.conversion_rate = parseFloat(((mappedOverview.total_orders / totalVisits) * 100).toFixed(2));
      }

      this.overviewData.set(mappedOverview);
      this.trafficOverview.set(mappedTraffic);
      this.trafficConversion.set(mappedConv);

      // Map timeseries
      const rawTS = res.timeseries as any;
      const mappedPoints: Models.RevenueTimeseriesPoint[] = [];
      if (rawTS && rawTS.labels) {
        rawTS.labels.forEach((label: string, index: number) => {
          const revenueVal = rawTS.realized?.total?.[index] 
            ? parseFloat(rawTS.realized.total[index]) 
            : (rawTS.booked?.total?.[index] ? parseFloat(rawTS.booked.total[index]) : 0);
          mappedPoints.push({
            date: label,
            revenue: revenueVal,
            orders: 0
          });
        });
      }
      this.revenueTimeseries.set({
        data: mappedPoints.length > 0 ? mappedPoints : (rawTS.data || []),
        period: rawTS.period || period,
        granularity: rawTS.granularity || 'day'
      });

      this.buildOverviewCharts();
    });
  }

  private fetchSalesTab(period: string, granularity: string): void {
    this.loadingStates.sales.set(true);
    forkJoin({
      timeseries: this.analyticsService.getRevenueTimeseries(period, granularity).pipe(catchError(() => of({}))),
      breakdown: this.analyticsService.getOrdersBreakdown(period).pipe(catchError(() => of({}))),
      profitable: this.analyticsService.getProfitableProducts(period, 10).pipe(catchError(() => of([]))),
      discounts: this.analyticsService.getDiscounts(period).pipe(catchError(() => of({}))),
      risk: this.analyticsService.getOrdersRisk(period).pipe(catchError(() => of({ orders: [] }))),
      salesBySource: this.analyticsService.getSalesBySource(period).pipe(catchError(() => of({ by_source: [] })))
    })
    .pipe(finalize(() => this.loadingStates.sales.set(false)))
    .subscribe(res => {
      // Map timeseries
      const rawTS = res.timeseries as any;
      const mappedPoints: Models.RevenueTimeseriesPoint[] = [];
      if (rawTS && rawTS.labels) {
        rawTS.labels.forEach((label: string, index: number) => {
          const revenueVal = rawTS.realized?.total?.[index] 
            ? parseFloat(rawTS.realized.total[index]) 
            : (rawTS.booked?.total?.[index] ? parseFloat(rawTS.booked.total[index]) : 0);
          mappedPoints.push({
            date: label,
            revenue: revenueVal,
            orders: 0
          });
        });
      }
      this.revenueTimeseries.set({
        data: mappedPoints.length > 0 ? mappedPoints : (rawTS.data || []),
        period: rawTS.period || period,
        granularity: rawTS.granularity || granularity
      });

      // Map breakdown
      const rawBreakdown = res.breakdown as any;
      const mappedByStatus: Models.StatusBreakdown[] = [];
      if (rawBreakdown && rawBreakdown.by_status) {
        Object.entries(rawBreakdown.by_status).forEach(([status, count]) => {
          mappedByStatus.push({
            status,
            count: count as number,
            value: 0
          });
        });
      }

      const mappedByPayment: Models.PaymentMethodBreakdown[] = [];
      if (rawBreakdown && rawBreakdown.by_payment_method) {
        Object.entries(rawBreakdown.by_payment_method).forEach(([method, count]) => {
          mappedByPayment.push({
            method,
            count: count as number,
            value: count as number
          });
        });
      }

      this.ordersBreakdown.set({
        by_status: mappedByStatus.length > 0 ? mappedByStatus : (rawBreakdown.by_status || []),
        by_payment_method: mappedByPayment.length > 0 ? mappedByPayment : (rawBreakdown.by_payment_method || [])
      });

      // Map profitable products
      const rawProfitable = res.profitable as any;
      const productsArray = Array.isArray(rawProfitable) ? rawProfitable : (rawProfitable?.products || []);
      const mappedProfitable: Models.ProfitableProduct[] = productsArray
        .map((p: any) => {
          const costVal = p.cost ? parseFloat(p.cost) : 0;
          const revenueVal = p.revenue ? parseFloat(p.revenue) : 0;
          const profitVal = p.profit ? parseFloat(p.profit) : (revenueVal - costVal);
          const marginVal = revenueVal > 0 ? (profitVal / revenueVal) * 100 : 0;
          return {
            product_id: p.product_id,
            name: p.name,
            cost: costVal,
            revenue: revenueVal,
            profit: profitVal,
            margin_percentage: marginVal,
            units: p.units ? parseInt(p.units, 10) : (p.units_sold ? parseInt(p.units_sold, 10) : (p.quantity ? parseInt(p.quantity, 10) : 0))
          };
        });

      this.profitableProducts.set(mappedProfitable);

      // Map discounts
      const rawDiscounts = res.discounts as any;
      this.discountsData.set({
        total_discount_amount: rawDiscounts?.total_discount_given ? parseFloat(rawDiscounts.total_discount_given) : (rawDiscounts.total_discount_amount || 0),
        promo_code_usage: rawDiscounts.promo_code_usage || [],
        discount_impact: rawDiscounts?.discounted_order_pct || (rawDiscounts.discount_impact || 0)
      });

      // Map risk
      const rawRisk = res.risk as any;
      const mappedRiskOrders: Models.OrderRisk[] = [];
      if (rawRisk && rawRisk.cancellation_by_payment) {
        rawRisk.cancellation_by_payment.forEach((item: any, idx: number) => {
          if (item.cancellation_rate_pct > 20) {
            mappedRiskOrders.push({
              order_id: `payment-${idx}`,
              order_number: item.payment_method,
              customer_name: `Payment Channel`,
              risk_score: Math.round(item.cancellation_rate_pct),
              risk_reasons: [`High cancellation rate (${item.cancellation_rate_pct}%) on this channel`],
              value: item.total
            });
          }
        });
      }
      if (rawRisk && rawRisk.aging) {
        if (rawRisk.aging.pending_over_24h > 0) {
          mappedRiskOrders.push({
            order_id: 'pending-24h',
            order_number: 'PENDING_AGING',
            customer_name: 'System Alert',
            risk_score: 80,
            risk_reasons: [`${rawRisk.aging.pending_over_24h} orders pending for over 24 hours`],
            value: rawRisk.aging.pending_over_24h
          });
        }
        if (rawRisk.aging.cod_processing_over_3d > 0) {
          mappedRiskOrders.push({
            order_id: 'cod-3d',
            order_number: 'COD_PROCESSING_AGING',
            customer_name: 'System Alert',
            risk_score: 90,
            risk_reasons: [`${rawRisk.aging.cod_processing_over_3d} COD orders processing for over 3 days`],
            value: rawRisk.aging.cod_processing_over_3d
          });
        }
      }
      this.ordersRisk.set({
        orders: mappedRiskOrders.length > 0 ? mappedRiskOrders : (rawRisk.orders || [])
      });

      // Map sales by source (offline/out-sales breakdown)
      const rawSource = res.salesBySource as any;
      const mappedSourceList: Models.SalesBySourceItem[] = (rawSource?.by_source || []).map((s: any) => ({
        key: s.key || 'unspecified',
        orders: s.orders || 0,
        goods_revenue: s.goods_revenue ? parseFloat(s.goods_revenue) : 0,
        total_revenue: s.total_revenue ? parseFloat(s.total_revenue) : 0
      }));
      this.salesBySource.set({
        period: rawSource?.period || period,
        by_source: mappedSourceList
      });

      this.buildSalesCharts();
      this.buildOutSalesCharts();
    });
  }

  private fetchCustomersTab(period: string, geoGroupBy: string): void {
    this.loadingStates.customers.set(true);
    forkJoin({
      customers: this.analyticsService.getCustomers(period, 10).pipe(catchError(() => of({}))),
      segments: this.analyticsService.getCustomerSegments(period).pipe(catchError(() => of({}))),
      cohorts: this.analyticsService.getCustomerCohorts(6).pipe(catchError(() => of({ cohorts: [] }))),
      timePatterns: this.analyticsService.getPatternsTime(period).pipe(catchError(() => of({}))),
      geo: this.analyticsService.getGeography(period, geoGroupBy).pipe(catchError(() => of({ data: [] })))
    })
    .pipe(finalize(() => this.loadingStates.customers.set(false)))
    .subscribe(res => {
      // Map Customers
      const rawCust = res.customers as any;
      const mappedTopCust: Models.TopCustomer[] = (rawCust?.top_customers || []).map((c: any) => ({
        customer_name: c.name || c.phone || 'Anonymous Customer',
        email: c.phone || '',
        orders_count: c.orders || 0,
        total_spent: c.spend ? parseFloat(c.spend) : 0
      }));

      this.customersData.set({
        total_customers: rawCust?.total ?? (rawCust?.total_customers ?? 0),
        new_customers: rawCust?.new ?? (rawCust?.new_customers ?? 0),
        returning_customers: rawCust?.returning ?? (rawCust?.returning_customers ?? 0),
        top_customers: mappedTopCust
      });

      // Map segments
      const rawSegments = res.segments as any;
      const mappedSegmentsList: Models.CustomerSegment[] = [];
      if (rawSegments && rawSegments.segments) {
        Object.entries(rawSegments.segments).forEach(([name, stat]: [string, any]) => {
          mappedSegmentsList.push({
            name,
            count: stat.customers || 0,
            description: `Customers in segment: ${name}`,
            revenue_contribution: stat.revenue ? parseFloat(stat.revenue) : 0
          });
        });
      }
      this.customerSegments.set({
        segments: mappedSegmentsList.length > 0 ? mappedSegmentsList : (rawSegments.segments || [])
      });

      // Map cohorts
      const rawCohorts = res.cohorts as any;
      const mappedCohortsList: Models.Cohort[] = (rawCohorts?.cohorts || []).map((c: any) => ({
        cohort_month: c.cohort || '',
        size: c.size || 0,
        retention: c.retention_pct || []
      }));
      this.cohortsData.set({
        cohorts: mappedCohortsList.length > 0 ? mappedCohortsList : (rawCohorts.cohorts || [])
      });

      // Map time patterns
      const rawTime = res.timePatterns as any;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const byDayMap = new Map<string, Models.TimePatternPoint>();
      const byHourMap = new Map<number, Models.TimePatternPoint>();

      if (rawTime && rawTime.cells) {
        rawTime.cells.forEach((cell: any) => {
          const dayName = days[cell.dow] || `Day ${cell.dow}`;
          const currentDayPoint = byDayMap.get(dayName) || { day: dayName, revenue: 0, orders: 0 };
          currentDayPoint.revenue += cell.revenue ? parseFloat(cell.revenue) : 0;
          currentDayPoint.orders += cell.orders || 0;
          byDayMap.set(dayName, currentDayPoint);

          const currentHourPoint = byHourMap.get(cell.hour) || { hour: cell.hour, revenue: 0, orders: 0 };
          currentHourPoint.revenue += cell.revenue ? parseFloat(cell.revenue) : 0;
          currentHourPoint.orders += cell.orders || 0;
          byHourMap.set(cell.hour, currentHourPoint);
        });
      }

      this.patternsTime.set({
        by_day_of_week: byDayMap.size > 0 ? Array.from(byDayMap.values()) : (rawTime.by_day_of_week || []),
        by_hour: byHourMap.size > 0 ? Array.from(byHourMap.values()).sort((a, b) => (a.hour || 0) - (b.hour || 0)) : (rawTime.by_hour || [])
      });

      // Map Geography
      const rawGeo = res.geo as any;
      const mappedGeoPoints: Models.GeographyPoint[] = (rawGeo?.areas || []).map((areaItem: any) => ({
        location: areaItem.area || 'Unknown',
        revenue: areaItem.total_revenue ? parseFloat(areaItem.total_revenue) : 0,
        orders: areaItem.orders || 0,
        customers: areaItem.customers || 0
      }));
      this.geographyData.set({
        data: mappedGeoPoints.length > 0 ? mappedGeoPoints : (rawGeo.data || [])
      });

      this.buildCustomersCharts();
    });
  }

  private fetchInventoryTab(period: string): void {
    this.loadingStates.inventory.set(true);
    forkJoin({
      topProdRev: this.analyticsService.getTopProducts(period, 'revenue', 8).pipe(catchError(() => of([]))),
      topCat: this.analyticsService.getTopCategories(period, 8).pipe(catchError(() => of([]))),
      health: this.analyticsService.getInventoryHealth().pipe(catchError(() => of({}))),
      slowMovers: this.analyticsService.getInventorySlowMovers(period).pipe(catchError(() => of({ products: [] }))),
      basket: this.analyticsService.getPatternsBasket(period, 8).pipe(catchError(() => of({ pairs: [] }))),
      products: this.productService.getProducts(0, 1000, undefined, true).pipe(catchError(() => of([])))
    })
    .pipe(finalize(() => this.loadingStates.inventory.set(false)))
    .subscribe(res => {
      const productsList = res.products || [];

      // Map Top Products
      const mappedTopProducts: Models.TopProduct[] = (res.topProdRev || []).map((p: any) => {
        const matchedProd = productsList.find((prod: any) => prod.id === p.product_id?.toString());
        return {
          product_id: p.product_id,
          name: p.name,
          code: matchedProd?.code || `PROD-${p.product_id?.slice(-4)}`,
          revenue: p.revenue ? parseFloat(p.revenue) : 0,
          units_sold: p.units || 0,
          stock: matchedProd?.stock || 0
        };
      });
      this.topProducts.set(mappedTopProducts);

      // Map Top Categories
      const mappedTopCategories: Models.TopCategory[] = (res.topCat || []).map((c: any) => ({
        category_id: c.category_id,
        name: c.name,
        revenue: c.revenue ? parseFloat(c.revenue) : 0,
        units_sold: c.units || 0
      }));
      this.topCategories.set(mappedTopCategories);

      // Map Inventory Health
      const rawHealth = res.health as any;
      const totalProductsCount = productsList.length;
      const outOfStockCount = productsList.filter(p => !p.isInStock || (p.stock !== undefined && p.stock <= 0)).length;
      const inStockCount = Math.max(0, totalProductsCount - outOfStockCount);
      const lowStockCount = productsList.filter(p => p.isInStock && p.stock !== undefined && p.stock > 0 && p.stock <= 5).length;
      
      const calculatedValue = productsList.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
      const estimatedValue = rawHealth?.stock_value ? parseFloat(rawHealth.stock_value) : calculatedValue;

      this.inventoryHealth.set({
        total_products: totalProductsCount,
        in_stock: inStockCount,
        out_of_stock: outOfStockCount,
        low_stock: lowStockCount,
        estimated_value: estimatedValue
      });

      // Map Slow Movers
      const rawSlow = res.slowMovers as any;
      const mappedSlowProducts: Models.SlowMover[] = (rawSlow?.slow_movers || []).map((sm: any) => ({
        name: sm.name,
        sold: sm.sold ?? 0,
        on_hand: sm.on_hand ?? 0,
        sell_through_pct: sm.sell_through_pct ?? 0,
        frozen_value: sm.frozen_value ? parseFloat(sm.frozen_value) : 0
      }));
      this.slowMovers.set({
        products: mappedSlowProducts
      });

      // Map Basket Pairs
      const rawBasket = res.basket as any;
      const mappedPairs: Models.BasketPair[] = (rawBasket?.frequently_bought_together || []).map((pair: any) => ({
        product_a: pair.product_a,
        product_b: pair.product_b,
        support: rawBasket.orders > 0 ? (pair.count / rawBasket.orders) * 100 : 0,
        confidence: pair.confidence || 0,
        co_occurrences: pair.count || 0
      }));
      this.patternsBasket.set({
        pairs: mappedPairs.length > 0 ? mappedPairs : []
      });

      this.buildInventoryCharts();
    });
  }

  private fetchTrafficTab(period: string): void {
    this.loadingStates.traffic.set(true);
    forkJoin({
      overview: this.analyticsService.getTrafficOverview(period).pipe(catchError(() => of({}))),
      sources: this.analyticsService.getTrafficSources(period).pipe(catchError(() => of({ sources: [] }))),
      landing: this.analyticsService.getTrafficLanding(period).pipe(catchError(() => of({ pages: [] }))),
      geo: this.analyticsService.getTrafficGeo(period).pipe(catchError(() => of({ regions: [] }))),
      attribution: this.analyticsService.getMarketingAttribution(period).pipe(catchError(() => of({ channels: [] }))),
      visits: this.trackingService.getVisits(150).pipe(catchError(() => of([])))
    })
    .pipe(finalize(() => this.loadingStates.traffic.set(false)))
    .subscribe(res => {
      // Map Traffic Overview
      const rawTraffic = res.overview as any;
      this.trafficOverview.set({
        total_sessions: rawTraffic?.total_visits || 0,
        bounce_rate: rawTraffic?.bounce_rate || 0,
        avg_session_duration: rawTraffic?.avg_session_duration || 0
      });

      // Map Traffic Sources
      const rawSources = res.sources as any;
      const mappedSourcesList: Models.TrafficSource[] = (rawSources?.by_source || []).map((s: any) => ({
        source: s.key || 'Direct',
        sessions: s.visits || 0,
        conversions: 0,
        conversion_rate: 0
      }));
      this.trafficSources.set({
        sources: mappedSourcesList.length > 0 ? mappedSourcesList : (rawSources.sources || [])
      });

      // Map Landing Pages
      const rawLanding = res.landing as any;
      const mappedLandingList: Models.LandingPageTraffic[] = (rawLanding?.landing_pages || []).map((l: any) => ({
        path: l.path || '/',
        sessions: l.visits || 0,
        bounce_rate: l.bounce_rate || 0
      }));
      this.trafficLanding.set({
        pages: mappedLandingList.length > 0 ? mappedLandingList : (rawLanding.pages || [])
      });

      // Map Geo
      const rawGeo = res.geo as any;
      const mappedGeoList: Models.GeoRegionTraffic[] = (rawGeo?.countries || []).map((g: any) => ({
        region: g.country === '??' ? 'Local / Unknown Location' : (g.country === 'BD' ? 'Bangladesh' : g.country || 'Unknown Location'),
        country: g.country === '??' ? 'Local / Unknown Location' : (g.country === 'BD' ? 'Bangladesh' : g.country || 'Unknown Location'),
        sessions: g.unique_visitors || 0,
        conversion_rate: 0
      }));
      this.trafficGeo.set({
        regions: mappedGeoList.length > 0 ? mappedGeoList : (rawGeo.regions || [])
      });

      // Map Attribution
      const rawAttr = res.attribution as any;
      const mappedAttrList: Models.MarketingChannel[] = (rawAttr?.by_source || []).map((row: any) => ({
        channel: row.key || 'Direct',
        orders: row.orders || 0,
        revenue: row.total_revenue ? parseFloat(row.total_revenue) : 0,
        roi: 0
      }));
      this.marketingAttribution.set({
        channels: mappedAttrList.length > 0 ? mappedAttrList : (rawAttr.channels || [])
      });

      // Set Visitor logs
      this.visitEvents.set(res.visits || []);

      this.buildTrafficCharts();
    });
  }

  // --- CHART BUILDERS ---

  private buildOverviewCharts(): void {
    const ts = this.revenueTimeseries();
    const conv = this.trafficConversion();

    // 1. Revenue Timeseries Chart (Overview area)
    if (ts && ts.data.length > 0) {
      const isSinglePoint = ts.data.length === 1;
      this.charts['overviewRevenue'] = {
        data: {
          labels: ts.data.map(p => p.date),
          datasets: [
            {
              label: 'Revenue (BDT)',
              data: ts.data.map(p => p.revenue),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointRadius: isSinglePoint ? 5 : 3,
              pointHoverRadius: 7,
              pointBackgroundColor: '#6366f1',
              pointBorderWidth: 1,
              pointHoverBorderWidth: 2
            },
            {
              label: 'Orders',
              data: ts.data.map(p => p.orders),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.04)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointRadius: isSinglePoint ? 5 : 3,
              pointHoverRadius: 7,
              pointBackgroundColor: '#10b981',
              pointBorderWidth: 1,
              pointHoverBorderWidth: 2,
              yAxisID: 'y1'
            }
          ]
        },
        options: this.getLineChartOptions(true)
      };
    }

    // 2. Conversion Funnel Chart (Horizontal Bar Chart)
    if (conv && conv.steps.length > 0) {
      this.charts['overviewFunnel'] = {
        data: {
          labels: conv.steps.map(s => s.step_name),
          datasets: [{
            label: 'Sessions Count',
            data: conv.steps.map(s => s.count),
            backgroundColor: [
              'rgba(99, 102, 241, 0.85)',
              'rgba(168, 85, 247, 0.85)',
              'rgba(236, 72, 153, 0.85)',
              'rgba(244, 63, 94, 0.85)'
            ],
            borderRadius: 8,
            borderWidth: 0,
            barThickness: 24
          }]
        },
        options: this.getBarChartOptions(true)
      };
    }
  }

  private buildSalesCharts(): void {
    const ts = this.revenueTimeseries();
    const bd = this.ordersBreakdown();

    // 1. Sales Tab Revenue Timeseries
    if (ts && ts.data.length > 0) {
      const isSinglePoint = ts.data.length === 1;
      this.charts['salesRevenue'] = {
        data: {
          labels: ts.data.map(p => p.date),
          datasets: [
            {
              label: 'Revenue (BDT)',
              data: ts.data.map(p => p.revenue),
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointRadius: isSinglePoint ? 5 : 3,
              pointHoverRadius: 7,
              pointBackgroundColor: '#6366f1',
              pointBorderWidth: 1
            }
          ]
        },
        options: this.getLineChartOptions(false)
      };
    }

    // 2. Orders Status Doughnut
    if (bd && bd.by_status.length > 0) {
      this.charts['salesStatus'] = {
        data: {
          labels: bd.by_status.map(s => s.status),
          datasets: [{
            data: bd.by_status.map(s => s.count),
            backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#64748b'],
            borderWidth: 0
          }]
        },
        options: this.getDoughnutOptions()
      };
    }

    // 3. Payment Method Doughnut
    if (bd && bd.by_payment_method.length > 0) {
      this.charts['salesPayment'] = {
        data: {
          labels: bd.by_payment_method.map(p => p.method),
          datasets: [{
            data: bd.by_payment_method.map(p => p.value),
            backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#14b8a6'],
            borderWidth: 0
          }]
        },
        options: this.getDoughnutOptions()
      };
    }

    // 4. Most Profitable Products Chart
    const profitable = this.profitableProducts();
    if (profitable && profitable.length > 0) {
      this.charts['salesProfitable'] = {
        data: {
          labels: profitable.map(p => p.name),
          datasets: [
            {
              label: 'Gross Profit (BDT)',
              data: profitable.map(p => p.revenue * p.margin_percentage / 100),
              backgroundColor: '#10b981',
              borderRadius: 6,
              borderWidth: 0
            }
          ]
        },
        options: {
          indexAxis: 'y', // Horizontal Bar Chart
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: {
                label: (context: any) => {
                  return ` Gross Profit: ${context.parsed.x.toLocaleString()} BDT`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              ticks: {
                color: '#94a3b8',
                font: {
                  family: 'system-ui'
                }
              }
            },
            y: {
              grid: {
                display: false
              },
              ticks: {
                color: '#94a3b8',
                font: {
                  family: 'system-ui',
                  size: 11
                }
              }
            }
          }
        }
      };
    }
  }

  private buildOutSalesCharts(): void {
    const src = this.salesBySource();
    if (src && src.by_source.length > 0) {
      const palette = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6', '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#64748b'];
      this.charts['outSalesSource'] = {
        data: {
          labels: src.by_source.map(s => s.key === 'unspecified' ? 'Unspecified' : s.key),
          datasets: [{
            data: src.by_source.map(s => s.orders),
            backgroundColor: palette,
            borderWidth: 0
          }]
        },
        options: this.getDoughnutOptions()
      };
    }
  }

  private buildCustomersCharts(): void {
    const segs = this.customerSegments();
    const patterns = this.patternsTime();
    // 1. Customer Segments Doughnut
    if (segs && segs.segments.length > 0) {
      this.charts['customerSegments'] = {
        data: {
          labels: segs.segments.map(s => s.name),
          datasets: [{
            data: segs.segments.map(s => s.count),
            backgroundColor: ['#a855f7', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: this.getDoughnutOptions()
      };
    }

    // 2. Day of Week Patterns
    if (patterns && patterns.by_day_of_week.length > 0) {
      this.charts['patternsDay'] = {
        data: {
          labels: patterns.by_day_of_week.map(p => p.day),
          datasets: [{
            label: 'Orders',
            data: patterns.by_day_of_week.map(p => p.orders),
            backgroundColor: 'rgba(168, 85, 247, 0.75)',
            borderRadius: 6
          }]
        },
        options: this.getBarChartOptions(false)
      };
    }

    // 3. Hour of Day Patterns
    if (patterns && patterns.by_hour.length > 0) {
      this.charts['patternsHour'] = {
        data: {
          labels: patterns.by_hour.map(p => `${p.hour}:00`),
          datasets: [{
            label: 'Revenue (BDT)',
            data: patterns.by_hour.map(p => p.revenue),
            borderColor: '#ec4899',
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: patterns.by_hour.length === 1 ? 5 : 3,
            pointHoverRadius: 7,
            pointBackgroundColor: '#ec4899',
            pointBorderWidth: 1
          }]
        },
        options: this.getLineChartOptions(false)
      };
    }
  }

  private buildInventoryCharts(): void {
    const products = this.topProducts();
    const categories = this.topCategories();

    // 1. Top Products Horizontal Bar Chart
    if (products.length > 0) {
      this.charts['topProductsChart'] = {
        data: {
          labels: products.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name),
          datasets: [{
            label: 'Revenue',
            data: products.map(p => p.revenue),
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderRadius: 6
          }]
        },
        options: this.getBarChartOptions(true)
      };
    }

    // 2. Top Categories Bar Chart
    if (categories.length > 0) {
      this.charts['topCategoriesChart'] = {
        data: {
          labels: categories.map(c => c.name),
          datasets: [{
            label: 'Units Sold',
            data: categories.map(c => c.units_sold),
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderRadius: 6
          }]
        },
        options: this.getBarChartOptions(false)
      };
    }
  }

  private buildTrafficCharts(): void {
    const src = this.trafficSources();
    const attr = this.marketingAttribution();

    // 1. Traffic Sources Pie Chart
    if (src && src.sources.length > 0) {
      this.charts['trafficSourcesChart'] = {
        data: {
          labels: src.sources.map(s => s.source),
          datasets: [{
            data: src.sources.map(s => s.sessions),
            backgroundColor: ['#3b82f6', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#64748b'],
            borderWidth: 0
          }]
        },
        options: this.getDoughnutOptions()
      };
    }

    // 2. Marketing Attribution ROI Bar Chart
    if (attr && attr.channels.length > 0) {
      this.charts['marketingAttributionChart'] = {
        data: {
          labels: attr.channels.map(c => c.channel),
          datasets: [{
            label: 'Attributed Revenue (BDT)',
            data: attr.channels.map(c => c.revenue),
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            borderRadius: 6
          }]
        },
        options: this.getBarChartOptions(false)
      };
    }

    // 3. Traffic Geo Chart
    const geo = this.trafficGeo();
    if (geo && geo.regions.length > 0) {
      this.charts['trafficGeoChart'] = {
        data: {
          labels: geo.regions.map(r => r.region === 'BD' ? 'Bangladesh' : (r.region || 'Unknown')),
          datasets: [{
            label: 'Unique Visitors',
            data: geo.regions.map(r => r.sessions),
            backgroundColor: ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ec4899', '#64748b'],
            borderRadius: 6
          }]
        },
        options: this.getBarChartOptions(true)
      };
    }
  }

  private getLineChartOptions(dualAxis = false): any {
    const scales: any = {
      x: {
        grid: { display: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 10, family: 'Inter, sans-serif' }
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.03)',
          borderDash: [4, 4],
          drawBorder: false
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10, family: 'Inter, sans-serif' }
        }
      }
    };

    if (dualAxis) {
      scales['y1'] = {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { display: false },
        ticks: {
          color: '#10b981',
          font: { size: 10, family: 'Inter, sans-serif' }
        }
      };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#f8fafc',
            font: { size: 11, family: 'Inter, sans-serif', weight: '500' },
            usePointStyle: true,
            boxWidth: 8,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          titleFont: { family: 'Inter, sans-serif', weight: 'bold' },
          bodyFont: { family: 'Inter, sans-serif' },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          cornerRadius: 8
        }
      },
      scales
    };
  }

  private getBarChartOptions(horizontal = false): any {
    return {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          titleFont: { family: 'Inter, sans-serif', weight: 'bold' },
          bodyFont: { family: 'Inter, sans-serif' },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 10, family: 'Inter, sans-serif' }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            borderDash: [4, 4],
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: { size: 10, family: 'Inter, sans-serif' }
          }
        }
      }
    };
  }

  private getDoughnutOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#f8fafc',
            font: { size: 11, family: 'Inter, sans-serif' },
            boxWidth: 8,
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }
      }
    };
  }
}
