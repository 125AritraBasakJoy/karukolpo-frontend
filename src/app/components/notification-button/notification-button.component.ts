import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { TooltipModule } from 'primeng/tooltip';

@Component({
    selector: 'app-notification-button',
    standalone: true,
    imports: [CommonModule, ButtonModule, BadgeModule, OverlayPanelModule, TooltipModule],
    template: `
    <p-button styleClass="p-button-outlined p-button-secondary" (click)="op.toggle($event)" pTooltip="Notifications" tooltipPosition="bottom">
        <i class="pi pi-bell p-overlay-badge" [class.mr-2]="false">
            <span *ngIf="notificationService.notifications.length > 0" class="p-badge p-badge-danger p-badge-sm notification-badge">{{ notificationService.notifications.length }}</span>
        </i>
    </p-button>

    <p-overlayPanel #op [style]="{width: '300px'}">
        <ng-template pTemplate>
            <div class="flex flex-column gap-2">
                <span class="font-bold text-lg mb-2">Notifications</span>
                <div *ngIf="notificationService.notifications.length === 0" class="text-center p-3 text-500">
                    No new notifications
                </div>
                <div *ngFor="let notif of notificationService.notifications" class="p-2 border-round surface-hover cursor-pointer" style="border-bottom: 1px solid var(--surface-border)">
                    <div class="font-bold text-sm">{{ notif.title }}</div>
                    <div class="text-xs text-500">{{ notif.message }}</div>
                    <div class="text-xs text-400 text-right mt-1">{{ notif.time | date:'shortTime' }}</div>
                </div>
                <div *ngIf="notificationService.notifications.length > 0" class="text-center mt-2">
                    <p-button label="Clear All" [text]="true" size="small" (onClick)="notificationService.clearNotifications()"></p-button>
                </div>
            </div>
        </ng-template>
    </p-overlayPanel>
  `,
    styles: [`
    .notification-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 0.75rem;
      min-width: 1rem;
      height: 1rem;
      line-height: 1rem;
      padding: 0;
      border-radius: 50%;
    }
    .p-button {
        overflow: visible !important;
    }
  `]
})
export class NotificationButtonComponent {
    constructor(public notificationService: NotificationService) { }
}
