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
        <p-button styleClass="p-button-outlined p-button-secondary" (click)="op.toggle($event)" pTooltip="Notifications"
                  tooltipPosition="bottom">
            <p-overlay-badge 
                [value]="notificationService.notifications.length > 0 ? notificationService.notifications.length : null" 
                severity="danger">
                <i class="pi pi-bell"></i>
            </p-overlay-badge>
        </p-button>

        <p-overlayPanel #op [style]="{width: '300px'}">
            <ng-template pTemplate>
                <div class="flex flex-column gap-2">
                    <span class="font-bold text-lg mb-2">Notifications</span>
                    <div *ngIf="notificationService.notifications.length === 0" class="text-center p-3 text-500">
                        No new notifications
                    </div>
                    <div *ngFor="let notif of notificationService.notifications"
                         class="p-2 border-round surface-hover cursor-pointer"
                         style="border-bottom: 1px solid var(--surface-border)">
                        <div class="font-bold text-sm">{{ notif.title }}</div>
                        <div class="text-xs text-500">{{ notif.message }}</div>
                        <div class="text-xs text-400 text-right mt-1">{{ notif.time | date:'shortTime' }}</div>
                    </div>
                    <div *ngIf="notificationService.notifications.length > 0" class="text-center mt-2">
                        <p-button label="Clear All" [text]="true" size="small"
                                  (onClick)="notificationService.clearNotifications()"></p-button>
                    </div>
                </div>
            </ng-template>
        </p-overlayPanel>
    `,
    standalone: true,
    styles: [`
    .p-button {
        overflow: visible !important;
    }
    ::ng-deep .p-overlay-badge .p-badge {
        font-size: 0.65rem;
        min-width: 1.25rem;
        height: 1.25rem;
        line-height: 1.25rem;
        font-weight: 700;
        border: 1px solid var(--surface-ground);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    ::ng-deep .dark-mode .p-overlay-badge .p-badge {
        color: #ffffff !important;
    }
  `]
})
export class NotificationButtonComponent {
    constructor(public notificationService: NotificationService) { }
}
