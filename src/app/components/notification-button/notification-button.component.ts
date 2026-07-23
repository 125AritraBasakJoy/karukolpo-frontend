import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
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
    template: `
        <div class="notification-btn-wrapper relative inline-flex">
            <button pButton 
                    type="button"
                    styleClass="p-button-outlined p-button-secondary border-circle w-3rem h-3rem p-0 flex align-items-center justify-content-center" 
                    (click)="togglePanel($event, op)" 
                    pTooltip="Notifications"
                    tooltipPosition="bottom">
                <i class="pi pi-bell text-xl"></i>
            </button>
            <span *ngIf="unreadCount > 0" class="notif-badge-pill">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
        </div>

        <p-overlayPanel #op [style]="{width: '380px'}" styleClass="notification-panel">
            <ng-template pTemplate>
                <div class="flex flex-column surface-card border-round-xl shadow-4 overflow-hidden">
                    <!-- Header -->
                    <div class="flex align-items-center justify-content-between p-3 border-bottom-1 surface-border bg-slate-900">
                        <div class="flex align-items-center gap-2">
                            <i class="pi pi-bell text-primary text-xl"></i>
                            <span class="font-bold text-lg text-white">Notifications</span>
                        </div>
                        <div class="flex align-items-center gap-1">
                            <button *ngIf="unreadCount > 0" 
                                    pButton label="Mark all read" [text]="true" size="small" 
                                    styleClass="p-0 text-xs text-primary hover:text-primary-400 font-medium ml-1"
                                    (click)="markAllRead()"></button>
                        </div>
                    </div>

                    <!-- Filter Tabs -->
                    <div class="flex p-2 gap-2 border-bottom-1 surface-border bg-slate-900/50">
                        <button pButton 
                                [label]="'All (' + notifications.length + ')'" 
                                [outlined]="unreadOnly"
                                [text]="unreadOnly"
                                size="small"
                                styleClass="p-button-sm text-xs border-round-lg py-1 px-3"
                                (click)="setFilter(false)"></button>
                        <button pButton 
                                [label]="'Unread (' + unreadCount + ')'" 
                                [outlined]="!unreadOnly"
                                [text]="!unreadOnly"
                                size="small"
                                styleClass="p-button-sm text-xs border-round-lg py-1 px-3"
                                (click)="setFilter(true)"></button>
                    </div>

                    <!-- Loading State -->
                    <div *ngIf="loading" class="flex flex-column align-items-center justify-content-center p-4">
                        <p-progressSpinner styleClass="w-2rem h-2rem" strokeWidth="4"></p-progressSpinner>
                    </div>

                    <!-- Notification List -->
                    <div *ngIf="!loading" class="notification-list custom-scrollbar" style="max-height: 380px; overflow-y: auto;">
                        <!-- Empty State -->
                        <div *ngIf="filteredNotifications.length === 0" class="flex flex-column align-items-center justify-content-center p-5 text-center text-500">
                            <i class="pi pi-bell-slash text-4xl mb-3 opacity-40"></i>
                            <span class="font-medium text-slate-300">No {{ unreadOnly ? 'unread' : '' }} notifications</span>
                            <span class="text-xs text-slate-500 mt-1">You're all caught up with your updates.</span>
                        </div>

                        <!-- Items -->
                        <div *ngFor="let notif of filteredNotifications"
                             class="notification-item p-3 border-bottom-1 surface-border cursor-pointer transition-colors transition-duration-150 flex gap-3 align-items-start"
                             [class.unread-bg]="!(notif.is_read || notif.read)"
                             [class.read-bg]="notif.is_read || notif.read"
                             (click)="onNotificationClick(notif, op)">
                            
                            <!-- Icon Indicator -->
                            <div class="flex-shrink-0 mt-1 relative">
                                <div [class]="getNotificationIconBg(notif.type) + ' w-2rem h-2rem border-circle flex align-items-center justify-content-center'">
                                    <i [class]="getNotificationIcon(notif.type) + ' text-sm'"></i>
                                </div>
                                <span *ngIf="!(notif.is_read || notif.read)" class="unread-dot"></span>
                            </div>

                            <!-- Content -->
                            <div class="flex-grow-1 min-w-0">
                                <div class="flex align-items-center justify-content-between mb-1">
                                    <span class="font-semibold text-sm line-height-2 truncate-1" 
                                          [class.text-white]="!(notif.is_read || notif.read)"
                                          [class.text-slate-300]="notif.is_read || notif.read">
                                        {{ notif.title || 'Notification' }}
                                    </span>
                                    <span *ngIf="!(notif.is_read || notif.read)" class="new-badge-btn">NEW</span>
                                </div>

                                <div class="text-xs text-slate-400 line-height-3 mb-2 text-break">
                                    {{ notif.message || notif.content }}
                                </div>

                                <div class="text-3xs text-slate-500 flex align-items-center justify-content-between">
                                    <span class="flex align-items-center gap-1">
                                        <i class="pi pi-clock text-3xs"></i>
                                        {{ formatTime(notif.time || notif.created_at) }}
                                    </span>
                                    <span *ngIf="notif.type" class="uppercase font-medium tracking-wider text-slate-500 text-3xs">
                                        {{ notif.type }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="p-2 border-top-1 surface-border bg-slate-900/80 text-center">
                        <span class="text-xs text-slate-500">Click a notification to mark as read</span>
                    </div>
                </div>
            </ng-template>
        </p-overlayPanel>
    `,
    standalone: true,
    styles: [`
    :host ::ng-deep .notification-panel .p-overlaypanel-content {
        padding: 0 !important;
        background: transparent !important;
    }

    .notification-item {
        border-bottom-color: rgba(255, 255, 255, 0.06) !important;
    }

    .notification-item:last-child {
        border-bottom: none !important;
    }

    .unread-bg {
        background-color: rgba(59, 130, 246, 0.08);
    }

    .unread-bg:hover {
        background-color: rgba(59, 130, 246, 0.15);
    }

    .read-bg {
        background-color: transparent;
    }

    .read-bg:hover {
        background-color: rgba(255, 255, 255, 0.03);
    }

    .unread-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #3b82f6;
        box-shadow: 0 0 6px #3b82f6;
    }

    .text-3xs {
        font-size: 0.6875rem;
    }

    .truncate-1 {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .text-break {
        word-break: break-word;
    }

    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.15);
        border-radius: 20px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }

    .notification-btn-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    .notif-badge-pill {
        position: absolute;
        top: -4px;
        right: -4px;
        background-color: #ef4444;
        color: #ffffff;
        font-size: 0.7rem;
        font-weight: 700;
        min-width: 1.25rem;
        height: 1.25rem;
        border-radius: 9999px;
        padding: 0 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);
        border: 2px solid var(--surface-card, #0f172a);
        z-index: 10;
        pointer-events: none;
        animation: pulse-red-bell 2s infinite;
    }

    .new-badge-btn {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: #ffffff;
        padding: 2.5px 8px;
        border-radius: 6px;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.15);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        display: inline-block;
        transition: all 0.2s ease-in-out;
    }

    .new-badge-btn:hover {
        transform: translateY(-1px) scale(1.05);
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
        background: linear-gradient(135deg, #60a5fa, #2563eb);
    }

    @keyframes pulse-red-bell {
        0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        }
        70% {
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
        }
    }
  `]
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
