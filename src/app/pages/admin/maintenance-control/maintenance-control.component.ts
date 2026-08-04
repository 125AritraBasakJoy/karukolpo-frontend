import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SiteConfigService } from '../../../core/services';;;

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
  providers: [ConfirmationService],
  templateUrl: './maintenance-control.component.html',
  styleUrls: ['./maintenance-control.component.scss']
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
        this.messageService.add({ life: 2000,
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
