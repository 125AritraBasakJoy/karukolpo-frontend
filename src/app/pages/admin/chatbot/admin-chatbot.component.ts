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
  }[];
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
  isVoiceMuted = signal<boolean>(false);
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
    { label: '📦 Last Order', query: 'What is the last order placed?' },
    { label: '💎 Big Value Orders', query: 'Show me the highest value orders' },
    { label: '📊 Store Revenue & Stats', query: 'What are the store statistics?' },
    { label: '⚠️ Stock Alerts', query: 'Check low stock and out of stock items' },
    { label: '🧭 Feature Guide', query: 'What features are available in this admin panel?' },
    { label: '🔧 Maintenance Status', query: 'Is maintenance mode currently enabled?' }
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
    this.orderService.getOrders(0, 100, true).subscribe({
      next: (orders) => {
        // Sort orders descending by date
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
      `Ask me anything about **live orders**, **highest value sales**, **stock alerts**, or **admin features**!`;

    const welcomeMessage: ChatMessage = {
      id: 'msg_welcome',
      sender: 'bot',
      text: welcomeText,
      timestamp: new Date(),
      actionChips: [
        { label: '📦 Last Order', query: 'What is the last order placed?' },
        { label: '💎 Big Value Orders', query: 'Show me the highest value orders' },
        { label: '📊 Store Overview', query: 'Give me store overview metrics' },
        { label: '⚠️ Stock Alerts', query: 'Show out of stock alerts' }
      ]
    };

    this.messages.push(welcomeMessage);

    // Speak welcome out loud automatically
    const voiceGreeting = lastOrder
      ? `Welcome back Admin! I am your Karukolpo AI Assistant. You have ${totalOrders} orders tracked. The latest order is from ${lastCustomer} for ${lastOrder.totalAmount} Taka. How can I help you?`
      : `Welcome back Admin! I am your Karukolpo AI Assistant. Ready to provide live store stats, high value orders, and stock updates.`;

    this.speakText(voiceGreeting);
  }

  toggleVoiceMute(): void {
    const muted = !this.isVoiceMuted();
    this.isVoiceMuted.set(muted);
    if (muted) {
      this.stopSpeaking();
    } else {
      this.speakText('Voice output enabled.');
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
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select natural English voice if available
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
      utterance.onerror = (e) => {
        console.warn('TTS playback error:', e);
        this.isSpeaking.set(false);
      };

      // Unpause/resume speech engine in Chrome
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

    // Refresh context data first to ensure 100% accurate live numbers
    this.refreshAllData(() => {
      setTimeout(() => {
        this.executeParsedResponse(query);
      }, 300);
    });
  }

  private executeParsedResponse(query: string): void {
    const q = query.toLowerCase();
    this.isThinking.set(false);

    // 1. LAST ORDER
    if (q.includes('last order') || q.includes('recent order') || q.includes('latest order') || q.includes('শেষ অর্ডার') || q.includes('নতুন অর্ডার') || q.includes('new order')) {
      this.respondWithLastOrder();
      return;
    }

    // 2. BIG VALUE / HIGHEST VALUE ORDER
    if (q.includes('big value') || q.includes('big order') || q.includes('highest') || q.includes('top order') || q.includes('expensive') || q.includes('সবচেয়ে বড়') || q.includes('large order')) {
      this.respondWithBigValueOrders();
      return;
    }

    // 3. OVERVIEW / REVENUE / STATS / TODAY
    if (q.includes('revenue') || q.includes('overview') || q.includes('stat') || q.includes('sales') || q.includes('income') || q.includes('today') || q.includes('আয়') || q.includes('বিক্রয়')) {
      this.respondWithOverview();
      return;
    }

    // 4. INVENTORY / STOCK ALERTS
    if (q.includes('stock') || q.includes('inventory') || q.includes('out of stock') || q.includes('alert') || q.includes('low stock') || q.includes('মজুদ') || q.includes('স্টক')) {
      this.respondWithInventoryAlerts();
      return;
    }

    // 5. MAINTENANCE MODE
    if (q.includes('maintenance') || q.includes('lockdown') || q.includes('মেইনটেন্যান্স')) {
      this.respondWithMaintenanceStatus();
      return;
    }

    // 6. ADMIN FEATURES & NAVIGATION
    if (q.includes('feature') || q.includes('navigate') || q.includes('menu') || q.includes('help') || q.includes('কী করতে পারি') || q.includes('dashboard') || q.includes('section')) {
      this.respondWithFeatureGuide();
      return;
    }

    // 7. KARUKOLPO & ARTISAN MISSION
    if (q.includes('karukolpo') || q.includes('about') || q.includes('artisan') || q.includes('craft') || q.includes('কারুকল্প') || q.includes('কারুশিল্প') || q.includes('ঐতিহ্য')) {
      this.respondWithKarukolpoStory();
      return;
    }

    // 8. SPECIFIC SEARCH IN ORDERS (Customer Name / Phone / Order Number)
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

    // Sort orders by total amount descending
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

        // Calculate Today's orders from live buffer
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
            { title: "Today's Sales", value: `৳${todayRevenue.toLocaleString()}`, highlight: true },
            { title: '30D Revenue', value: `৳${revenue.toLocaleString()}` },
            { title: 'Total Orders', value: totalOrders },
            { title: 'Avg Order', value: `৳${avgOrder.toLocaleString()}` }
          ],
          actionChips: [
            { label: '📈 Deep Analytics', route: '/admin/dashboard/analytics' },
            { label: '📦 Orders List', route: '/admin/dashboard/orders' }
          ]
        };

        this.messages.push(message);
        this.speakText(spoken);
        this.scrollToBottom();
      },
      error: () => {
        // Fallback with live local calculation
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
        { title: 'Total Catalog', value: this.allProducts.length },
        { title: 'Out of Stock', value: outOfStock.length, highlight: outOfStock.length > 0 },
        { title: 'Low Stock (≤5)', value: lowStock.length }
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
      `• **📊 Analytics:** Revenue graphs, customer geography, top selling items.\n` +
      `• **🏷️ Inventory:** Real-time stock counts, bilingual search (Bangla & English), unit edits.\n` +
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
      `• **Inventory:** Edit stock counts, update pricing, and search in both Bangla & English.\n` +
      `• **Analytics:** Inspect sales graphs, average basket size, and revenue growth.\n` +
      `• **Curated Promotions:** Control homepage Hot Deals & Best Seller carousels.\n` +
      `• **Out-Sales:** Log offline pop-up and heritage fair transactions.`;

    const spoken = `Here is Karukolpo's store snapshot. You have ${totalOrders} orders totaling ${totalRev} Taka, and ${this.allProducts.length} handcrafted products in your catalog. All admin tools are operating normally.`;

    const message: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'bot',
      text,
      timestamp: new Date(),
      metricsCard: [
        { title: 'Orders Count', value: totalOrders, highlight: true },
        { title: 'Catalog Items', value: this.allProducts.length },
        { title: 'Out of Stock', value: outOfStock, highlight: outOfStock > 0 }
      ],
      actionChips: [
        { label: '📦 Orders Manager', route: '/admin/dashboard/orders' },
        { label: '🏷️ Inventory Control', route: '/admin/dashboard/inventory' },
        { label: '📊 Store Analytics', route: '/admin/dashboard/analytics' },
        { label: '🔥 Manage Hot Deals', route: '/admin/dashboard/hot-deals' }
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
