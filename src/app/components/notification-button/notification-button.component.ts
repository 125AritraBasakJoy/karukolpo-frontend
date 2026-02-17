import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-notification-button',
    imports: [CommonModule, ButtonModule, BadgeModule, OverlayBadgeModule, OverlayPanelModule, TooltipModule],
    template: `
        <p-button styleClass="p-button-outlined p-button-secondary border-circle w-3rem h-3rem p-0" (click)="op.toggle($event)" pTooltip="Notifications"
                  tooltipPosition="bottom">
            <p-overlay-badge 
                [value]="notificationService.notifications.length > 0 ? notificationService.notifications.length : null" 
                severity="danger" styleClass="custom-badge">
                <i class="pi pi-bell text-xl"></i>
            </p-overlay-badge>
        </p-button>

        <p-overlayPanel #op [style]="{width: '380px'}" styleClass="notification-panel">
            <ng-template pTemplate>
                <div class="flex flex-column">
                    <!-- Header -->
                    <div class="flex align-items-center justify-content-between p-3 border-bottom-1 surface-border">
                        <span class="font-bold text-lg">Notifications</span>
                        <p-button *ngIf="notificationService.notifications.length > 0" 
                                label="Clear All" [text]="true" size="small" 
                                styleClass="p-0 text-sm text-primary hover:text-primary-600"
                                (onClick)="notificationService.clearNotifications()"></p-button>
                    </div>

                    <!-- Notification List -->
                    <div class="notification-list custom-scrollbar" style="max-height: 400px; overflow-y: auto;">
                        <!-- Empty State -->
                        <div *ngIf="notificationService.notifications.length === 0" class="flex flex-column align-items-center justify-content-center p-5 text-center text-500">
                            <i class="pi pi-bell-slash text-4xl mb-3 opacity-50"></i>
                            <span class="font-medium">No new notifications</span>
                            <span class="text-sm mt-1">We'll let you know when updates arrive.</span>
                        </div>

                        <!-- Items -->
                        <div *ngFor="let notif of notificationService.notifications"
                             class="notification-item p-3 border-bottom-1 surface-border cursor-pointer hover:surface-ground transition-colors transition-duration-150 flex gap-3"
                             (click)="onNotificationClick(notif, op)">
                            <div class="flex-shrink-0 mt-1">
                                <div class="w-2rem h-2rem border-circle bg-blue-500 bg-opacity-10 flex align-items-center justify-content-center text-blue-500">
                                    <i class="pi pi-info-circle text-sm"></i>
                                </div>
                            </div>
                            <div class="flex-grow-1">
                                <div class="font-semibold text-color mb-1 line-height-2">{{ notif.title }}</div>
                                <div class="text-sm text-500 line-height-3 mb-2">{{ notif.message }}</div>
                                <div class="text-xs text-400 flex align-items-center gap-1">
                                    <i class="pi pi-clock text-xs"></i>
                                    {{ notif.time | date:'shortTime' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ng-template>
        </p-overlayPanel>
    `,
    standalone: true,
    styles: [`
    :host ::ng-deep .notification-panel .p-overlaypanel-content {
        padding: 0 !important;
    }
    
    .notification-item:last-child {
        border-bottom: none !important;
    }

    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: var(--surface-border);
        border-radius: 20px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: var(--text-color-secondary);
    }

    ::ng-deep .custom-badge .p-badge {
        min-width: 1.25rem;
        height: 1.25rem;
        line-height: 1.25rem;
    }
  `]
})
export class NotificationButtonComponent {
    constructor(public notificationService: NotificationService) { }

    onNotificationClick(notif: any, overlay: any) {
        this.notificationService.handleNotificationClick(notif);
        overlay.hide();
    }
}
