import { Injectable, inject, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { Subscription, Subject, Observable, of, interval } from 'rxjs';
import { catchError, map, tap, switchMap, filter } from 'rxjs/operators';
import { OrderService } from './order.service';
import { ProductService } from './product.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { API_ENDPOINTS } from '../../core/api-endpoints';
import { NotificationRead, UnreadCountResponse } from '../models/notification.model';

export type AppNotification = NotificationRead;

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private apiService = inject(ApiService);
    private authService = inject(AuthService);
    private router = inject(Router);
    private orderService = inject(OrderService);
    private productService = inject(ProductService);
    private messageService!: MessageService;

    // Reactive State Signals
    notificationsSignal = signal<NotificationRead[]>([]);
    unreadCountSignal = signal<number>(0);
    loadingSignal = signal<boolean>(false);
    filterUnreadOnlySignal = signal<boolean>(false);

    // Subject for handling notification clicks
    private notificationClickSubject = new Subject<NotificationRead>();
    notificationClicked$ = this.notificationClickSubject.asObservable();

    private readonly NOTIF_STORAGE_KEY = 'admin_notifications';
    private orderSub: Subscription | undefined;
    private pollingSub: Subscription | undefined;

    constructor(@Inject(PLATFORM_ID) private platformId: Object) {
        this.loadLocalNotifications();
        this.startListening();
        this.startPolling();
    }

    /**
     * Getter for backward compatibility with legacy components referencing notificationService.notifications
     */
    get notifications(): NotificationRead[] {
        return this.notificationsSignal();
    }

    set notifications(list: NotificationRead[]) {
        this.notificationsSignal.set(list);
    }

    /**
     * Getter for unread count
     */
    get unreadCount(): number {
        return this.unreadCountSignal();
    }

    // ==========================================
    // BACKEND API INTEGRATIONS (OpenAPI Spec)
    // ==========================================

    /**
     * GET /admin/notifications
     * List Notifications with unread_only, skip, limit parameters
     */
    fetchNotifications(unreadOnly = this.filterUnreadOnlySignal(), skip = 0, limit = 50): Observable<NotificationRead[]> {
        if (!this.authService.isAuthenticated()) {
            return of(this.notificationsSignal());
        }

        this.loadingSignal.set(true);
        const endpoint = API_ENDPOINTS.NOTIFICATIONS.LIST(unreadOnly, skip, limit);

        return this.apiService.get<any>(endpoint).pipe(
            map(response => {
                let rawList: any[] = [];
                if (Array.isArray(response)) {
                    rawList = response;
                } else if (response && typeof response === 'object') {
                    rawList = response.items || response.data || response.notifications || [];
                }

                return rawList.map(item => this.normalizeNotification(item));
            }),
            tap(normalizedItems => {
                this.notificationsSignal.set(normalizedItems);
                this.saveLocalNotifications(normalizedItems);
                this.loadingSignal.set(false);
            }),
            catchError(err => {
                console.warn('Backend notifications endpoint unavailable, falling back to local state:', err);
                this.loadingSignal.set(false);
                return of(this.notificationsSignal());
            })
        );
    }

    /**
     * GET /admin/notifications/unread-count
     * Get unread notifications count
     */
    fetchUnreadCount(): Observable<number> {
        if (!this.authService.isAuthenticated()) {
            return of(this.unreadCountSignal());
        }

        return this.apiService.get<UnreadCountResponse | number>(API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT).pipe(
            map(res => {
                if (typeof res === 'number') {
                    return res;
                }
                if (res && typeof res === 'object') {
                    if (typeof res.unread_count === 'number') return res.unread_count;
                    if (typeof res.count === 'number') return res.count;
                }
                return 0;
            }),
            tap(count => {
                this.unreadCountSignal.set(count);
            }),
            catchError(err => {
                console.warn('Failed to fetch unread count from backend, computing locally:', err);
                const localUnread = this.notificationsSignal().filter(n => !(n.is_read || n.read)).length;
                this.unreadCountSignal.set(localUnread);
                return of(localUnread);
            })
        );
    }

    /**
     * POST /admin/notifications/{notification_id}/read
     * Mark single notification as read
     */
    markNotificationAsRead(notif: NotificationRead): Observable<void> {
        // Optimistic UI update
        this.updateLocalReadState(notif.id, true);

        if (!this.authService.isAuthenticated() || !notif.id || notif.id.startsWith('local-')) {
            return of(void 0);
        }

        return this.apiService.post<void>(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notif.id), {}).pipe(
            tap(() => {
                this.fetchUnreadCount().subscribe();
            }),
            catchError(err => {
                console.warn(`Failed to mark notification ${notif.id} read on backend:`, err);
                return of(void 0);
            })
        );
    }

    /**
     * POST /admin/notifications/read-all
     * Mark all notifications as read
     */
    markAllNotificationsAsRead(): Observable<void> {
        // Optimistic UI update
        const updatedList = this.notificationsSignal().map(n => ({
            ...n,
            is_read: true,
            read: true
        }));
        this.notificationsSignal.set(updatedList);
        this.unreadCountSignal.set(0);
        this.saveLocalNotifications(updatedList);

        if (!this.authService.isAuthenticated()) {
            return of(void 0);
        }

        return this.apiService.post<void>(API_ENDPOINTS.NOTIFICATIONS.READ_ALL, {}).pipe(
            tap(() => {
                this.fetchUnreadCount().subscribe();
            }),
            catchError(err => {
                console.warn('Failed to mark all read on backend:', err);
                return of(void 0);
            })
        );
    }

    /**
     * Set filter unread only state and reload
     */
    setUnreadOnlyFilter(unreadOnly: boolean) {
        this.filterUnreadOnlySignal.set(unreadOnly);
        this.fetchNotifications(unreadOnly).subscribe();
    }

    // ==========================================
    // NOTIFICATION HANDLING & CLICK LOGIC
    // ==========================================

    handleNotificationClick(notification: NotificationRead) {
        // Mark read
        if (!(notification.is_read || notification.read)) {
            this.markNotificationAsRead(notification).subscribe();
        }

        this.notificationClickSubject.next(notification);

        // Navigate if notification contains target order
        const orderId = notification.data?.orderId || notification.data?.order_id || notification.data?.id;
        if (orderId && this.authService.isAuthenticated()) {
            this.router.navigate(['/admin/dashboard/orders'], { queryParams: { highlight: orderId } });
        }
    }

    addNotification(notification: NotificationRead) {
        const normalized = this.normalizeNotification({
            ...notification,
            id: notification.id || `local-${Date.now()}`
        });

        const currentList = [normalized, ...this.notificationsSignal()];
        if (currentList.length > 50) {
            currentList.pop();
        }
        this.notificationsSignal.set(currentList);
        this.saveLocalNotifications(currentList);
        this.recalculateUnreadCount();
    }

    clearNotifications() {
        this.notificationsSignal.set([]);
        this.unreadCountSignal.set(0);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(this.NOTIF_STORAGE_KEY);
        }
        if (this.authService.isAuthenticated()) {
            this.markAllNotificationsAsRead().subscribe();
        }
    }

    // ==========================================
    // HELPER & INITIALIZATION METHODS
    // ==========================================

    init(messageService: MessageService) {
        this.messageService = messageService;
        if (this.authService.isAuthenticated()) {
            this.refreshAll();
        }
    }

    refreshAll() {
        this.fetchNotifications().subscribe();
        this.fetchUnreadCount().subscribe();
    }

    private startPolling() {
        if (!isPlatformBrowser(this.platformId) || this.pollingSub) return;

        // Poll unread count & notifications every 30 seconds when authenticated
        this.pollingSub = interval(30000).pipe(
            filter(() => this.authService.isAuthenticated())
        ).subscribe(() => {
            this.fetchUnreadCount().subscribe();
            this.fetchNotifications().subscribe();
        });
    }

    private updateLocalReadState(id: string, isRead: boolean) {
        const updatedList = this.notificationsSignal().map(n => {
            if (n.id === id) {
                return { ...n, is_read: isRead, read: isRead };
            }
            return n;
        });
        this.notificationsSignal.set(updatedList);
        this.saveLocalNotifications(updatedList);
        this.recalculateUnreadCount();
    }

    private recalculateUnreadCount() {
        const count = this.notificationsSignal().filter(n => !(n.is_read || n.read)).length;
        this.unreadCountSignal.set(count);
    }

    private normalizeNotification(item: any): NotificationRead {
        const payload = item.payload || item.data || {};

        // Extract read status: check read_at timestamp from backend or boolean flags
        const isRead = item.read_at != null || 
                       (item.is_read !== undefined ? Boolean(item.is_read) : 
                       (item.read !== undefined ? Boolean(item.read) : false));

        // Extract title: prioritize payload.title as requested
        let title = payload.title || item.title || item.event_type || payload.event_type;
        if (!title || title === 'order_placed') {
            title = 'New Order Placed';
        }

        // Extract message: prioritize payload.message / payload.content
        const message = payload.message || payload.content || item.message || item.content || item.detail || '';

        // Extract type
        const eventType = item.event_type || payload.event_type || item.type || 'order';
        const normalizedType = eventType.includes('order') ? 'order' : eventType;

        let time = new Date();

        if (item.created_at) {
            let dateStr = item.created_at;
            if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
                dateStr += 'Z';
            }
            time = new Date(dateStr);
        } else if (item.time) {
            time = new Date(item.time);
        }

        return {
            id: item.id ? String(item.id) : `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title,
            message,
            content: message,
            type: normalizedType,
            is_read: isRead,
            read: isRead,
            data: { ...payload, ...(item.data || {}) },
            created_at: item.created_at || time.toISOString(),
            time
        };
    }

    private loadLocalNotifications() {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.NOTIF_STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const list = parsed.map((n: any) => this.normalizeNotification(n));
                    this.notificationsSignal.set(list);
                    this.recalculateUnreadCount();
                } catch (e) {
                    console.error('Failed to parse notifications', e);
                }
            }
        }
    }

    private saveLocalNotifications(list: NotificationRead[]) {
        if (isPlatformBrowser(this.platformId)) {
            try {
                localStorage.setItem(this.NOTIF_STORAGE_KEY, JSON.stringify(list));
            } catch (e) {
                console.error('Error saving notifications', e);
            }
        }
    }

    private startListening() {
        if (this.orderSub) return;

        this.requestNotificationPermission();

        this.orderSub = this.orderService.newOrderNotification$.subscribe(notification => {
            const { id: orderId, type } = notification;

            if (type === 'new') {
                this.addNotification({
                    id: `order-notif-${orderId}-${Date.now()}`,
                    title: 'New Order Received',
                    message: `Order #${orderId} placed.`,
                    time: new Date(),
                    type: 'order',
                    is_read: false,
                    read: false,
                    data: { orderId }
                });

                this.showBrowserNotification('New Order Received', `Order #${orderId} has been placed.`);

                if (this.messageService) {
                    this.messageService.add({
                        severity: 'info',
                        summary: 'New Order Received',
                        detail: `Order #${orderId} has been placed.`,
                        life: 3000
                    });
                }

                this.checkLowStock();
                this.fetchUnreadCount().subscribe();
            }
        });
    }

    requestNotificationPermission() {
        if (isPlatformBrowser(this.platformId) && 'Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    showBrowserNotification(title: string, body: string) {
        if (isPlatformBrowser(this.platformId) && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: 'assets/favicon.ico' });
        }
    }

    checkLowStock() {
        setTimeout(() => {
            this.productService.getProducts().subscribe(products => {
                const lowStockProducts = products.filter(p => p.stock !== undefined && p.stock <= 5);
                if (lowStockProducts.length > 0) {
                    const names = lowStockProducts.map(p => p.name).join(', ');

                    if (this.messageService) {
                        this.messageService.add({
                            severity: 'warn',
                            summary: 'Low Stock Alert',
                            detail: `Low stock for: ${names}`,
                            life: 3000
                        });
                    }
                    this.showBrowserNotification('Low Stock Alert', `Low stock for: ${names}`);
                    this.addNotification({
                        id: `stock-notif-${Date.now()}`,
                        title: 'Low Stock Alert',
                        message: `Low stock: ${names}`,
                        time: new Date(),
                        type: 'stock',
                        is_read: false,
                        read: false
                    });
                }
            });
        }, 500);
    }
}
