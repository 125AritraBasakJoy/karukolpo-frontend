import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { OrderService } from '../../../core/services/order/order.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';
import { ProductService } from '../../../core/services/product/product.service';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';
import { Order } from '../../../models/order.model';
import { Product } from '../../../models/product.model';

export interface BreakdownItem {
  rank?: number;
  name: string;
  value: string | number;
  secondaryValue?: string;
  percentage?: number;
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
  actionChips?: { label: string; route?: string; query?: string }[];
  orderCard?: {
    id: string;
    customerName: string;
    phone?: string;
    totalAmount: number;
    status: string;
    itemCount: number;
    paymentMethod?: string;
    createdAt?: string;
  };
  metricsCard?: {
    title: string;
    value: string | number;
    subtitle?: string;
    highlight?: boolean;
    color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
  }[];
  breakdownCard?: {
    title: string;
    subtitle?: string;
    items: BreakdownItem[];
  };
}

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    InputTextModule,
    TagModule
  ],
  templateUrl: './admin-chatbot.component.html',
  styleUrls: ['./admin-chatbot.component.scss']
})
export class AdminChatbotComponent implements OnInit, OnDestroy {
  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef<HTMLDivElement>;

  private orderService = inject(OrderService);
  private analyticsService = inject(AnalyticsService);
  private productService = inject(ProductService);
  private maintenanceService = inject(MaintenanceService);
  private router = inject(Router);

  // Component State Signals
  isOpen = signal<boolean>(false);
  isVoiceMuted = signal<boolean>(true);
  isSpeaking = signal<boolean>(false);
  isThinking = signal<boolean>(false);
  hasGreeted = signal<boolean>(false);
  unreadCount = signal<number>(1);

  userInput = '';
  messages: ChatMessage[] = [];

  // Live In-Memory Cache
  private recentOrders: Order[] = [];
  private allProducts: Product[] = [];
  private speechSynth: SpeechSynthesis | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private isBrowser = false;

  // Quick Suggestions
  quickSuggestions = [
    { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
    { label: '📦 Last Order', query: 'What is the last order placed?' },
    { label: '🏆 Top Products', query: 'Show top selling products' },
    { label: '📊 Store Overview', query: 'What are the store statistics?' },
    { label: '⚠️ Stock Alerts', query: 'Check low stock and out of stock items' },
    { label: '🗺️ Customer Geography', query: 'Where are our customers from?' },
    { label: '🏢 Out-Sales', query: 'Show recent offline and out-sales' },
    { label: '🧭 Feature Guide', query: 'What features are available in this admin panel?' }
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser && 'speechSynthesis' in window) {
      this.speechSynth = window.speechSynthesis;
      this.initVoices();
    }
    this.refreshAllData();
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
  }

  private initVoices(): void {
    if (!this.speechSynth) return;
    
    const loadVoices = () => {
      this.availableVoices = this.speechSynth?.getVoices() || [];
    };

    loadVoices();
    if (this.speechSynth.onvoiceschanged !== undefined) {
      this.speechSynth.onvoiceschanged = loadVoices;
    }
  }

  private refreshAllData(callback?: () => void): void {
    this.orderService.getOrders(0, 150, true).subscribe({
      next: (orders) => {
        this.recentOrders = [...(orders || [])].sort((a, b) => {
          const timeA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          const timeB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
          return timeB - timeA;
        });
        if (callback) callback();
      },
      error: () => {
        if (callback) callback();
      }
    });

    this.productService.getProducts(0, 500, undefined, true).subscribe({
      next: (products) => {
        this.allProducts = products || [];
      },
      error: () => {}
    });
  }

  toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);

    if (nextState) {
      this.unreadCount.set(0);
      this.refreshAllData(() => {
        if (!this.hasGreeted()) {
          this.triggerWelcomeSequence();
        }
      });
      setTimeout(() => this.scrollToBottom(), 150);
    } else {
      this.stopSpeaking();
    }
  }

  private triggerWelcomeSequence(): void {
    this.hasGreeted.set(true);

    const totalOrders = this.recentOrders.length;
    const lastOrder = this.recentOrders.length > 0 ? this.recentOrders[0] : null;
    const lastCustomer = lastOrder ? (lastOrder.fullName || lastOrder.address?.full_name || 'Customer') : null;

    let welcomeText = `Hello Admin! 👋 I am your **Karukolpo AI Assistant**.\n\n` +
      `• **Orders in Record:** ${totalOrders}\n` +
      (lastOrder ? `• **Latest Order:** #${(lastOrder.id || lastOrder.orderNumber || '').substring(0, 8)} by ${lastCustomer} (৳${(lastOrder.totalAmount || 0).toLocaleString()})\n\n` : `\n`) +
      `Ask me anything about **profits & margins**, **live orders**, **top products**, **stock health**, or **customer geography**!`;

    const welcomeMessage: ChatMessage = {
      id: 'msg_welcome',
      sender: 'bot',
      text: welcomeText,
      timestamp: new Date(),
      actionChips: [
        { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
        { label: '📦 Last Order', query: 'What is the last order placed?' },
        { label: '🏆 Top Products', query: 'Show top selling products' },
        { label: '📊 Store Overview', query: 'Give me store overview metrics' },
        { label: '⚠️ Stock Alerts', query: 'Show out of stock alerts' }
      ]
    };

    this.messages.push(welcomeMessage);
  }

  toggleVoiceMute(): void {
    const muted = !this.isVoiceMuted();
    this.isVoiceMuted.set(muted);
    if (muted) {
      this.stopSpeaking();
    } else {
      const totalOrders = this.recentOrders.length;
      const lastOrder = this.recentOrders.length > 0 ? this.recentOrders[0] : null;
      const lastCustomer = lastOrder ? (lastOrder.fullName || lastOrder.address?.full_name || 'Customer') : null;

      const voiceGreeting = lastOrder
        ? `Welcome back Admin! I am your Karukolpo AI Assistant. You have ${totalOrders} orders tracked. The latest order is from ${lastCustomer} for ${lastOrder.totalAmount} Taka. How can I help you?`
        : `Welcome back Admin! I am your Karukolpo AI Assistant. Ready to provide live profits, store stats, and inventory updates. How can I help you today?`;

      this.speakText(voiceGreeting);
    }
  }

  speakText(text: string): void {
    if (!this.isBrowser || !this.speechSynth || this.isVoiceMuted()) return;

    try {
      this.stopSpeaking();

      // Clean text for natural speech synthesis
      const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '')
        .replace(/[*_#`~৳•]/g, ' ')
        .replace(/BDT/g, 'Taka')
        .replace(/≤/g, 'less than or equal to')
        .replace(/%/g, ' percent')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      if (this.availableVoices.length === 0) {
        this.availableVoices = this.speechSynth.getVoices();
      }

      const preferredVoice = this.availableVoices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel') || v.name.includes('en-US') || v.name.includes('en_US')) && v.lang.startsWith('en')
      ) || this.availableVoices.find(v => v.lang.startsWith('en')) || this.availableVoices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => this.isSpeaking.set(true);
      utterance.onend = () => this.isSpeaking.set(false);
      utterance.onerror = () => {
        this.isSpeaking.set(false);
      };

      if (this.speechSynth.paused) {
        this.speechSynth.resume();
      }

      this.speechSynth.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis failure:', err);
      this.isSpeaking.set(false);
    }
  }

  stopSpeaking(): void {
    if (this.isBrowser && this.speechSynth) {
      try {
        this.speechSynth.cancel();
      } catch {}
      this.isSpeaking.set(false);
    }
  }

  handleSend(): void {
    const query = this.userInput.trim();
    if (!query) return;

    this.addUserMessage(query);
    this.userInput = '';
    this.processQuery(query);
  }

  handleQuickQuery(query: string): void {
    this.addUserMessage(query);
    this.processQuery(query);
  }

  private addUserMessage(text: string): void {
    this.messages.push({
      id: 'msg_' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date()
    });
    this.scrollToBottom();
  }

  private processQuery(query: string): void {
    this.isThinking.set(true);

    this.refreshAllData(() => {
      setTimeout(() => {
        this.executeParsedResponse(query);
      }, 250);
    });
  }

  /**
   * Helper to detect date period from natural language query
   */
  private parsePeriod(query: string): { label: string; periodKey: '7d' | '30d' | '90d' | '1y' | 'all'; startDate: Date; isSingleDay?: boolean } {
    const q = query.toLowerCase();
    const now = new Date();

    if (q.includes('today') || q.includes('আজ')) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { label: 'Today', periodKey: '7d', startDate: today, isSingleDay: true };
    }

    if (q.includes('yesterday') || q.includes('গতকাল')) {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return { label: 'Yesterday', periodKey: '7d', startDate: yesterday, isSingleDay: true };
    }

    if (q.includes('last week') || q.includes('past week') || q.includes('7 days') || q.includes('৭ দিন') || q.includes('গত সপ্তাহ') || q.includes('সপ্তাহের')) {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { label: 'Last 7 Days (Last Week)', periodKey: '7d', startDate: start };
    }

    if (q.includes('last month') || q.includes('this month') || q.includes('30 days') || q.includes('৩০ দিন') || q.includes('গত মাস') || q.includes('মাসের')) {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { label: 'Last 30 Days (Last Month)', periodKey: '30d', startDate: start };
    }

    if (q.includes('90 days') || q.includes('3 months') || q.includes('quarter') || q.includes('৩ মাস')) {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { label: 'Last 90 Days', periodKey: '90d', startDate: start };
    }

    if (q.includes('year') || q.includes('1 year') || q.includes('বছর') || q.includes('365')) {
      const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return { label: 'Past 1 Year', periodKey: '1y', startDate: start };
    }

    // Default period: Last 7 Days if specified or Last 30 Days
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { label: 'Last 7 Days', periodKey: '7d', startDate: start };
  }

  private executeParsedResponse(query: string): void {
    const q = query.toLowerCase();
    this.isThinking.set(false);

    // 1. PROFIT / MARGIN / EARNINGS ANALYSIS (e.g. "profit of last week", "how much profit")
    if (q.includes('profit') || q.includes('margin') || q.includes('লাভ') || q.includes('মার্জিন') || q.includes('net profit') || q.includes('gross profit')) {
      this.respondWithProfit(query);
      return;
    }

    // 2. TOP PRODUCTS / BEST SELLERS
    if (q.includes('top product') || q.includes('best seller') || q.includes('bestseller') || q.includes('top sell') || q.includes('most popular') || q.includes('জনপ্রিয়') || q.includes('বেশি বিক্রি')) {
      this.respondWithTopProducts(query);
      return;
    }

    // 3. CATEGORY PERFORMANCE
    if (q.includes('category') || q.includes('categories') || q.includes('ক্যাটাগরি')) {
      this.respondWithCategoryPerformance(query);
      return;
    }

    // 4. GEOGRAPHY / DISTRICTS / CUSTOMER LOCATIONS
    if (q.includes('geography') || q.includes('district') || q.includes('customer') || q.includes('location') || q.includes('city') || q.includes('area') || q.includes('জেলা') || q.includes('কাস্টমার')) {
      this.respondWithGeographyAndCustomers(query);
      return;
    }

    // 5. OUT-SALES / OFFLINE SALES / STALLS
    if (q.includes('out-sale') || q.includes('outsale') || q.includes('offline') || q.includes('stall') || q.includes('fair') || q.includes('মেলা') || q.includes('অফলাইন')) {
      this.respondWithOutSales();
      return;
    }

    // 6. ORDER STATUSES / SPECIFIC STATUS COUNTS (Pending, Delivered, Cancelled, bKash)
    if (q.includes('pending') || q.includes('delivered') || q.includes('shipped') || q.includes('cancelled') || q.includes('bkash') || q.includes('cod') || q.includes('status count')) {
      this.respondWithOrderStatus(query);
      return;
    }

    // 7. LAST / RECENT ORDER
    if (q.includes('last order') || q.includes('recent order') || q.includes('latest order') || q.includes('শেষ অর্ডার') || q.includes('নতুন অর্ডার') || q.includes('new order')) {
      this.respondWithLastOrder();
      return;
    }

    // 8. BIG VALUE / HIGHEST VALUE ORDER
    if (q.includes('big value') || q.includes('big order') || q.includes('highest') || q.includes('top order') || q.includes('expensive') || q.includes('সবচেয়ে বড়') || q.includes('large order')) {
      this.respondWithBigValueOrders();
      return;
    }

    // 9. OVERVIEW / REVENUE / STATS
    if (q.includes('revenue') || q.includes('overview') || q.includes('stat') || q.includes('sales') || q.includes('income') || q.includes('today') || q.includes('আয়') || q.includes('বিক্রয়')) {
      this.respondWithOverview();
      return;
    }

    // 10. INVENTORY / STOCK ALERTS
    if (q.includes('stock') || q.includes('inventory') || q.includes('out of stock') || q.includes('alert') || q.includes('low stock') || q.includes('মজুদ') || q.includes('স্টক')) {
      this.respondWithInventoryAlerts();
      return;
    }

    // 11. MAINTENANCE MODE
    if (q.includes('maintenance') || q.includes('lockdown') || q.includes('মেইনটেন্যান্স')) {
      this.respondWithMaintenanceStatus();
      return;
    }

    // 12. ADMIN FEATURES & NAVIGATION
    if (q.includes('feature') || q.includes('navigate') || q.includes('menu') || q.includes('help') || q.includes('কী করতে পারি') || q.includes('dashboard') || q.includes('section')) {
      this.respondWithFeatureGuide();
      return;
    }

    // 13. KARUKOLPO & ARTISAN MISSION
    if (q.includes('karukolpo') || q.includes('about') || q.includes('artisan') || q.includes('craft') || q.includes('কারুকল্প') || q.includes('কারুশিল্প') || q.includes('ঐতিহ্য')) {
      this.respondWithKarukolpoStory();
      return;
    }

    // 14. SPECIFIC PRODUCT SEARCH (by product name in catalog)
    const matchingProduct = this.allProducts.find(p => p.name && q.includes(p.name.toLowerCase()));
    if (matchingProduct) {
      this.respondWithSpecificProduct(matchingProduct);
      return;
    }

    // 15. SPECIFIC SEARCH IN ORDERS (Customer Name / Phone / Order Number)
    const matchingOrder = this.recentOrders.find(o => {
      const name = (o.fullName || o.address?.full_name || '').toLowerCase();
      const phone = (o.phoneNumber || o.address?.phone || '').toLowerCase();
      const id = (o.id || o.orderNumber || '').toLowerCase();
      return (name && q.includes(name)) || (phone && q.includes(phone)) || (id && q.includes(id));
    });

    if (matchingOrder) {
      this.respondWithSpecificOrder(matchingOrder);
      return;
    }

    // DEFAULT LIVE SNAPSHOT RESPONSE
    this.respondWithGeneralHelp();
  }

  /**
   * 💰 PROFIT & MARGIN CALCULATOR HANDLER
   */
  private respondWithProfit(query: string): void {
    const period = this.parsePeriod(query);
    
    // Filter orders matching the period
    const matchedOrders = this.recentOrders.filter(o => {
      if (!o.orderDate) return false;
      const orderTime = new Date(o.orderDate).getTime();
      if (period.isSingleDay) {
        return new Date(o.orderDate).toDateString() === period.startDate.toDateString();
      }
      return orderTime >= period.startDate.getTime();
    });

    // Compute Revenue, Estimated Cost of Goods (COGS), and Gross/Net Profit
    let totalRevenue = 0;
    let totalEstimatedCost = 0;
    let totalUnitsSold = 0;

    // Create a product cost map for quick lookup
    const productCostMap = new Map<string, number>();
    for (const prod of this.allProducts) {
      const cost = Number(prod.cost || 0);
      if (prod.id) productCostMap.set(prod.id, cost);
    }

    for (const order of matchedOrders) {
      // Exclude cancelled/refunded orders from profit
      const st = (order.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'refunded') continue;

      totalRevenue += Number(order.totalAmount || 0);

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const qty = Number(item.quantity || 1);
          totalUnitsSold += qty;
          const itemPrice = Number((item as any).unit_price || item.product?.price || 0);
          const prodId = item.product?.id || (item as any).product_id;

          // Get cost: from item.unit_cost -> catalog cost -> fallback 50% COGS
          let costPerUnit = Number((item as any).unit_cost || 0);
          if (!costPerUnit && prodId && productCostMap.has(prodId)) {
            costPerUnit = productCostMap.get(prodId)!;
          }
          if (!costPerUnit && item.product?.cost) {
            costPerUnit = Number(item.product.cost);
          }
          if (!costPerUnit && itemPrice > 0) {
            // Standard artisan craft COGS assumption (50%)
            costPerUnit = itemPrice * 0.5;
          }

          totalEstimatedCost += costPerUnit * qty;
        }
      } else {
        // Order without item breakdown: estimate 50% COGS
        const orderRev = Number(order.totalAmount || 0);
        totalEstimatedCost += orderRev * 0.5;
        totalUnitsSold += 1;
      }
    }

    const netProfit = Math.max(0, Math.round(totalRevenue - totalEstimatedCost));
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const cogsDisplay = Math.round(totalEstimatedCost);

    const text = `💰 **Profit & Margin Analysis (${period.label}):**\n\n` +
      `• **Total Revenue:** **৳${totalRevenue.toLocaleString()}**\n` +
      `• **Estimated Cost of Goods (COGS):** **৳${cogsDisplay.toLocaleString()}**\n` +
      `• **Net Estimated Profit:** **৳${netProfit.toLocaleString()}**\n` +
      `• **Net Profit Margin:** **${profitMargin}%**\n` +
      `• **Valid Orders Count:** **${matchedOrders.length}** (${totalUnitsSold} items)\n\n` +
      `💡 *Note: Costs are calculated from your configured product cost prices, with standard craft margins applied to items missing cost data.*`;

    const spoken = `For ${period.label}, total revenue is ${totalRevenue} Taka with an estimated profit of ${netProfit} Taka, giving a ${profitMargin} percent profit margin.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Net Profit', value: `৳${netProfit.toLocaleString()}`, highlight: true, color: 'emerald', subtitle: `${profitMargin}% Margin` },
        { title: 'Revenue', value: `৳${totalRevenue.toLocaleString()}`, color: 'blue' },
        { title: 'Est. Cost', value: `৳${cogsDisplay.toLocaleString()}`, color: 'amber' },
        { title: 'Orders', value: matchedOrders.length, color: 'purple' }
      ],
      actionChips: [
        { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' },
        { label: '📦 View Orders', route: '/admin/dashboard/orders' },
        { label: '💰 Profit Last 30 Days', query: 'What is the profit of last 30 days?' },
        { label: '🏆 Best Selling Products', query: 'Show top selling products' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏆 TOP PRODUCTS / BEST SELLERS HANDLER
   */
  private respondWithTopProducts(query: string): void {
    const period = this.parsePeriod(query);
    
    this.analyticsService.getTopProducts(period.periodKey, 'revenue', 5).subscribe({
      next: (topProducts) => {
        if (!topProducts || topProducts.length === 0) {
          this.fallbackTopProductsFromOrders(period.label);
          return;
        }

        const maxRev = topProducts[0]?.revenue || 1;
        const breakdownItems: BreakdownItem[] = topProducts.map((p, idx) => ({
          rank: idx + 1,
          name: p.name || 'Handcrafted Product',
          value: `৳${(p.revenue || 0).toLocaleString()}`,
          secondaryValue: `${p.units_sold || 0} sold`,
          percentage: Math.min(100, Math.round(((p.revenue || 0) / maxRev) * 100)),
          color: idx === 0 ? 'emerald' : idx === 1 ? 'blue' : 'purple'
        }));

        const text = `🏆 **Top Selling Products (${period.label}):**\n\n` +
          topProducts.map((p, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•'} **${p.name}** — ৳${(p.revenue || 0).toLocaleString()} (${p.units_sold || 0} units)`).join('\n');

        const topName = topProducts[0]?.name || 'handcraft';
        const spoken = `The best selling product is ${topName}, generating ${topProducts[0]?.revenue || 0} Taka across ${topProducts[0]?.units_sold || 0} sales.`;

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          breakdownCard: {
            title: `Top Products by Revenue (${period.label})`,
            items: breakdownItems
          },
          actionChips: [
            { label: '🔥 Manage Hot Deals', route: '/admin/dashboard/hot-deals' },
            { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' },
            { label: '📈 Analytics', route: '/admin/dashboard/analytics' }
          ]
        };

        this.messages.push(message);
        this.speakText(spoken);
        this.scrollToBottom();
      },
      error: () => {
        this.fallbackTopProductsFromOrders(period.label);
      }
    });
  }

  private fallbackTopProductsFromOrders(periodLabel: string): void {
    // In-memory aggregation of top products from order items
    const productStats = new Map<string, { name: string; revenue: number; qty: number }>();

    for (const order of this.recentOrders) {
      if ((order.status || '').toLowerCase() === 'cancelled') continue;
      for (const item of order.items || []) {
        const name = item.product?.name || (item as any).name || 'Artisan Craft';
        const price = Number((item as any).unit_price || item.product?.price || 0);
        const qty = Number(item.quantity || 1);
        const rev = price * qty;

        const current = productStats.get(name) || { name, revenue: 0, qty: 0 };
        current.revenue += rev;
        current.qty += qty;
        productStats.set(name, current);
      }
    }

    const sorted = Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (sorted.length === 0) {
      this.addBotMessage(`No product sales records found in recent orders. Browse the catalog in Inventory.`, [
        { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' }
      ]);
      return;
    }

    const maxRev = sorted[0].revenue || 1;
    const breakdownItems: BreakdownItem[] = sorted.map((p, idx) => ({
      rank: idx + 1,
      name: p.name,
      value: `৳${p.revenue.toLocaleString()}`,
      secondaryValue: `${p.qty} sold`,
      percentage: Math.min(100, Math.round((p.revenue / maxRev) * 100)),
      color: idx === 0 ? 'emerald' : idx === 1 ? 'blue' : 'purple'
    }));

    const text = `🏆 **Top Products (${periodLabel}):**\n\n` +
      sorted.map((p, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '•'} **${p.name}** — ৳${p.revenue.toLocaleString()} (${p.qty} units)`).join('\n');

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      breakdownCard: {
        title: `Top Selling Products (${periodLabel})`,
        items: breakdownItems
      },
      actionChips: [
        { label: '🔥 Manage Hot Deals', route: '/admin/dashboard/hot-deals' },
        { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' }
      ]
    };

    this.messages.push(message);
    this.speakText(`Top product is ${sorted[0].name} with ${sorted[0].qty} units sold.`);
    this.scrollToBottom();
  }

  /**
   * 📁 CATEGORY PERFORMANCE HANDLER
   */
  private respondWithCategoryPerformance(query: string): void {
    const period = this.parsePeriod(query);

    this.analyticsService.getTopCategories(period.periodKey, 5).subscribe({
      next: (categories) => {
        if (!categories || categories.length === 0) {
          this.addBotMessage(`Category analytics are currently loading. You can manage product categories in Category Manager.`, [
            { label: '📁 Category Manager', route: '/admin/dashboard/category-manager' }
          ]);
          return;
        }

        const maxRev = categories[0]?.revenue || 1;
        const breakdownItems: BreakdownItem[] = categories.map((cat, idx) => ({
          rank: idx + 1,
          name: cat.name || 'Category',
          value: `৳${(cat.revenue || 0).toLocaleString()}`,
          secondaryValue: `${cat.units_sold || 0} units sold`,
          percentage: Math.min(100, Math.round(((cat.revenue || 0) / maxRev) * 100)),
          color: idx === 0 ? 'emerald' : 'blue'
        }));

        const text = `📁 **Top Performing Categories (${period.label}):**\n\n` +
          categories.map((c, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '•'} **${c.name}**: ৳${(c.revenue || 0).toLocaleString()} (${c.units_sold || 0} units sold)`).join('\n');

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          breakdownCard: {
            title: `Category Revenue Distribution (${period.label})`,
            items: breakdownItems
          },
          actionChips: [
            { label: '📁 Category Manager', route: '/admin/dashboard/category-manager' },
            { label: '📈 Full Analytics', route: '/admin/dashboard/analytics' }
          ]
        };

        this.messages.push(message);
        this.speakText(`The leading category is ${categories[0]?.name || 'Crafts'} with ${categories[0]?.revenue || 0} Taka in sales.`);
        this.scrollToBottom();
      },
      error: () => {
        this.addBotMessage(`Could not retrieve category timeseries right now. Please explore Category Manager.`, [
          { label: '📁 Open Categories', route: '/admin/dashboard/category-manager' }
        ]);
      }
    });
  }

  /**
   * 🗺️ GEOGRAPHY & CUSTOMER INSIGHTS HANDLER
   */
  private respondWithGeographyAndCustomers(query: string): void {
    const period = this.parsePeriod(query);

    this.analyticsService.getGeography(period.periodKey, 'district').subscribe({
      next: (geo) => {
        const locations = geo.data || [];
        if (locations.length === 0) {
          this.fallbackGeographyFromOrders();
          return;
        }

        const maxRev = locations[0]?.revenue || 1;
        const totalOrdersInGeo = locations.reduce((sum, l) => sum + (l.orders || 0), 0) || 1;

        const breakdownItems: BreakdownItem[] = locations.slice(0, 5).map((loc, idx) => {
          const pct = Math.round(((loc.orders || 0) / totalOrdersInGeo) * 100);
          return {
            rank: idx + 1,
            name: loc.location || 'District',
            value: `৳${(loc.revenue || 0).toLocaleString()}`,
            secondaryValue: `${loc.orders || 0} orders (${pct}%)`,
            percentage: Math.min(100, Math.round(((loc.revenue || 0) / maxRev) * 100)),
            color: 'blue'
          };
        });

        const topLocation = locations[0]?.location || 'Dhaka';
        const topPct = Math.round(((locations[0]?.orders || 0) / totalOrdersInGeo) * 100);

        const text = `🗺️ **Customer Regional Distribution (${period.label}):**\n\n` +
          `• **Top Order District:** **${topLocation}** (${topPct}% of total volume)\n` +
          `• **Total Active Districts:** **${locations.length}** across Bangladesh\n\n` +
          locations.slice(0, 4).map(l => `• **${l.location}**: ৳${(l.revenue || 0).toLocaleString()} (${l.orders} orders)`).join('\n');

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          breakdownCard: {
            title: `Top Districts by Orders (${period.label})`,
            items: breakdownItems
          },
          actionChips: [
            { label: '📈 Analytics Map', route: '/admin/dashboard/analytics' },
            { label: '📦 View Orders', route: '/admin/dashboard/orders' }
          ]
        };

        this.messages.push(message);
        this.speakText(`Most of your orders originate from ${topLocation} accounting for ${topPct} percent of sales.`);
        this.scrollToBottom();
      },
      error: () => {
        this.fallbackGeographyFromOrders();
      }
    });
  }

  private fallbackGeographyFromOrders(): void {
    const districtMap = new Map<string, { count: number; revenue: number }>();

    for (const order of this.recentOrders) {
      const dist = order.district || order.address?.district || 'Dhaka';
      const cur = districtMap.get(dist) || { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(order.totalAmount || 0);
      districtMap.set(dist, cur);
    }

    const sorted = Array.from(districtMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    if (sorted.length === 0) {
      this.addBotMessage(`No regional order distribution recorded yet.`);
      return;
    }

    const maxCount = sorted[0].count || 1;
    const breakdownItems: BreakdownItem[] = sorted.slice(0, 5).map((d, idx) => ({
      rank: idx + 1,
      name: d.name,
      value: `${d.count} orders`,
      secondaryValue: `৳${d.revenue.toLocaleString()}`,
      percentage: Math.min(100, Math.round((d.count / maxCount) * 100)),
      color: 'blue'
    }));

    const text = `🗺️ **Order District Distribution:**\n\n` +
      sorted.slice(0, 4).map(d => `• **${d.name}**: ${d.count} orders (৳${d.revenue.toLocaleString()})`).join('\n');

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      breakdownCard: {
        title: `Customer Locations`,
        items: breakdownItems
      },
      actionChips: [
        { label: '📦 Orders Manager', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(`Top district is ${sorted[0].name} with ${sorted[0].count} orders.`);
    this.scrollToBottom();
  }

  /**
   * 🏢 OUT-SALES / OFFLINE SALES HANDLER
   */
  private respondWithOutSales(): void {
    const offlineOrders = this.recentOrders.filter(o => (o as any).source === 'offline' || (o as any).is_offline || (o.paymentMethod || '').toLowerCase().includes('offline'));
    const totalOfflineCount = offlineOrders.length;
    const totalOfflineRev = offlineOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const text = `🏢 **Out-Sales & Offline Stalls:**\n\n` +
      `• **Offline Transactions Recorded:** **${totalOfflineCount}**\n` +
      `• **Offline Revenue Volume:** **৳${totalOfflineRev.toLocaleString()}**\n\n` +
      `You can record physical fair and exhibition sales with instant stock deduction directly in Out-Sales.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Offline Sales', value: totalOfflineCount, color: 'blue' },
        { title: 'Offline Revenue', value: `৳${totalOfflineRev.toLocaleString()}`, color: 'emerald', highlight: true }
      ],
      actionChips: [
        { label: '🏢 Record Out-Sale', route: '/admin/dashboard/out-sales' },
        { label: '📦 All Orders', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(`You have recorded ${totalOfflineCount} offline transactions totaling ${totalOfflineRev} Taka.`);
    this.scrollToBottom();
  }

  /**
   * 📦 ORDER STATUS BREAKDOWN HANDLER
   */
  private respondWithOrderStatus(query: string): void {
    const counts = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      bkash: 0,
      cod: 0
    };

    for (const o of this.recentOrders) {
      const st = (o.status || '').toLowerCase();
      if (st.includes('pending')) counts.pending++;
      else if (st.includes('process') || st.includes('confirmed')) counts.processing++;
      else if (st.includes('ship')) counts.shipped++;
      else if (st.includes('deliver') || st.includes('complete')) counts.delivered++;
      else if (st.includes('cancel')) counts.cancelled++;

      const pay = (o.paymentMethod || o.payments?.payment_method || '').toLowerCase();
      if (pay.includes('bkash')) counts.bkash++;
      else if (pay.includes('cod') || pay.includes('cash')) counts.cod++;
    }

    const text = `📦 **Order Status Breakdown:**\n\n` +
      `• **⏳ Pending Confirmation:** **${counts.pending}**\n` +
      `• **⚙️ Processing / Packed:** **${counts.processing}**\n` +
      `• **🚚 Shipped:** **${counts.shipped}**\n` +
      `• **✅ Delivered / Completed:** **${counts.delivered}**\n` +
      `• **❌ Cancelled:** **${counts.cancelled}**\n\n` +
      `**Payment Methods:** bKash (${counts.bkash}), Cash On Delivery (${counts.cod})`;

    const spoken = `You have ${counts.pending} pending orders, ${counts.processing} processing, and ${counts.delivered} delivered orders.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Pending', value: counts.pending, color: 'amber', highlight: counts.pending > 0 },
        { title: 'Processing', value: counts.processing, color: 'blue' },
        { title: 'Delivered', value: counts.delivered, color: 'emerald' },
        { title: 'Cancelled', value: counts.cancelled, color: 'rose' }
      ],
      actionChips: [
        { label: '📦 Orders Manager', route: '/admin/dashboard/orders' },
        { label: '⏳ Filter Pending', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏷️ SPECIFIC PRODUCT DETAILS HANDLER
   */
  private respondWithSpecificProduct(product: Product): void {
    const price = Number(product.price || 0);
    const cost = Number(product.cost || 0);
    const margin = price > 0 && cost > 0 ? (price - cost) : 0;
    const marginPct = price > 0 && cost > 0 ? ((margin / price) * 100).toFixed(1) : null;
    const stock = product.stock !== undefined ? product.stock : (product.isInStock ? 'In Stock' : 'Out of Stock');
    const isHot = product.isHotDeal ? '🔥 Hot Deal' : '';
    const isBest = product.isBestSeller ? '⭐ Best Seller' : '';
    const catName = product.categories && product.categories.length > 0 ? (product.categories[0].name || product.categories[0]) : '';

    const text = `🏷️ **Product Details: ${product.name}**\n\n` +
      `• **Selling Price:** **৳${price.toLocaleString()}**\n` +
      (cost > 0 ? `• **Cost Price:** ৳${cost.toLocaleString()} (Margin: **৳${margin.toLocaleString()}** / **${marginPct}%**)\n` : '') +
      `• **Stock Status:** **${stock} units**\n` +
      (catName ? `• **Category:** ${catName}\n` : '') +
      (isHot || isBest ? `• **Tags:** ${[isHot, isBest].filter(Boolean).join(', ')}\n` : '');

    const spoken = `${product.name} is priced at ${price} Taka with ${stock} in stock.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Price', value: `৳${price.toLocaleString()}`, color: 'blue', highlight: true },
        { title: 'Stock', value: stock, color: Number(stock) <= 5 ? 'rose' : 'emerald' },
        ...(cost > 0 ? [{ title: 'Margin', value: `${marginPct}%`, color: 'emerald' as const }] : [])
      ],
      actionChips: [
        { label: '✏️ Edit Product', route: `/admin/dashboard/products/edit/${product.id}` },
        { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithLastOrder(): void {
    if (!this.recentOrders || this.recentOrders.length === 0) {
      const text = `I checked the live backend records, but there are no orders placed yet.`;
      this.addBotMessage(text);
      this.speakText(`There are no orders found in the database.`);
      return;
    }

    const lastOrder = this.recentOrders[0];
    const customerName = lastOrder.fullName || lastOrder.address?.full_name || 'Customer';
    const phone = lastOrder.phoneNumber || lastOrder.address?.phone || '';
    const district = lastOrder.district || lastOrder.address?.district || '';
    const totalAmount = lastOrder.totalAmount || 0;
    const status = lastOrder.status || 'Pending';
    const itemCount = lastOrder.items?.length || 1;
    const paymentMethod = lastOrder.paymentMethod || lastOrder.payments?.payment_method || 'COD';
    const orderDate = lastOrder.orderDate ? new Date(lastOrder.orderDate).toLocaleString() : 'Recent';
    const orderId = lastOrder.id || lastOrder.orderNumber || 'ORD-NEW';

    const itemsSummary = (lastOrder.items || []).map(i => `${i.product?.name || (i as any).name || 'Product'} (×${i.quantity || 1})`).join(', ');

    const text = `📦 **Latest Order Details:**\n` +
      `• **Order ID:** #${orderId.substring(0, 8)}...\n` +
      `• **Customer:** **${customerName}** ${phone ? '(' + phone + ')' : ''}\n` +
      `• **Location:** ${district || 'Bangladesh'}\n` +
      `• **Items (${itemCount}):** ${itemsSummary || 'Handcrafted items'}\n` +
      `• **Total Amount:** **৳${totalAmount.toLocaleString()}**\n` +
      `• **Payment:** ${paymentMethod}\n` +
      `• **Status:** ${status.toUpperCase()}\n` +
      `• **Placed at:** ${orderDate}`;

    const spoken = `The latest order is from ${customerName} in ${district || 'Dhaka'}, with ${itemCount} items totaling ${totalAmount} Taka. Status is ${status}.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      orderCard: {
        id: orderId,
        customerName,
        phone,
        totalAmount,
        status,
        itemCount,
        paymentMethod,
        createdAt: orderDate
      },
      actionChips: [
        { label: '🔎 Open Order in Manager', route: '/admin/dashboard/orders' },
        { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
        { label: '💎 Big Value Orders', query: 'Show highest value orders' },
        { label: '📊 Today Stats', query: 'Show store statistics' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithBigValueOrders(): void {
    if (!this.recentOrders || this.recentOrders.length === 0) {
      this.addBotMessage(`No order records found to compute high-value orders.`);
      return;
    }

    const sorted = [...this.recentOrders].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));

    const topOrder = sorted[0];
    const topAmount = topOrder.totalAmount || 0;
    const topCustomer = topOrder.fullName || topOrder.address?.full_name || 'Customer';
    const topOrderId = topOrder.id || topOrder.orderNumber || 'ORD-TOP';
    const topDate = topOrder.orderDate ? new Date(topOrder.orderDate).toLocaleDateString() : '';

    let text = `💎 **Highest Value Orders in Store:**\n\n` +
      `🥇 **#1 Top Order:** **৳${topAmount.toLocaleString()}**\n` +
      `• Customer: **${topCustomer}**\n` +
      `• Order ID: #${topOrderId.substring(0, 8)}...\n` +
      `• Status: ${topOrder.status?.toUpperCase() || 'COMPLETED'}\n`;

    if (sorted.length > 1) {
      const second = sorted[1];
      const secondCustomer = second.fullName || second.address?.full_name || 'Customer';
      text += `\n🥈 **#2 Order:** ৳${(second.totalAmount || 0).toLocaleString()} (${secondCustomer})`;
    }

    if (sorted.length > 2) {
      const third = sorted[2];
      const thirdCustomer = third.fullName || third.address?.full_name || 'Customer';
      text += `\n🥉 **#3 Order:** ৳${(third.totalAmount || 0).toLocaleString()} (${thirdCustomer})`;
    }

    const spoken = `The largest order is from ${topCustomer} valued at ${topAmount} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      orderCard: {
        id: topOrderId,
        customerName: topCustomer,
        totalAmount: topAmount,
        status: topOrder.status || 'Completed',
        itemCount: topOrder.items?.length || 1,
        createdAt: topDate
      },
      actionChips: [
        { label: '📦 Open Orders Manager', route: '/admin/dashboard/orders' },
        { label: '📈 View Revenue Analytics', route: '/admin/dashboard/analytics' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithOverview(): void {
    this.analyticsService.getOverview('30d').subscribe({
      next: (overview) => {
        const revenue = overview.total_revenue || 0;
        const totalOrders = overview.total_orders || this.recentOrders.length || 0;
        const avgOrder = overview.average_order_value || (totalOrders > 0 ? Math.round(revenue / totalOrders) : 0);
        const customers = overview.active_customers || 0;

        const todayStr = new Date().toDateString();
        const todayOrders = this.recentOrders.filter(o => o.orderDate && new Date(o.orderDate).toDateString() === todayStr);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        const text = `📊 **Live Store Performance Metrics:**\n\n` +
          `• **Today's Orders:** **${todayOrders.length}** (৳${todayRevenue.toLocaleString()})\n` +
          `• **30-Day Revenue:** **৳${revenue.toLocaleString()}**\n` +
          `• **30-Day Orders:** **${totalOrders}**\n` +
          `• **Average Order Value:** **৳${avgOrder.toLocaleString()}**\n` +
          (customers > 0 ? `• **Active Customers:** ${customers}` : '');

        const spoken = `Today you have ${todayOrders.length} orders totaling ${todayRevenue} Taka. Over the last 30 days, total revenue is ${revenue} Taka across ${totalOrders} orders.`;

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          metricsCard: [
            { title: "Today's Sales", value: `৳${todayRevenue.toLocaleString()}`, highlight: true, color: 'emerald' },
            { title: '30D Revenue', value: `৳${revenue.toLocaleString()}`, color: 'blue' },
            { title: 'Total Orders', value: totalOrders, color: 'purple' },
            { title: 'Avg Order', value: `৳${avgOrder.toLocaleString()}`, color: 'amber' }
          ],
          actionChips: [
            { label: '💰 Profit Analysis', query: 'What is the profit of last week?' },
            { label: '📈 Deep Analytics', route: '/admin/dashboard/analytics' },
            { label: '📦 Orders List', route: '/admin/dashboard/orders' }
          ]
        };

        this.messages.push(message);
        this.speakText(spoken);
        this.scrollToBottom();
      },
      error: () => {
        const totalOrders = this.recentOrders.length;
        const totalRev = this.recentOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const avg = totalOrders > 0 ? Math.round(totalRev / totalOrders) : 0;

        const text = `📊 **Live Order Records Summary:**\n` +
          `• **Total Orders Tracked:** **${totalOrders}**\n` +
          `• **Total Revenue Volume:** **৳${totalRev.toLocaleString()}**\n` +
          `• **Average Order Value:** **৳${avg.toLocaleString()}**`;

        const spoken = `Total recorded orders count is ${totalOrders}, with total volume of ${totalRev} Taka.`;

        this.addBotMessage(text, [
          { label: '📈 Full Analytics', route: '/admin/dashboard/analytics' },
          { label: '📦 Orders Manager', route: '/admin/dashboard/orders' }
        ]);
        this.speakText(spoken);
      }
    });
  }

  private respondWithInventoryAlerts(): void {
    if (this.allProducts.length === 0) {
      this.productService.getProducts(0, 500, undefined, true).subscribe({
        next: (products) => {
          this.allProducts = products || [];
          this.calculateInventoryAlerts();
        },
        error: () => {
          this.addBotMessage(`Could not retrieve real-time inventory. Please check the Inventory Management page.`, [
            { label: '📦 Open Inventory', route: '/admin/dashboard/inventory' }
          ]);
        }
      });
    } else {
      this.calculateInventoryAlerts();
    }
  }

  private calculateInventoryAlerts(): void {
    const outOfStock = this.allProducts.filter(p => {
      if (p.manualStockStatus === 'OUT_OF_STOCK') return true;
      if (p.manualStockStatus === 'IN_STOCK') return false;
      return !p.isInStock || (p.stock !== undefined && p.stock <= 0);
    });

    const lowStock = this.allProducts.filter(p => {
      const isAvailable = p.manualStockStatus === 'IN_STOCK' || (p.manualStockStatus !== 'OUT_OF_STOCK' && (p.isInStock || (p.stock !== undefined && p.stock > 0)));
      return isAvailable && p.stock !== undefined && p.stock > 0 && p.stock <= 5;
    });

    let text = `📦 **Accurate Inventory Health:**\n\n` +
      `• **Total Products:** **${this.allProducts.length}**\n` +
      `• **Out of Stock Items:** **${outOfStock.length}**\n` +
      `• **Low Stock Alert (≤ 5 units):** **${lowStock.length}**`;

    if (outOfStock.length > 0) {
      const oosNames = outOfStock.slice(0, 4).map(p => `• "${p.name}" (৳${p.price})`).join('\n');
      text += `\n\n⚠️ **Out of Stock Products:**\n${oosNames}${outOfStock.length > 4 ? `\n...and ${outOfStock.length - 4} more` : ''}`;
    }

    if (lowStock.length > 0) {
      const lowNames = lowStock.slice(0, 4).map(p => `• "${p.name}" (${p.stock} left)`).join('\n');
      text += `\n\n🟡 **Low Stock (Restock Needed):**\n${lowNames}${lowStock.length > 4 ? `\n...and ${lowStock.length - 4} more` : ''}`;
    }

    const spoken = `You have ${this.allProducts.length} products in your catalog. ${outOfStock.length} items are out of stock, and ${lowStock.length} items have low stock.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Total Catalog', value: this.allProducts.length, color: 'blue' },
        { title: 'Out of Stock', value: outOfStock.length, highlight: outOfStock.length > 0, color: 'rose' },
        { title: 'Low Stock (≤5)', value: lowStock.length, color: 'amber' }
      ],
      actionChips: [
        { label: '🔍 Manage Inventory', route: '/admin/dashboard/inventory' },
        { label: '➕ Add Product', route: '/admin/dashboard/products/add' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithMaintenanceStatus(): void {
    const currentStatus = this.maintenanceService.status();
    const isEnabled = currentStatus.enabled;
    const text = isEnabled
      ? `🔴 **Maintenance Mode is ACTIVE.** Customer store access is currently restricted with the maintenance banner.`
      : `🟢 **Maintenance Mode is OFF.** The store is live and accepting customer orders.`;

    const spoken = isEnabled ? `Maintenance mode is active.` : `Store is fully live. Maintenance mode is off.`;

    this.addBotMessage(text, [
      { label: '⚙️ Maintenance Controls', route: '/admin/dashboard/maintenance-control' }
    ]);
    this.speakText(spoken);
  }

  private respondWithFeatureGuide(): void {
    const text = `🧭 **Karukolpo Admin Control Center Guide:**\n\n` +
      `• **📦 Orders:** Real-time customer orders, bKash/COD tracking, status updates, invoices.\n` +
      `• **📊 Analytics:** Revenue graphs, customer geography, top selling items, profit margins.\n` +
      `• **🏷️ Inventory:** Real-time stock counts, bilingual search (Bangla & English), unit edits, cost prices.\n` +
      `• **🔥 Hot Deals & Best Sellers:** Curation for the homepage carousel.\n` +
      `• **📁 Categories:** Category creation and custom banners.\n` +
      `• **🏢 Out-Sales:** Physical stall and exhibition sales recording.\n` +
      `• **⚙️ Maintenance:** One-click store lockdown.`;

    const spoken = `Here is an overview of all admin panel features. Click any button below to navigate directly there.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      actionChips: [
        { label: '📦 Orders', route: '/admin/dashboard/orders' },
        { label: '📊 Analytics', route: '/admin/dashboard/analytics' },
        { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' },
        { label: '🔥 Hot Deals', route: '/admin/dashboard/hot-deals' },
        { label: '📁 Categories', route: '/admin/dashboard/category-manager' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithKarukolpoStory(): void {
    const totalOrders = this.recentOrders.length;
    const text = `🎨 **About Karukolpo (কারুশিল্প ঐতিহ্য):**\n\n` +
      `Karukolpo is a premier platform dedicated to preserving Bangladesh's ancient handcraft heritage by connecting rural artisans directly with customers worldwide.\n\n` +
      `• **Artisan Impact:** Supports traditional weavers, terracotta clay artists, brass masters, and Nakshi Kantha craftspeople.\n` +
      `• **Catalog Breadth:** **${this.allProducts.length}** unique items currently curated.\n` +
      `• **Store Activity:** **${totalOrders}** orders processed through this admin panel.\n` +
      `• **Admin Role:** Manage fair artisan compensation, verify secure bKash & COD transactions, and showcase heritage collections on the storefront.`;

    const spoken = `Karukolpo is dedicated to preserving authentic Bangladeshi handcraft culture, connecting rural heritage artisans with customers. You have ${this.allProducts.length} products in the collection.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      actionChips: [
        { label: '🏷️ Browse Inventory', route: '/admin/dashboard/inventory' },
        { label: '📁 Category Manager', route: '/admin/dashboard/category-manager' },
        { label: '🔥 Hot Deals', route: '/admin/dashboard/hot-deals' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithSpecificOrder(order: Order): void {
    const customerName = order.fullName || order.address?.full_name || 'Customer';
    const totalAmount = order.totalAmount || 0;
    const status = order.status || 'Pending';
    const orderId = order.id || order.orderNumber || 'ORD';

    const text = `🔍 **Matching Order Found:**\n` +
      `• **Customer:** ${customerName}\n` +
      `• **Order ID:** #${orderId}\n` +
      `• **Total:** ৳${totalAmount.toLocaleString()}\n` +
      `• **Status:** ${status.toUpperCase()}\n` +
      `• **Date:** ${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'Recent'}`;

    const spoken = `Found order for ${customerName}, valued at ${totalAmount} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      orderCard: {
        id: orderId,
        customerName,
        phone: order.phoneNumber || order.address?.phone,
        totalAmount,
        status,
        itemCount: order.items?.length || 1,
        createdAt: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : undefined
      },
      actionChips: [
        { label: '📦 Open In Orders', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private respondWithGeneralHelp(): void {
    const totalOrders = this.recentOrders.length;
    const totalRev = this.recentOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const outOfStock = this.allProducts.filter(p => p.manualStockStatus === 'OUT_OF_STOCK' || (!p.isInStock && p.manualStockStatus !== 'IN_STOCK') || (p.stock !== undefined && p.stock <= 0)).length;
    const isMaintenanceOn = this.maintenanceService.status().enabled;

    const text = `🌿 **Karukolpo Store & Admin Snapshot:**\n\n` +
      `• **Total Orders Recorded:** **${totalOrders}** orders (Total Volume: **৳${totalRev.toLocaleString()}**)\n` +
      `• **Active Catalog:** **${this.allProducts.length}** handcrafted products (${outOfStock} currently out of stock)\n` +
      `• **Store Status:** ${isMaintenanceOn ? '🔴 Maintenance Mode Active' : '🟢 Live & Accepting Orders'}\n\n` +
      `**Admin Features Overview:**\n` +
      `• **Orders:** Manage customer deliveries, verify bKash TrxIDs, and print branded PDF invoices.\n` +
      `• **Inventory:** Edit stock counts, update pricing & cost price, and search in both Bangla & English.\n` +
      `• **Analytics:** Inspect sales graphs, profit margins, and revenue growth.\n` +
      `• **Curated Promotions:** Control homepage Hot Deals & Best Seller carousels.\n` +
      `• **Out-Sales:** Log offline pop-up and heritage fair transactions.`;

    const spoken = `Here is Karukolpo's store snapshot. You have ${totalOrders} orders totaling ${totalRev} Taka, and ${this.allProducts.length} handcrafted products in your catalog. All admin tools are operating normally.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Orders Count', value: totalOrders, highlight: true, color: 'blue' },
        { title: 'Catalog Items', value: this.allProducts.length, color: 'emerald' },
        { title: 'Out of Stock', value: outOfStock, highlight: outOfStock > 0, color: 'rose' }
      ],
      actionChips: [
        { label: '💰 Profit of Last Week', query: 'What is the profit of last week?' },
        { label: '🏆 Top Products', query: 'Show top selling products' },
        { label: '📦 Orders Manager', route: '/admin/dashboard/orders' },
        { label: '🏷️ Inventory Control', route: '/admin/dashboard/inventory' },
        { label: '📊 Store Analytics', route: '/admin/dashboard/analytics' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  private addBotMessage(text: string, actionChips?: { label: string; route?: string; query?: string }[]): void {
    this.messages.push({
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      actionChips
    });
    this.scrollToBottom();
  }

  handleChipClick(chip: { label: string; route?: string; query?: string }): void {
    if (chip.route) {
      this.router.navigateByUrl(chip.route);
      if (window.innerWidth < 768) {
        this.isOpen.set(false);
      }
    } else if (chip.query) {
      this.handleQuickQuery(chip.query);
    }
  }

  navigateToOrder(orderId: string): void {
    this.router.navigate(['/admin/dashboard/orders'], { queryParams: { highlight: orderId } });
    if (window.innerWidth < 768) {
      this.isOpen.set(false);
    }
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
        if (this.chatScrollContainer) {
          this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
        }
      }, 50);
    } catch {}
  }
}
