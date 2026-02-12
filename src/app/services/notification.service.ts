import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { OrderService } from './order.service';
import { ProductService } from './product.service';
import { Subscription } from 'rxjs'; // Import Subscription

export interface AppNotification {
    title: string;
    message: string;
    time: Date;
    type: 'order' | 'stock';
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    notifications: AppNotification[] = [];
    private orderService = inject(OrderService);
    private productService = inject(ProductService);
    private messageService!: MessageService;

    private readonly NOTIF_STORAGE_KEY = 'admin_notifications';
    private orderSub: Subscription | undefined;

    constructor() {
        this.loadNotifications();
        // Start listening immediately to capture history
        this.startListening();
    }

    private loadNotifications() {
        const saved = localStorage.getItem(this.NOTIF_STORAGE_KEY);
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading notifications', e);
            }
        }
    }

    private saveNotifications() {
        try {
            localStorage.setItem(this.NOTIF_STORAGE_KEY, JSON.stringify(this.notifications));
        } catch (e) {
            console.error('Error saving notifications', e);
        }
    }

    addNotification(notification: AppNotification) {
        this.notifications.unshift(notification);
        // Limit history to 50
        if (this.notifications.length > 50) {
            this.notifications.pop();
        }
        this.saveNotifications();
    }

    clearNotifications() {
        this.notifications = [];
        this.saveNotifications();
    }

    private startListening() {
        if (this.orderSub) return;

        this.requestNotificationPermission();

        this.orderSub = this.orderService.newOrderNotification$.subscribe(orderId => {

            // 1. Add to Notification Center (Always)
            this.addNotification({
                title: 'New Order',
                message: `Order #${orderId} placed.`,
                time: new Date(),
                type: 'order'
            });

            // 2. Browser Notification (Always if allowed)
            this.showBrowserNotification('New Order Received', `Order #${orderId} has been placed.`);

            // 3. App Toast (Only if MessageService is available)
            if (this.messageService) {
                this.messageService.add({
                    severity: 'info',
                    summary: 'New Order Received',
                    detail: `Order #${orderId} has been placed.`,
                    life: 10000
                });
            }

            // 4. Low Stock Check
            this.checkLowStock();
        });
    }

    init(messageService: MessageService) {
        this.messageService = messageService;
        // Subscription is already active from constructor
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    showBrowserNotification(title: string, body: string) {
        if ('Notification' in window && Notification.permission === 'granted') {
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
                            life: 15000
                        });
                    }
                    this.showBrowserNotification('Low Stock Alert', `Low stock for: ${names}`);
                    this.addNotification({
                        title: 'Low Stock Alert',
                        message: `Low stock: ${names}`,
                        time: new Date(),
                        type: 'stock'
                    });
                }
            });
        }, 500);
    }
}
