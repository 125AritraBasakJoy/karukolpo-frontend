import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SiteConfigService } from '../../../services/site-config.service';

@Component({
    selector: 'app-maintenance-control',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        ButtonModule,
        ToggleSwitchModule,
        ToastModule,
        ConfirmDialogModule
    ],
    providers: [ConfirmationService, MessageService],
    template: `
    <div class="maintenance-control-container p-4">
      <div class="flex flex-column gap-4 max-w-30rem mx-auto">
        <h1 class="text-3xl font-bold text-white mb-2">System Controls</h1>
        
        <p-card header="Maintenance Control" subheader="Manage storefront visibility" styleClass="premium-card shadow-lg">
          <div class="flex flex-column gap-4 py-2">
            <div class="flex align-items-center justify-content-between p-3 bg-slate-800 border-round-xl border-1 border-slate-700">
              <div class="flex flex-column gap-1">
                <span class="font-bold text-lg text-white">Maintenance Mode</span>
                <span class="text-slate-400 text-sm">When active, customers will be redirected to the maintenance page.</span>
              </div>
              <p-toggleSwitch 
                [(ngModel)]="isMaintenanceMode" 
                (onChange)="onToggleChange($event)">
              </p-toggleSwitch>
            </div>

            <div class="status-indicator flex align-items-center gap-2 p-2 border-round-lg" 
              [ngClass]="siteConfigService.siteConfig().isMaintenanceMode ? 'bg-orange-900-soft text-orange-400' : 'bg-green-900-soft text-green-400'">
              <i class="pi" [ngClass]="siteConfigService.siteConfig().isMaintenanceMode ? 'pi-lock' : 'pi-check-circle'"></i>
              <span class="font-semibold">
                Status: {{ siteConfigService.siteConfig().isMaintenanceMode ? 'Maintenance Active' : 'System Live' }}
              </span>
            </div>
          </div>
        </p-card>
      </div>
    </div>

    <p-confirmDialog [style]="{width: '450px'}" appendTo="body" styleClass="premium-confirm-dialog"></p-confirmDialog>
    <p-toast></p-toast>
  `,
    styles: [`
    .bg-orange-900-soft { background: rgba(124, 45, 18, 0.2); border: 1px solid rgba(251, 146, 60, 0.2); }
    .bg-green-900-soft { background: rgba(20, 83, 45, 0.2); border: 1px solid rgba(74, 222, 128, 0.2); }
    
    :host ::ng-deep .premium-card {
      background: rgba(15, 23, 42, 0.6) !important;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.5rem;
    }
  `]
})
export class MaintenanceControlComponent {
    siteConfigService = inject(SiteConfigService);
    private confirmationService = inject(ConfirmationService);
    private messageService = inject(MessageService);

    isMaintenanceMode = this.siteConfigService.siteConfig().isMaintenanceMode;

    onToggleChange(event: any) {
        const newValue = event.checked;

        // Prevent immediate UI change if turning ON, we want confirmation
        // However, [(ngModel)] already updated it. Let's revert if cancelled.

        this.confirmationService.confirm({
            message: newValue
                ? 'Are you sure you want to trigger Maintenance Mode? Customers will no longer be able to browse the shop.'
                : 'Are you sure you want to disable Maintenance Mode and go LIVE?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'pi pi-check mr-2',
            rejectIcon: 'pi pi-times mr-2',
            acceptLabel: 'Yes',
            rejectLabel: 'No',
            acceptButtonStyleClass: newValue ? 'p-button-danger' : 'p-button-success',
            rejectButtonStyleClass: 'p-button-text p-button-secondary',
            accept: () => {
                this.siteConfigService.updateConfig({ isMaintenanceMode: newValue });
                this.messageService.add({
                    severity: 'success',
                    summary: 'Updated',
                    detail: `Maintenance Mode is now ${newValue ? 'ON' : 'OFF'}`
                });
            },
            reject: () => {
                // Revert the toggle state
                this.isMaintenanceMode = !newValue;
            }
        });
    }
}
