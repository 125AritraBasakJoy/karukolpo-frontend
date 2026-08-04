import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services';;;
import { NotificationRead } from '../../models/notification.model';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
    selector: 'app-notification-button',
    imports: [
        CommonModule,
        ButtonModule,
        BadgeModule,
        OverlayBadgeModule,
        OverlayPanelModule,
        TooltipModule,
        TagModule,
        ProgressSpinnerModule
    ],
    templateUrl: './notification-button.component.html',
    styleUrls: ['./notification-button.component.scss'],
    standalone: true
})
export class NotificationButtonComponent implements OnInit {
    notificationService = inject(NotificationService);

    ngOnInit() {
        // Notification fetches are already initialized by the parent DashboardComponent layout
    }

    get notifications(): NotificationRead[] {
        return this.notificationService.notificationsSignal();
    }

    get unreadCount(): number {
        const signalCount = this.notificationService.unreadCountSignal();
        const listCount = this.notifications.filter(n => !(n.is_read || n.read)).length;
        return Math.max(signalCount, listCount);
    }

    get loading(): boolean {
        return this.notificationService.loadingSignal();
    }

    get unreadOnly(): boolean {
        return this.notificationService.filterUnreadOnlySignal();
    }

    get filteredNotifications(): NotificationRead[] {
        if (this.unreadOnly) {
            return this.notifications.filter(n => !(n.is_read || n.read));
        }
        return this.notifications;
    }

    togglePanel(event: Event, overlay: any) {
        overlay.toggle(event);
        if (overlay.overlayVisible) {
            this.refreshData();
        }
    }

    refreshData() {
        this.notificationService.refreshAll();
    }

    setFilter(unreadOnly: boolean) {
        this.notificationService.setUnreadOnlyFilter(unreadOnly);
    }

    markAllRead() {
        this.notificationService.markAllNotificationsAsRead().subscribe();
    }

    onNotificationClick(notif: NotificationRead, overlay: any) {
        this.notificationService.handleNotificationClick(notif);
        if (overlay) {
            overlay.hide();
        }
    }

    getNotificationIcon(type?: string): string {
        switch (type?.toLowerCase()) {
            case 'order': return 'pi pi-shopping-cart';
            case 'stock': return 'pi pi-exclamation-triangle';
            case 'system': return 'pi pi-cog';
            default: return 'pi pi-bell';
        }
    }

    getNotificationIconBg(type?: string): string {
        switch (type?.toLowerCase()) {
            case 'order': return 'bg-blue-500/10 text-blue-400 border-1 border-blue-500/20';
            case 'stock': return 'bg-amber-500/10 text-amber-400 border-1 border-amber-500/20';
            case 'system': return 'bg-purple-500/10 text-purple-400 border-1 border-purple-500/20';
            default: return 'bg-primary-500/10 text-primary-400 border-1 border-primary-500/20';
        }
    }

    formatTime(rawTime?: Date | string): string {
        if (!rawTime) return '';
        const d = typeof rawTime === 'string' ? new Date(rawTime) : rawTime;
        if (isNaN(d.getTime())) return '';

        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}
