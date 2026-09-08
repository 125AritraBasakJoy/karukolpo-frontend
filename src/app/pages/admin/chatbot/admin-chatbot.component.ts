import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order/order.service';
import { AnalyticsService } from '../../../core/services/analytics/analytics.service';
import { ProductService } from '../../../core/services/product/product.service';
import { CategoryService } from '../../../core/services/category/category.service';
import { MaintenanceService } from '../../../core/services/maintenance/maintenance.service';
import { OutSalesService } from '../../../core/services/out-sales/out-sales.service';
import { Order } from '../../../models/order.model';
import { Product } from '../../../models/product.model';
import { Category } from '../../../models/category.model';
import * as Models from '../../../models/analytics.model';

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
  private categoryService = inject(CategoryService);
  private maintenanceService = inject(MaintenanceService);
  private outSalesService = inject(OutSalesService);
  private router = inject(Router);

  // Component State Signals
  isOpen = signal<boolean>(false);
  isVoiceMuted = signal<boolean>(true);
  isSpeaking = signal<boolean>(false);
  isListening = signal<boolean>(false);
  speechRecognitionSupported = signal<boolean>(false);
  isThinking = signal<boolean>(false);
  hasGreeted = signal<boolean>(false);
  unreadCount = signal<number>(1);

  userInput = '';
  messages: ChatMessage[] = [];

  // Live In-Memory Cache from all Admin tables
  private recentOrders: Order[] = [];
  private allProducts: Product[] = [];
  private allCategories: Category[] = [];
  private offlineSales: Order[] = [];
  private speechSynth: SpeechSynthesis | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private recognition: any = null;
  private isBrowser = false;

  // Quick Suggestions
  quickSuggestions = [
    { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
    { label: '📦 Last Order', query: 'What is the last order placed?' },
    { label: '🏷️ Inventory Valuation', query: 'What is our total inventory asset value?' },
    { label: '🏆 Top Products', query: 'Show top selling products' },
    { label: '📁 All Categories', query: 'Show all categories in our store' },
    { label: '⚠️ Out of Stock', query: 'Show out of stock and low stock items' },
    { label: '🏢 Out-Sales Summary', query: 'Show offline and out-sales summary' },
    { label: '🗺️ Customer Geography', query: 'Where are our customers from?' },
    { label: '⏳ Pending Orders', query: 'How many pending orders need action?' },
    { label: '📊 Today vs 30D Sales', query: 'Give me today and 30 days sales overview' }
  ];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      if ('speechSynthesis' in window) {
        this.speechSynth = window.speechSynthesis;
        this.initVoices();
      }
      this.initSpeechRecognition();
    }
    this.refreshAllData();
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
  }

  private initSpeechRecognition(): void {
    if (!this.isBrowser) return;

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isListening.set(true);
        };

        this.recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            this.userInput = transcript;
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          this.isListening.set(false);
        };

        this.recognition.onend = () => {
          this.isListening.set(false);
          const query = this.userInput.trim();
          if (query) {
            // Automatically unmute voice so the assistant speaks the answer back
            this.isVoiceMuted.set(false);
            this.handleSend();
          }
        };

        this.speechRecognitionSupported.set(true);
      } catch (err) {
        console.warn('Could not initialize speech recognition:', err);
      }
    }
  }

  toggleVoiceInput(): void {
    if (!this.recognition) return;

    if (this.isListening()) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening.set(false);
    } else {
      this.stopSpeaking();
      this.userInput = '';
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
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

  /**
   * Synchronizes data across all Karukolpo Admin Tables:
   * Orders, Products (Inventory), Categories, Out-Sales, and Maintenance.
   */
  private refreshAllData(callback?: () => void): void {
    forkJoin({
      orders: this.orderService.getOrders(0, 200, true).pipe(catchError(() => of([]))),
      products: this.productService.getProducts(0, 500, undefined, true).pipe(catchError(() => of([]))),
      categories: this.categoryService.getCategories(0, 100).pipe(catchError(() => of([]))),
      outSales: this.outSalesService.listSales(0, 100).pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        // 1. Orders Table
        this.recentOrders = [...(res.orders || [])].sort((a, b) => {
          const timeA = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          const timeB = b.orderDate ? new Date(b.orderDate).getTime() : 0;
          return timeB - timeA;
        });

        // 2. Inventory / Products Table
        this.allProducts = res.products || [];

        // 3. Category Table
        this.allCategories = res.categories || [];

        // 4. Out-Sales Table
        this.offlineSales = res.outSales || [];

        if (callback) callback();
      },
      error: () => {
        if (callback) callback();
      }
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
    const totalInventoryItems = this.allProducts.length;
    const totalCategoriesCount = this.allCategories.length;

    let welcomeText = `Hello Admin! 👋 I am your **Karukolpo Live Intelligence Assistant**.\n\n` +
      `• **📦 Orders in Record:** **${totalOrders}** orders\n` +
      `• **🏷️ Inventory Catalog:** **${totalInventoryItems}** handcrafted products\n` +
      `• **📁 Categories Active:** **${totalCategoriesCount}** categories\n` +
      (lastOrder ? `• **🔥 Latest Order:** #${(lastOrder.id || lastOrder.orderNumber || '').substring(0, 8)} by ${lastCustomer} (৳${(lastOrder.totalAmount || 0).toLocaleString()})\n\n` : `\n`) +
      `I can answer **anything** about your store by reading your live **Dashboard, Orders, Inventory, Categories, Analytics, and Out-Sales** in real-time!`;

    const welcomeMessage: ChatMessage = {
      id: 'msg_welcome',
      sender: 'bot',
      text: welcomeText,
      timestamp: new Date(),
      actionChips: [
        { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
        { label: '📦 Last Order', query: 'What is the last order placed?' },
        { label: '🏷️ Inventory Value', query: 'What is our total inventory asset value?' },
        { label: '🏆 Best Sellers', query: 'Show top selling products' },
        { label: '📁 Categories', query: 'Show all categories' }
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
      const totalCatalog = this.allProducts.length;
      const lastOrder = this.recentOrders.length > 0 ? this.recentOrders[0] : null;
      const lastCustomer = lastOrder ? (lastOrder.fullName || lastOrder.address?.full_name || 'Customer') : null;

      const voiceGreeting = lastOrder
        ? `Welcome back Admin! I am connected to your live Karukolpo database. You have ${totalOrders} orders tracked and ${totalCatalog} products in catalog. The latest order is from ${lastCustomer} for ${lastOrder.totalAmount} Taka. What would you like to check?`
        : `Welcome back Admin! I am connected to your Karukolpo store tables. Ready to analyze orders, inventory, profits, categories, and sales. How can I help?`;

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

  /**
   * Universal Dispatcher: Answers any inquiry regarding Karukolpo Admin
   */
  private executeParsedResponse(query: string): void {
    const q = query.toLowerCase();
    this.isThinking.set(false);

    // 1. PROFIT / MARGIN / EARNINGS ANALYSIS
    if (q.includes('profit') || q.includes('margin') || q.includes('লাভ') || q.includes('মার্জিন') || q.includes('net profit') || q.includes('gross profit')) {
      this.respondWithProfit(query);
      return;
    }

    // 2. INVENTORY ASSET VALUE / VALUATION
    if (q.includes('asset value') || q.includes('valuation') || q.includes('inventory value') || q.includes('stock value') || q.includes('টাকার মাল') || q.includes('সম্পদ মূল্য') || (q.includes('cost') && q.includes('total'))) {
      this.respondWithInventoryValuation();
      return;
    }

    // 3. LAST / RECENT / LATEST ORDER
    if (q.includes('last order') || q.includes('recent order') || q.includes('latest order') || q.includes('শেষ অর্ডার') || q.includes('নতুন অর্ডার') || q.includes('new order') || q.includes('last sell') || q.includes('recent sale')) {
      this.respondWithLastOrder();
      return;
    }

    // 4. TOTAL SALES / REVENUE / SELLS VALUE
    if (q.includes('total sales') || q.includes('total sells') || q.includes('selles value') || q.includes('sales value') || q.includes('total revenue') || q.includes('সর্বমোট বিক্রি') || q.includes('মোট বিক্রি') || q.includes('how much sell') || q.includes('how much sales')) {
      this.respondWithTotalSalesValue(query);
      return;
    }

    // 5. PENDING / UNCONFIRMED ORDERS
    if (q.includes('pending') || q.includes('অপেক্ষারত') || q.includes('need action') || q.includes('processing') || q.includes('unconfirmed')) {
      this.respondWithPendingOrders();
      return;
    }

    // 6. ORDER STATUSES BREAKDOWN & PAYMENT METHODS (bKash vs COD)
    if (q.includes('status') || q.includes('delivered') || q.includes('shipped') || q.includes('cancelled') || q.includes('bkash') || q.includes('cod') || q.includes('cash on delivery') || q.includes('পেমেন্ট')) {
      this.respondWithOrderStatus(query);
      return;
    }

    // 7. BIG VALUE / HIGHEST VALUE ORDERS
    if (q.includes('big value') || q.includes('big order') || q.includes('highest') || q.includes('top order') || q.includes('expensive order') || q.includes('সবচেয়ে বড়') || q.includes('large order')) {
      this.respondWithBigValueOrders();
      return;
    }

    // 8. CATEGORY TABLE & PERFORMANCE
    if (q.includes('category') || q.includes('categories') || q.includes('ক্যাটাগরি') || q.includes('all categories') || q.includes('category list')) {
      this.respondWithCategoryPerformance(query);
      return;
    }

    // 9. TOP PRODUCTS / BEST SELLERS
    if (q.includes('top product') || q.includes('best seller') || q.includes('bestseller') || q.includes('top sell') || q.includes('most popular') || q.includes('জনপ্রিয়') || q.includes('বেশি বিক্রি') || q.includes('hot deal')) {
      this.respondWithTopProducts(query);
      return;
    }

    // 10. INVENTORY HEALTH, STOCK & OUT OF STOCK ALERTS
    if (q.includes('stock') || q.includes('inventory') || q.includes('out of stock') || q.includes('alert') || q.includes('low stock') || q.includes('মজুদ') || q.includes('স্টক') || q.includes('zero stock')) {
      this.respondWithInventoryAlerts();
      return;
    }

    // 11. CHEAPEST / MOST EXPENSIVE ITEM IN CATALOG
    if (q.includes('cheapest') || q.includes('lowest price') || q.includes('expensive product') || q.includes('highest price') || q.includes('কম দাম') || q.includes('বেশি দাম')) {
      this.respondWithPriceExtremes();
      return;
    }

    // 12. OUT-SALES / OFFLINE SALES / FAIRS / STALLS
    if (q.includes('out-sale') || q.includes('outsale') || q.includes('out sale') || q.includes('offline') || q.includes('stall') || q.includes('fair') || q.includes('মেলা') || q.includes('অফলাইন')) {
      this.respondWithOutSales();
      return;
    }

    // 13. SLOW MOVERS / DEAD STOCK
    if (q.includes('slow mover') || q.includes('slow moving') || q.includes('dead stock') || q.includes('কম বিক্রি') || q.includes('slow')) {
      this.respondWithSlowMovers();
      return;
    }

    // 14. CUSTOMER GEOGRAPHY & DISTRICTS
    if (q.includes('geography') || q.includes('district') || q.includes('customer') || q.includes('location') || q.includes('city') || q.includes('area') || q.includes('জেলা') || q.includes('কাস্টমার')) {
      this.respondWithGeographyAndCustomers(query);
      return;
    }

    // 15. TRAFFIC & MARKETING ANALYTICS
    if (q.includes('traffic') || q.includes('visitor') || q.includes('device') || q.includes('marketing') || q.includes('landing page') || q.includes('source') || q.includes('ভিজিটর')) {
      this.respondWithTrafficAnalytics();
      return;
    }

    // 16. MAINTENANCE MODE STATUS
    if (q.includes('maintenance') || q.includes('lockdown') || q.includes('মেইনটেন্যান্স')) {
      this.respondWithMaintenanceStatus();
      return;
    }

    // 17. ADMIN HOW-TO & OPERATIONAL GUIDES
    if (q.includes('how to') || q.includes('how do i') || q.includes('how can i') || q.includes('guide') || q.includes('help') || q.includes('কীভাবে') || q.includes('feature') || q.includes('menu')) {
      this.respondWithAdminHowToGuide(query);
      return;
    }

    // 18. KARUKOLPO HERITAGE & MISSION
    if (q.includes('karukolpo') || q.includes('about') || q.includes('artisan') || q.includes('craft') || q.includes('কারুকল্প') || q.includes('কারুশিল্প') || q.includes('ঐতিহ্য')) {
      this.respondWithKarukolpoStory();
      return;
    }

    // 19. SEARCH BY SPECIFIC PRODUCT NAME IN CATALOG
    const matchingProduct = this.allProducts.find(p => p.name && q.includes(p.name.toLowerCase()));
    if (matchingProduct) {
      this.respondWithSpecificProduct(matchingProduct);
      return;
    }

    // 20. SEARCH IN ORDERS BY CUSTOMER NAME, PHONE, OR ORDER ID
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

    // 21. DEFAULT COMPREHENSIVE EXECUTIVE DASHBOARD SNAPSHOT
    this.respondWithOverview();
  }

  /**
   * 💰 PROFIT & MARGIN CALCULATOR
   * Uses real cost price from catalog / item unit_cost
   */
  private respondWithProfit(query: string): void {
    const period = this.parsePeriod(query);
    
    // Filter orders matching period
    const matchedOrders = this.recentOrders.filter(o => {
      if (!o.orderDate) return false;
      const orderTime = new Date(o.orderDate).getTime();
      if (period.isSingleDay) {
        return new Date(o.orderDate).toDateString() === period.startDate.toDateString();
      }
      return orderTime >= period.startDate.getTime();
    });

    let totalRevenue = 0;
    let totalEstimatedCost = 0;
    let totalUnitsSold = 0;

    const productCostMap = new Map<string, number>();
    for (const prod of this.allProducts) {
      const cost = Number(prod.cost || 0);
      if (prod.id) productCostMap.set(prod.id, cost);
    }

    for (const order of matchedOrders) {
      const st = (order.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'refunded') continue;

      totalRevenue += Number(order.totalAmount || 0);

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const qty = Number(item.quantity || 1);
          totalUnitsSold += qty;
          const itemPrice = Number((item as any).unit_price || item.product?.price || 0);
          const prodId = item.product?.id || (item as any).product_id;

          let costPerUnit = Number((item as any).unit_cost || 0);
          if (!costPerUnit && prodId && productCostMap.has(prodId)) {
            costPerUnit = productCostMap.get(prodId)!;
          }
          if (!costPerUnit && item.product?.cost) {
            costPerUnit = Number(item.product.cost);
          }
          if (!costPerUnit && itemPrice > 0) {
            costPerUnit = itemPrice * 0.5; // fallback 50% artisan craft COGS
          }

          totalEstimatedCost += costPerUnit * qty;
        }
      } else {
        const orderRev = Number(order.totalAmount || 0);
        totalEstimatedCost += orderRev * 0.5;
        totalUnitsSold += 1;
      }
    }

    const netProfit = Math.max(0, Math.round(totalRevenue - totalEstimatedCost));
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const cogsDisplay = Math.round(totalEstimatedCost);

    const text = `💰 **Profit & Margin Intelligence (${period.label}):**\n\n` +
      `• **Total Sales Revenue:** **৳${totalRevenue.toLocaleString()}**\n` +
      `• **Cost of Goods Sold (COGS):** **৳${cogsDisplay.toLocaleString()}**\n` +
      `• **Net Estimated Profit:** **৳${netProfit.toLocaleString()}**\n` +
      `• **Profit Margin:** **${profitMargin}%**\n` +
      `• **Completed Orders:** **${matchedOrders.length}** (${totalUnitsSold} items delivered/recorded)\n\n` +
      `💡 *Calculated directly from product unit costs set in your Inventory.*`;

    const spoken = `For ${period.label}, total sales revenue is ${totalRevenue} Taka with net profit of ${netProfit} Taka, achieving a ${profitMargin} percent profit margin.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Net Profit', value: `৳${netProfit.toLocaleString()}`, highlight: true, color: 'emerald', subtitle: `${profitMargin}% Margin` },
        { title: 'Sales Revenue', value: `৳${totalRevenue.toLocaleString()}`, color: 'blue' },
        { title: 'Product COGS', value: `৳${cogsDisplay.toLocaleString()}`, color: 'amber' },
        { title: 'Orders Count', value: matchedOrders.length, color: 'purple' }
      ],
      actionChips: [
        { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' },
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' },
        { label: '🏷️ Inventory Asset Value', query: 'What is our total inventory asset value?' },
        { label: '🏆 Top Selling Products', query: 'Show top selling products' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏷️ INVENTORY VALUATION (Cost Asset vs Retail Value)
   */
  private respondWithInventoryValuation(): void {
    let totalUnits = 0;
    let totalCostAssetValue = 0;
    let totalRetailValue = 0;
    let productsWithCost = 0;

    for (const prod of this.allProducts) {
      const stock = Number(prod.stock || 0);
      const price = Number(prod.price || 0);
      const cost = Number(prod.cost || 0);

      if (stock > 0) {
        totalUnits += stock;
        totalRetailValue += price * stock;
        if (cost > 0) {
          totalCostAssetValue += cost * stock;
          productsWithCost++;
        } else {
          // Estimated 50% cost if unconfigured
          totalCostAssetValue += (price * 0.5) * stock;
        }
      }
    }

    const potentialGrossProfit = Math.max(0, Math.round(totalRetailValue - totalCostAssetValue));
    const potentialMargin = totalRetailValue > 0 ? ((potentialGrossProfit / totalRetailValue) * 100).toFixed(1) : '0.0';

    const text = `🏷️ **Inventory Valuation & Asset Intelligence:**\n\n` +
      `• **Total Handcrafted Items on Hand:** **${totalUnits.toLocaleString()} units** across **${this.allProducts.length}** catalog SKUs\n` +
      `• **Total Asset Cost Value:** **৳${Math.round(totalCostAssetValue).toLocaleString()}** (Cost to acquire/craft)\n` +
      `• **Total Retail Market Value:** **৳${Math.round(totalRetailValue).toLocaleString()}** (Expected revenue upon sale)\n` +
      `• **Potential Warehouse Gross Profit:** **৳${potentialGrossProfit.toLocaleString()}** (~${potentialMargin}% margin)\n\n` +
      `📊 *${productsWithCost} of ${this.allProducts.length} products have explicit cost prices configured in Inventory.*`;

    const spoken = `You have ${totalUnits} total units in stock. The total cost asset value is ${Math.round(totalCostAssetValue)} Taka, with a total retail value of ${Math.round(totalRetailValue)} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Asset Cost Value', value: `৳${Math.round(totalCostAssetValue).toLocaleString()}`, highlight: true, color: 'emerald' },
        { title: 'Retail Valuation', value: `৳${Math.round(totalRetailValue).toLocaleString()}`, color: 'blue' },
        { title: 'Units in Stock', value: totalUnits.toLocaleString(), color: 'purple' },
        { title: 'Catalog SKUs', value: this.allProducts.length, color: 'amber' }
      ],
      actionChips: [
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' },
        { label: '⚠️ Out of Stock Items', query: 'Show out of stock and low stock items' },
        { label: '💰 Profit Analysis', query: 'What is the profit of last week?' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 📦 LAST / MOST RECENT ORDER
   */
  private respondWithLastOrder(): void {
    if (!this.recentOrders || this.recentOrders.length === 0) {
      this.addBotMessage(`There are currently no orders found in the database.`, [
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
      ]);
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
    const paymentMethod = lastOrder.paymentMethod || lastOrder.payments?.payment_method || 'Cash on Delivery';
    const orderDate = lastOrder.orderDate ? new Date(lastOrder.orderDate).toLocaleString() : 'Recent';
    const orderId = lastOrder.id || lastOrder.orderNumber || 'ORD-NEW';

    const itemsSummary = (lastOrder.items || []).map(i => `${i.product?.name || (i as any).name || 'Product'} (×${i.quantity || 1})`).join(', ');

    const text = `📦 **Latest Recorded Order:**\n\n` +
      `• **Order ID:** #${orderId.substring(0, 8)}...\n` +
      `• **Customer:** **${customerName}** ${phone ? '(' + phone + ')' : ''}\n` +
      `• **Destination:** ${district || 'Bangladesh'}\n` +
      `• **Items (${itemCount}):** ${itemsSummary || 'Handcrafted heritage items'}\n` +
      `• **Total Value:** **৳${totalAmount.toLocaleString()}**\n` +
      `• **Payment:** ${paymentMethod}\n` +
      `• **Current Status:** **${status.toUpperCase()}**\n` +
      `• **Timestamp:** ${orderDate}`;

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
        { label: '🔎 Open In Orders Table', route: '/admin/dashboard/orders' },
        { label: '⏳ Pending Orders', query: 'Show pending orders' },
        { label: '💰 Profit Analysis', query: 'What is the profit of last week?' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 📊 TOTAL SALES VALUE & REVENUE SUMMARY
   */
  private respondWithTotalSalesValue(query: string): void {
    const period = this.parsePeriod(query);
    const now = new Date();
    const todayStr = now.toDateString();

    const allValidOrders = this.recentOrders.filter(o => (o.status || '').toLowerCase() !== 'cancelled');
    const totalAllTimeSales = allValidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const todayOrders = allValidOrders.filter(o => o.orderDate && new Date(o.orderDate).toDateString() === todayStr);
    const todaySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const avgOrderVal = allValidOrders.length > 0 ? Math.round(totalAllTimeSales / allValidOrders.length) : 0;

    // Offline sales sum
    const totalOfflineSales = this.offlineSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const text = `📊 **Karukolpo Total Sales & Revenue Summary:**\n\n` +
      `• **Total Lifetime Sales Value:** **৳${totalAllTimeSales.toLocaleString()}** (${allValidOrders.length} valid orders)\n` +
      `• **Today's Sales Value:** **৳${todaySales.toLocaleString()}** (${todayOrders.length} orders)\n` +
      `• **Average Order Value (AOV):** **৳${avgOrderVal.toLocaleString()}**\n` +
      (totalOfflineSales > 0 ? `• **Offline Out-Sales Volume:** **৳${totalOfflineSales.toLocaleString()}** (${this.offlineSales.length} fair/stall orders)\n` : '') +
      `\n💡 *Online & offline sales records are synced with your live database.*`;

    const spoken = `Total lifetime sales value is ${totalAllTimeSales} Taka across ${allValidOrders.length} orders. Today's sales stand at ${todaySales} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Total Sales Value', value: `৳${totalAllTimeSales.toLocaleString()}`, highlight: true, color: 'emerald' },
        { title: "Today's Sales", value: `৳${todaySales.toLocaleString()}`, color: 'blue', subtitle: `${todayOrders.length} orders` },
        { title: 'Total Orders', value: allValidOrders.length, color: 'purple' },
        { title: 'Average Order', value: `৳${avgOrderVal.toLocaleString()}`, color: 'amber' }
      ],
      actionChips: [
        { label: '💰 Profit of Last Week', query: 'What is the profit of last week?' },
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' },
        { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' },
        { label: '🏢 Out-Sales Table', route: '/admin/dashboard/out-sales' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * ⏳ PENDING & UNCONFIRMED ORDERS
   */
  private respondWithPendingOrders(): void {
    const pendingOrders = this.recentOrders.filter(o => {
      const st = (o.status || '').toLowerCase();
      return st === 'pending' || st === 'created' || st.includes('process');
    });

    const pendingRevenue = pendingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    if (pendingOrders.length === 0) {
      const text = `🎉 **All Clear!** There are **0 pending orders** waiting for confirmation right now. All orders are processed or completed!`;
      this.addBotMessage(text, [
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
      ]);
      this.speakText(`There are no pending orders waiting for action. All orders are up to date.`);
      return;
    }

    const previewList = pendingOrders.slice(0, 4).map(o => {
      const name = o.fullName || o.address?.full_name || 'Customer';
      const id = (o.id || o.orderNumber || '').substring(0, 8);
      const dist = o.district || o.address?.district || 'Bangladesh';
      return `• **#${id}** by **${name}** (${dist}) — ৳${(o.totalAmount || 0).toLocaleString()} [${o.status?.toUpperCase()}]`;
    }).join('\n');

    const text = `⏳ **Pending Orders Needing Attention:**\n\n` +
      `• **Total Pending:** **${pendingOrders.length} orders** (Value: **৳${pendingRevenue.toLocaleString()}**)\n\n` +
      `${previewList}${pendingOrders.length > 4 ? `\n...and ${pendingOrders.length - 4} more orders` : ''}\n\n` +
      `👉 Go to Orders Manager to confirm delivery addresses and update statuses.`;

    const spoken = `You have ${pendingOrders.length} pending orders waiting for confirmation, worth ${pendingRevenue} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Pending Orders', value: pendingOrders.length, highlight: true, color: 'amber' },
        { title: 'Pending Value', value: `৳${pendingRevenue.toLocaleString()}`, color: 'emerald' },
        { title: 'Total Orders', value: this.recentOrders.length, color: 'blue' }
      ],
      actionChips: [
        { label: '📦 Go to Orders Table', route: '/admin/dashboard/orders' },
        { label: '📦 Last Order Details', query: 'Show last order placed' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 📁 CATEGORY TABLE INTELLIGENCE
   */
  private respondWithCategoryPerformance(query: string): void {
    const totalCategories = this.allCategories.length;
    const catBreakdown: BreakdownItem[] = this.allCategories.map((c, idx) => ({
      rank: idx + 1,
      name: c.name || 'Category',
      value: `${c.products?.length || 0} items`,
      secondaryValue: c.slug,
      percentage: 100,
      color: idx === 0 ? 'emerald' : idx === 1 ? 'blue' : 'purple'
    }));

    // Check uncategorized items
    const uncategorized = this.allProducts.filter(p => !p.categories || p.categories.length === 0);

    const text = `📁 **Category Management Intelligence:**\n\n` +
      `• **Total Active Categories:** **${totalCategories}**\n` +
      `• **Uncategorized Products:** **${uncategorized.length}** products\n\n` +
      `**Category Directory:**\n` +
      this.allCategories.map(c => `• **${c.name}** (\`${c.slug}\`)`).join('\n') +
      `\n\n💡 *Manage category banners and organize catalog in Category Manager.*`;

    const spoken = `You have ${totalCategories} categories active in your store, including ${this.allCategories.slice(0, 3).map(c => c.name).join(', ')}.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      breakdownCard: {
        title: `Store Categories (${totalCategories} Total)`,
        items: catBreakdown.slice(0, 6)
      },
      actionChips: [
        { label: '📁 Category Manager', route: '/admin/dashboard/category-manager' },
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' },
        { label: '🏆 Best Selling Products', query: 'Show top selling products' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏆 TOP PRODUCTS / BEST SELLERS
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
        const spoken = `The best selling product is ${topName}, generating ${topProducts[0]?.revenue || 0} Taka in sales.`;

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
            { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' },
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
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' }
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
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' }
      ]
    };

    this.messages.push(message);
    this.speakText(`Top product is ${sorted[0].name} with ${sorted[0].qty} units sold.`);
    this.scrollToBottom();
  }

  /**
   * ⚠️ INVENTORY ALERTS (Out of stock & Low stock)
   */
  private respondWithInventoryAlerts(): void {
    const outOfStock = this.allProducts.filter(p => {
      if (p.manualStockStatus === 'OUT_OF_STOCK') return true;
      if (p.manualStockStatus === 'IN_STOCK') return false;
      return !p.isInStock || (p.stock !== undefined && p.stock <= 0);
    });

    const lowStock = this.allProducts.filter(p => {
      const isAvailable = p.manualStockStatus === 'IN_STOCK' || (p.manualStockStatus !== 'OUT_OF_STOCK' && (p.isInStock || (p.stock !== undefined && p.stock > 0)));
      return isAvailable && p.stock !== undefined && p.stock > 0 && p.stock <= 5;
    });

    let text = `📦 **Inventory Health & Stock Alerts:**\n\n` +
      `• **Total Products in Catalog:** **${this.allProducts.length}**\n` +
      `• **Out of Stock Items:** **${outOfStock.length}**\n` +
      `• **Low Stock Alerts (≤ 5 units):** **${lowStock.length}**`;

    if (outOfStock.length > 0) {
      const oosNames = outOfStock.slice(0, 4).map(p => `• "${p.name}" (৳${p.price})`).join('\n');
      text += `\n\n⚠️ **Out of Stock Items:**\n${oosNames}${outOfStock.length > 4 ? `\n...and ${outOfStock.length - 4} more` : ''}`;
    }

    if (lowStock.length > 0) {
      const lowNames = lowStock.slice(0, 4).map(p => `• "${p.name}" (${p.stock} units left)`).join('\n');
      text += `\n\n🟡 **Low Stock (Restock Needed):**\n${lowNames}${lowStock.length > 4 ? `\n...and ${lowStock.length - 4} more` : ''}`;
    }

    const spoken = `You have ${this.allProducts.length} products. ${outOfStock.length} items are out of stock, and ${lowStock.length} items have low stock.`;

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
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' },
        { label: '➕ Add New Product', route: '/admin/dashboard/products/add' },
        { label: '🏷️ Total Asset Value', query: 'What is our total inventory asset value?' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 💎 PRICE EXTREMES (Cheapest vs Most Expensive)
   */
  private respondWithPriceExtremes(): void {
    if (this.allProducts.length === 0) {
      this.addBotMessage(`Catalog is empty.`);
      return;
    }

    const validProds = this.allProducts.filter(p => Number(p.price || 0) > 0);
    const sorted = [...validProds].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));

    const mostExpensive = sorted[0];
    const cheapest = sorted[sorted.length - 1];

    const text = `💎 **Product Pricing Range:**\n\n` +
      `• **Most Expensive Item:** **"${mostExpensive.name}"** — **৳${Number(mostExpensive.price).toLocaleString()}** (Stock: ${mostExpensive.stock})\n` +
      `• **Most Affordable Item:** **"${cheapest.name}"** — **৳${Number(cheapest.price).toLocaleString()}** (Stock: ${cheapest.stock})\n\n` +
      `You can adjust prices and cost margins anytime from the Inventory table.`;

    const spoken = `The highest priced product is ${mostExpensive.name} at ${mostExpensive.price} Taka, and the most affordable is ${cheapest.name} at ${cheapest.price} Taka.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Highest Price', value: `৳${Number(mostExpensive.price).toLocaleString()}`, color: 'purple', subtitle: mostExpensive.name },
        { title: 'Lowest Price', value: `৳${Number(cheapest.price).toLocaleString()}`, color: 'emerald', subtitle: cheapest.name }
      ],
      actionChips: [
        { label: '🏷️ Open Inventory', route: '/admin/dashboard/inventory' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏢 OUT-SALES / OFFLINE SALES SUMMARY
   */
  private respondWithOutSales(): void {
    const totalCount = this.offlineSales.length;
    const totalRev = this.offlineSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

    const text = `🏢 **Out-Sales & Offline Fair Intelligence:**\n\n` +
      `• **Offline Stall Sales Recorded:** **${totalCount} transactions**\n` +
      `• **Total Offline Revenue Volume:** **৳${totalRev.toLocaleString()}**\n\n` +
      `Out-sales automatically deduct physical inventory stock and support address & buyer info.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Offline Sales', value: totalCount, color: 'blue' },
        { title: 'Offline Revenue', value: `৳${totalRev.toLocaleString()}`, color: 'emerald', highlight: true }
      ],
      actionChips: [
        { label: '🏢 Record Out-Sale', route: '/admin/dashboard/out-sales' },
        { label: '📦 All Orders Table', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(`You have recorded ${totalCount} offline fair transactions totaling ${totalRev} Taka.`);
    this.scrollToBottom();
  }

  /**
   * 🐢 SLOW MOVERS & DEAD STOCK
   */
  private respondWithSlowMovers(): void {
    this.analyticsService.getInventorySlowMovers('30d').subscribe({
      next: (res) => {
        const prods = res.products || [];
        if (prods.length === 0) {
          this.addBotMessage(`Great news! No critical dead stock or slow movers detected.`);
          return;
        }

        const items: BreakdownItem[] = prods.slice(0, 5).map((p: any, idx: number) => ({
          rank: idx + 1,
          name: p.name || 'Product',
          value: `${p.on_hand || 0} on hand`,
          secondaryValue: `${p.units_sold || 0} sold`,
          percentage: Math.min(100, (p.sell_through_pct || 0)),
          color: 'amber'
        }));

        const text = `🐢 **Slow Moving Products (Last 30 Days):**\n\n` +
          prods.slice(0, 4).map((p: any) => `• **${p.name}**: ${p.on_hand} in stock, only ${p.units_sold} sold (${p.sell_through_pct || 0}% sell-through)`).join('\n') +
          `\n\n💡 *Tip: Consider adding slow moving items to Hot Deals or discounts.*`;

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          breakdownCard: {
            title: 'Slow Movers & Stock on Hand',
            items
          },
          actionChips: [
            { label: '🔥 Add to Hot Deals', route: '/admin/dashboard/hot-deals' },
            { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' }
          ]
        };

        this.messages.push(message);
        this.speakText(`You have ${prods.length} slow moving items in inventory.`);
        this.scrollToBottom();
      },
      error: () => {
        this.addBotMessage(`Could not fetch slow movers from analytics.`);
      }
    });
  }

  /**
   * 🗺️ GEOGRAPHY & CUSTOMER DISTRIBUTION
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
          `• **Active Districts:** **${locations.length}** across Bangladesh\n\n` +
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
            { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
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
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(`Top district is ${sorted[0].name} with ${sorted[0].count} orders.`);
    this.scrollToBottom();
  }

  /**
   * 🌐 TRAFFIC & VISITOR ANALYTICS
   */
  private respondWithTrafficAnalytics(): void {
    this.analyticsService.getTrafficOverview('30d').subscribe({
      next: (traffic) => {
        const sessions = traffic.total_sessions || 0;
        const bounceRate = traffic.bounce_rate !== undefined ? `${traffic.bounce_rate}%` : 'N/A';
        const avgDuration = traffic.avg_session_duration !== undefined ? `${traffic.avg_session_duration}s` : 'N/A';

        const text = `🌐 **Store Traffic & Visitor Analytics (Last 30 Days):**\n\n` +
          `• **Total Sessions:** **${sessions.toLocaleString()}**\n` +
          `• **Bounce Rate:** **${bounceRate}**\n` +
          `• **Avg. Session Duration:** **${avgDuration}**\n\n` +
          `View live visitor streams and device attribution on the Analytics page.`;

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          metricsCard: [
            { title: 'Total Sessions', value: sessions.toLocaleString(), color: 'blue', highlight: true },
            { title: 'Bounce Rate', value: bounceRate, color: 'amber' },
            { title: 'Avg Duration', value: avgDuration, color: 'emerald' }
          ],
          actionChips: [
            { label: '📈 Live Traffic Stream', route: '/admin/dashboard/analytics' }
          ]
        };

        this.messages.push(message);
        this.speakText(`Over the last 30 days, Karukolpo recorded ${sessions} visitor sessions with a ${bounceRate} bounce rate.`);
        this.scrollToBottom();
      },
      error: () => {
        this.addBotMessage(`Could not fetch traffic analytics right now.`, [
          { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' }
        ]);
      }
    });
  }

  /**
   * 📦 ORDER STATUS BREAKDOWN
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
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' },
        { label: '⏳ Filter Pending', query: 'Show pending orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 💎 BIGGEST / HIGHEST VALUE ORDERS
   */
  private respondWithBigValueOrders(): void {
    if (!this.recentOrders || this.recentOrders.length === 0) {
      this.addBotMessage(`No order records found.`);
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

    const spoken = `The largest purchase in record is from ${topCustomer} valued at ${topAmount} Taka.`;

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
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' },
        { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🏷️ SPECIFIC PRODUCT DETAILS
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
        { title: 'Selling Price', value: `৳${price.toLocaleString()}`, color: 'blue', highlight: true },
        { title: 'Stock Left', value: stock, color: Number(stock) <= 5 ? 'rose' : 'emerald' },
        ...(cost > 0 ? [{ title: 'Profit Margin', value: `${marginPct}%`, color: 'emerald' as const }] : [])
      ],
      actionChips: [
        { label: '✏️ Edit Product', route: `/admin/dashboard/products/edit/${product.id}` },
        { label: '🏷️ Inventory Table', route: '/admin/dashboard/inventory' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * 🔍 SPECIFIC MATCHED ORDER
   */
  private respondWithSpecificOrder(order: Order): void {
    const customerName = order.fullName || order.address?.full_name || 'Customer';
    const totalAmount = order.totalAmount || 0;
    const status = order.status || 'Pending';
    const orderId = order.id || order.orderNumber || 'ORD';

    const text = `🔍 **Matching Order Found:**\n\n` +
      `• **Customer:** **${customerName}**\n` +
      `• **Order ID:** #${orderId}\n` +
      `• **Total Value:** **৳${totalAmount.toLocaleString()}**\n` +
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
        { label: '📦 Open In Orders Table', route: '/admin/dashboard/orders' }
      ]
    };

    this.messages.push(message);
    this.speakText(spoken);
    this.scrollToBottom();
  }

  /**
   * ⚙️ MAINTENANCE MODE
   */
  private respondWithMaintenanceStatus(): void {
    const isEnabled = this.maintenanceService.status().enabled;
    const text = isEnabled
      ? `🔴 **Maintenance Mode is currently ACTIVE.** Storefront is locked and showing the maintenance banner.`
      : `🟢 **Maintenance Mode is OFF.** The store is live and accepting customer orders normally.`;

    const spoken = isEnabled ? `Maintenance mode is active.` : `Store is live. Maintenance mode is off.`;

    this.addBotMessage(text, [
      { label: '⚙️ Maintenance Controls', route: '/admin/dashboard/maintenance-control' }
    ]);
    this.speakText(spoken);
  }

  /**
   * 🧭 ADMIN HOW-TO & CAPABILITIES
   */
  private respondWithAdminHowToGuide(query: string): void {
    const q = query.toLowerCase();

    if (q.includes('cost price') || q.includes('cost')) {
      this.addBotMessage(`💡 **How to configure Product Cost Price:**\n1. Go to **Inventory** or **Edit Product**.\n2. In the pricing card, enter the **Cost Price** (what you paid to acquire/craft the item).\n3. Click **Save Changes**. The bot will immediately use it to calculate live net profit and margins!`, [
        { label: '🏷️ Open Inventory', route: '/admin/dashboard/inventory' }
      ]);
      return;
    }

    if (q.includes('add product') || q.includes('new product')) {
      this.addBotMessage(`💡 **How to add a new Product:**\n1. Go to **Add Product** from the sidebar or click below.\n2. Fill in the title, description (bilingual Bangla/English), price, cost price, and stock.\n3. Upload high-res images and select categories.\n4. Click **Publish Product**.`, [
        { label: '➕ Add Product Page', route: '/admin/dashboard/products/add' }
      ]);
      return;
    }

    if (q.includes('invoice') || q.includes('receipt') || q.includes('print')) {
      this.addBotMessage(`💡 **How to download or print an Invoice:**\n1. Open **Orders Manager**.\n2. Locate the order and click the **Invoice** icon or action button.\n3. A branded Karukolpo PDF invoice with customer details and barcodes will be generated instantly.`, [
        { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
      ]);
      return;
    }

    // General feature guide
    const text = `🧭 **Karukolpo Admin Capabilities Guide:**\n\n` +
      `• **📦 Orders:** Track customer purchases, confirm bKash payments, manage shipping, print invoices.\n` +
      `• **🏷️ Inventory:** Manage stock units, cost prices, selling prices, and Bangla/English catalog search.\n` +
      `• **📊 Analytics:** Real-time revenue timeseries, profit margin calculations, geographic distribution.\n` +
      `• **📁 Categories:** Organize product collections and configure homepage banners.\n` +
      `• **🔥 Hot Deals & Best Sellers:** Control customer homepage highlight carousels.\n` +
      `• **🏢 Out-Sales:** Record physical fair and exhibition transactions with stock auto-deduction.`;

    this.addBotMessage(text, [
      { label: '📦 Orders', route: '/admin/dashboard/orders' },
      { label: '🏷️ Inventory', route: '/admin/dashboard/inventory' },
      { label: '📊 Analytics', route: '/admin/dashboard/analytics' },
      { label: '📁 Categories', route: '/admin/dashboard/category-manager' }
    ]);
  }

  /**
   * 🎨 KARUKOLPO HERITAGE & MISSION
   */
  private respondWithKarukolpoStory(): void {
    const text = `🎨 **Karukolpo (কারুশিল্প ঐতিহ্য):**\n\n` +
      `Karukolpo is a premier platform dedicated to preserving Bangladesh's ancient handcraft heritage by connecting rural artisans directly with customers worldwide.\n\n` +
      `• **Artisan Impact:** Supports traditional weavers, terracotta clay artists, brass masters, and Nakshi Kantha craftspeople.\n` +
      `• **Catalog Breadth:** **${this.allProducts.length}** unique items currently curated.\n` +
      `• **Store Activity:** **${this.recentOrders.length}** orders processed through this admin panel.`;

    const spoken = `Karukolpo is dedicated to preserving authentic Bangladeshi handcraft culture, connecting rural heritage artisans with customers. You have ${this.allProducts.length} products in the collection.`;

    this.addBotMessage(text, [
      { label: '🏷️ Browse Inventory', route: '/admin/dashboard/inventory' },
      { label: '📁 Category Manager', route: '/admin/dashboard/category-manager' }
    ]);
    this.speakText(spoken);
  }

  /**
   * 📊 OVERVIEW & EXECUTIVE SUMMARY
   */
  private respondWithOverview(): void {
    this.analyticsService.getOverview('30d').subscribe({
      next: (overview) => {
        const revenue = overview.total_revenue || 0;
        const totalOrders = overview.total_orders || this.recentOrders.length || 0;
        const avgOrder = overview.average_order_value || (totalOrders > 0 ? Math.round(revenue / totalOrders) : 0);

        const todayStr = new Date().toDateString();
        const todayOrders = this.recentOrders.filter(o => o.orderDate && new Date(o.orderDate).toDateString() === todayStr);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const outOfStock = this.allProducts.filter(p => p.manualStockStatus === 'OUT_OF_STOCK' || (!p.isInStock && p.manualStockStatus !== 'IN_STOCK') || (p.stock !== undefined && p.stock <= 0)).length;

        const text = `📊 **Executive Store Snapshot:**\n\n` +
          `• **Today's Sales:** **৳${todayRevenue.toLocaleString()}** (${todayOrders.length} orders)\n` +
          `• **30-Day Sales Revenue:** **৳${revenue.toLocaleString()}** (${totalOrders} orders)\n` +
          `• **Average Order Value (AOV):** **৳${avgOrder.toLocaleString()}**\n` +
          `• **Catalog Status:** **${this.allProducts.length}** items (${outOfStock} out of stock)\n` +
          `• **Categories Active:** **${this.allCategories.length}** categories\n\n` +
          `Ask me specific questions like *"What is the profit of last week?"*, *"What is our inventory asset value?"*, or *"Show last order"*!`;

        const spoken = `Here is your store snapshot. Today's sales stand at ${todayRevenue} Taka across ${todayOrders.length} orders. Over the last 30 days, total revenue is ${revenue} Taka.`;

        const message: ChatMessage = {
          id: 'msg_' + Date.now(),
          sender: 'bot',
          text,
          timestamp: new Date(),
          metricsCard: [
            { title: "Today's Sales", value: `৳${todayRevenue.toLocaleString()}`, highlight: true, color: 'emerald' },
            { title: '30D Revenue', value: `৳${revenue.toLocaleString()}`, color: 'blue' },
            { title: 'Total Orders', value: totalOrders, color: 'purple' },
            { title: 'Catalog Items', value: this.allProducts.length, color: 'amber' }
          ],
          actionChips: [
            { label: '💰 Last Week Profit', query: 'What is the profit of last week?' },
            { label: '🏷️ Inventory Value', query: 'What is our total inventory asset value?' },
            { label: '📦 Orders Table', route: '/admin/dashboard/orders' },
            { label: '📈 Analytics Dashboard', route: '/admin/dashboard/analytics' }
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

        this.addBotMessage(text, [
          { label: '📈 Full Analytics', route: '/admin/dashboard/analytics' },
          { label: '📦 Orders Table', route: '/admin/dashboard/orders' }
        ]);
        this.speakText(`Total recorded orders count is ${totalOrders}, with total volume of ${totalRev} Taka.`);
      }
    });
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
